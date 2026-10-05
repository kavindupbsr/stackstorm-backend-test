/* eslint-disable no-param-reassign, camelcase */
const { LoyaltyAccount, CustomerProfile, sequelize } = require('../models');
const { logger } = require('../config/logger');
const ApiError = require('../utils/ApiError');

/**
 * Loyalty Tier multipliers per LKR 100 spent (FR-022 / Issue #6).
 * Silver:   1.0 pt / LKR 100
 * Gold:     1.5 pt / LKR 100
 * Platinum: 2.0 pt / LKR 100
 */
const TIER_MULTIPLIERS = {
  silver: 1.0,
  gold: 1.5,
  platinum: 2.0,
};

/**
 * Annual spending thresholds for tier qualifying (LKR).
 * Silver:   LKR 0 – 24,999.99
 * Gold:     LKR 25,000 – 49,999.99
 * Platinum: LKR 50,000+
 */
const TIER_THRESHOLDS = {
  platinum: 50000,
  gold: 25000,
  silver: 0,
};

const TIER_HIERARCHY = ['silver', 'gold', 'platinum'];

/**
 * Calculates reward points earned from a purchase based on customer tier multiplier.
 * Formula: Math.floor((orderAmount / 100) * multiplier)
 *
 * @param {number} orderAmount - Qualifying order monetary value in LKR
 * @param {string} [tier='silver'] - Customer loyalty tier ('silver'|'gold'|'platinum')
 * @returns {number} Points earned integer
 */
const calculatePoints = (orderAmount, tier = 'silver') => {
  const amount = Number(orderAmount);
  if (Number.isNaN(amount) || amount <= 0) {
    return 0;
  }

  const normalizedTier = String(tier).toLowerCase().trim();
  const multiplier = TIER_MULTIPLIERS[normalizedTier] ?? TIER_MULTIPLIERS.silver;

  return Math.floor((amount / 100) * multiplier);
};

/**
 * Determines the target tier based on total annual spending.
 *
 * @param {number} annualSpend - Total qualifying spend in LKR
 * @returns {('silver'|'gold'|'platinum')} Eligible loyalty tier
 */
const getTierForSpend = (annualSpend) => {
  const spend = Number(annualSpend) || 0;
  if (spend >= TIER_THRESHOLDS.platinum) {
    return 'platinum';
  }
  if (spend >= TIER_THRESHOLDS.gold) {
    return 'gold';
  }
  return 'silver';
};

/**
 * Retrieves or lazily initializes a customer's loyalty account.
 * Follows Issue #6 1:1 identifying key convention (`customer_id` as PK).
 *
 * @param {string} customerId - User UUID
 * @param {object} [options] - Options including transaction
 * @returns {Promise<LoyaltyAccount>}
 */
const getOrCreateAccount = async (customerId, options = {}) => {
  if (!customerId) {
    throw ApiError.badRequest('customerId is required');
  }

  let account = await LoyaltyAccount.findByPk(customerId, options);
  if (!account) {
    account = await LoyaltyAccount.create(
      {
        customer_id: customerId,
        points_balance: 0,
        tier: 'silver',
        lifetime_points: 0,
        annual_spend: 0.0,
        consecutive_below_threshold_quarters: 0,
      },
      options
    );
    logger.info(`[LOYALTY_SERVICE] Created new Silver loyalty account for user=${customerId}`);
  }

  return account;
};

/**
 * Retrieves formatted loyalty account summary for customer or admin view.
 *
 * @param {string} customerId - User UUID
 * @returns {Promise<object>} Formatted loyalty account response
 */
const getLoyaltyAccount = async (customerId) => {
  const account = await getOrCreateAccount(customerId);

  const annualSpendNum = Number(account.annual_spend) || 0;
  const formattedSpend = `LKR ${annualSpendNum.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

  return {
    customer_id: account.customer_id,
    tier: account.tier,
    points: account.points_balance,
    points_balance: account.points_balance,
    lifetime_points: account.lifetime_points,
    annual_spend: annualSpendNum,
    annualSpend: formattedSpend,
    consecutive_below_threshold_quarters: account.consecutive_below_threshold_quarters,
    last_audit_at: account.last_audit_at,
    created_at: account.created_at || account.createdAt,
    updated_at: account.updated_at || account.updatedAt,
  };
};

/**
 * Accrues points for a paid purchase and immediately evaluates tier upgrades (AC1 & AC2).
 *
 * @param {string} customerId - User UUID
 * @param {number} orderAmount - Paid order value in LKR
 * @param {object} [metadata] - Optional audit metadata (e.g., orderId, orderNumber)
 * @returns {Promise<object>} Result of points accrual and tier transition
 */
const accruePoints = async (customerId, orderAmount, metadata = {}) => {
  const amount = Number(orderAmount);
  if (Number.isNaN(amount) || amount <= 0) {
    throw ApiError.badRequest('Order amount must be a positive number');
  }

  return sequelize.transaction(async (t) => {
    const account = await getOrCreateAccount(customerId, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    const previousTier = account.tier;
    const pointsEarned = calculatePoints(amount, previousTier);

    // Increment points balance and annual spend
    account.points_balance = (account.points_balance ?? 0) + pointsEarned;
    account.lifetime_points = (account.lifetime_points ?? 0) + pointsEarned;
    account.annual_spend = Number(account.annual_spend ?? 0) + amount;

    // AC2: Tier upgrades occur immediately upon passing threshold
    const qualifiedTier = getTierForSpend(account.annual_spend);
    const currentTierIdx = TIER_HIERARCHY.indexOf(account.tier);
    const qualifiedTierIdx = TIER_HIERARCHY.indexOf(qualifiedTier);

    let tierUpgraded = false;
    if (qualifiedTierIdx > currentTierIdx) {
      account.tier = qualifiedTier;
      account.consecutive_below_threshold_quarters = 0; // Reset grace period on promotion
      tierUpgraded = true;

      // Sync customer_profiles table
      await CustomerProfile.update(
        { loyalty_tier: qualifiedTier },
        { where: { user_id: customerId }, transaction: t }
      );

      logger.info(
        `[LOYALTY_SERVICE] Customer ${customerId} upgraded from ${previousTier} to ${qualifiedTier} (Spend: LKR ${account.annual_spend})`
      );
    }

    await account.save({ transaction: t });

    return {
      customer_id: customerId,
      points_earned: pointsEarned,
      new_points_balance: account.points_balance,
      tier: account.tier,
      tier_upgraded: tierUpgraded,
      previous_tier: previousTier,
      annual_spend: Number(account.annual_spend),
      metadata,
    };
  });
};

/**
 * Evaluates quarterly tier downgrades enforcing the 2-quarter grace period rule (AC3 / Appendix I).
 *
 * Rules:
 *  - Silver accounts are never downgraded.
 *  - Gold requires LKR 25,000 annual spend.
 *  - Platinum requires LKR 50,000 annual spend.
 *  - If annual spend falls below threshold for ONE quarter: increment counter to 1, tier retained.
 *  - If annual spend falls below threshold for TWO consecutive quarters: downgrade to qualified tier, reset counter.
 *  - If spending recovers in a quarter: counter resets to 0.
 *
 * @param {Date} [auditDate=new Date()] - Timestamp of quarterly evaluation
 * @returns {Promise<object>} Summary of audited accounts, retained grace periods, and downgrades
 */
const evaluateQuarterlyDowngrades = async (auditDate = new Date()) => {
  const auditTimestamp = auditDate instanceof Date ? auditDate : new Date(auditDate);

  const nonSilverAccounts = await LoyaltyAccount.findAll({
    where: {
      tier: ['gold', 'platinum'],
    },
  });

  const report = {
    total_audited: nonSilverAccounts.length,
    maintained_active: 0,
    grace_period_retained: 0,
    downgraded: 0,
    downgrade_details: [],
  };

  await Promise.all(
    nonSilverAccounts.map(async (account) => {
      const currentTier = account.tier;
      const spend = Number(account.annual_spend) || 0;
      const threshold = TIER_THRESHOLDS[currentTier];

      if (spend >= threshold) {
        // Annual spend meets or exceeds tier benchmark -> maintain tier and clear grace counter
        account.consecutive_below_threshold_quarters = 0;
        account.last_audit_at = auditTimestamp;
        await account.save();
        report.maintained_active += 1;
      } else {
        // Annual spend fell below tier threshold
        const consecutive = (account.consecutive_below_threshold_quarters || 0) + 1;
        account.consecutive_below_threshold_quarters = consecutive;
        account.last_audit_at = auditTimestamp;

        if (consecutive >= 2) {
          // 2 consecutive quarters below threshold -> Downgrade tier per Appendix I
          const newTier = getTierForSpend(spend);
          account.tier = newTier;
          account.consecutive_below_threshold_quarters = 0;
          await account.save();

          // Sync customer profile
          await CustomerProfile.update(
            { loyalty_tier: newTier },
            { where: { user_id: account.customer_id } }
          );

          report.downgraded += 1;
          report.downgrade_details.push({
            customer_id: account.customer_id,
            previous_tier: currentTier,
            new_tier: newTier,
            annual_spend: spend,
            quarters_below: consecutive,
          });

          logger.warn(
            `[LOYALTY_SERVICE] Customer ${account.customer_id} downgraded from ${currentTier} to ${newTier} after 2 consecutive sub-threshold quarters`
          );
        } else {
          // First quarter below threshold -> Retain tier under 6-month / 2-quarter grace period
          await account.save();
          report.grace_period_retained += 1;
          logger.info(
            `[LOYALTY_SERVICE] Customer ${account.customer_id} entered 2-quarter grace period for tier ${currentTier} (Quarter 1/2)`
          );
        }
      }
    })
  );

  logger.info(
    `[LOYALTY_SERVICE] Quarterly audit complete: ${report.total_audited} audited, ${report.maintained_active} active, ${report.grace_period_retained} grace-period retained, ${report.downgraded} downgraded`
  );

  return report;
};

/**
 * Redeems points from a customer's loyalty account.
 *
 * @param {string} customerId - User UUID
 * @param {number} pointsToRedeem - Positive integer of points
 * @returns {Promise<object>} Updated balance details
 */
const redeemPoints = async (customerId, pointsToRedeem) => {
  const points = parseInt(pointsToRedeem, 10);
  if (Number.isNaN(points) || points <= 0) {
    throw ApiError.badRequest('Points to redeem must be a positive integer');
  }

  return sequelize.transaction(async (t) => {
    const account = await getOrCreateAccount(customerId, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (account.points_balance < points) {
      throw ApiError.badRequest(
        `Insufficient points balance: requested ${points} but available is ${account.points_balance}`
      );
    }

    account.points_balance -= points;
    await account.save({ transaction: t });

    logger.info(
      `[LOYALTY_SERVICE] Redeemed ${points} points for user ${customerId}. Remaining: ${account.points_balance}`
    );

    return {
      customer_id: customerId,
      points_redeemed: points,
      remaining_points: account.points_balance,
      tier: account.tier,
    };
  });
};

module.exports = {
  calculatePoints,
  getTierForSpend,
  getOrCreateAccount,
  getLoyaltyAccount,
  accruePoints,
  evaluateQuarterlyDowngrades,
  redeemPoints,
  TIER_MULTIPLIERS,
  TIER_THRESHOLDS,
};
