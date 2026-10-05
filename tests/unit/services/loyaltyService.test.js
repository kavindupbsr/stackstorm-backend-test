const loyaltyService = require('../../../src/services/loyalty.service');
const {
  User,
  CustomerProfile,
  LoyaltyAccount,
  sequelize,
} = require('../../../src/models');
const redisClient = require('../../../src/config/redis');

describe('Unit: Loyalty Tier Accrual & 2-Quarter Grace Period (STORM-039 / Issue #6)', () => {
  let customerUser1;
  let customerUser2;

  beforeAll(async () => {
    try {
      const ts = Date.now();

      // Create users
      customerUser1 = await User.create({
        email: `loyalty-cust-1-${ts}@example.lk`,
        password_hash: '$2b$10$hashedpassloyaltytest000000000000001',
        first_name: 'Pabasara',
        last_name: 'Loyal',
        role: 'customer',
      });

      customerUser2 = await User.create({
        email: `loyalty-cust-2-${ts}@example.lk`,
        password_hash: '$2b$10$hashedpassloyaltytest000000000000002',
        first_name: 'Amara',
        last_name: 'Shopper',
        role: 'customer',
      });

      await CustomerProfile.create({
        user_id: customerUser1.id,
        loyalty_tier: 'silver',
      });

      await CustomerProfile.create({
        user_id: customerUser2.id,
        loyalty_tier: 'silver',
      });
    } catch (err) {
      console.warn('Loyalty unit test fixture warning:', err.message);
    }
  });

  afterAll(async () => {
    try {
      if (customerUser1) {
        await LoyaltyAccount.destroy({ where: { customer_id: customerUser1.id } });
        await CustomerProfile.destroy({ where: { user_id: customerUser1.id } });
        await User.destroy({ where: { id: customerUser1.id } });
      }
      if (customerUser2) {
        await LoyaltyAccount.destroy({ where: { customer_id: customerUser2.id } });
        await CustomerProfile.destroy({ where: { user_id: customerUser2.id } });
        await User.destroy({ where: { id: customerUser2.id } });
      }

      await sequelize.close();
      await redisClient.quit();
    } catch {
      // Ignore cleanup error
    }
  });

  describe('Tier Points Multipliers & Mathematical Accrual (AC1)', () => {
    it('Gold customer spending LKR 10,000 earns exactly 150 loyalty points (Shift-Left & AC1)', () => {
      const points = loyaltyService.calculatePoints(10000, 'gold');
      expect(points).toBe(150);
    });

    it('Silver customer spending LKR 10,000 earns exactly 100 loyalty points (1.0x)', () => {
      const points = loyaltyService.calculatePoints(10000, 'silver');
      expect(points).toBe(100);
    });

    it('Platinum customer spending LKR 10,000 earns exactly 200 loyalty points (2.0x)', () => {
      const points = loyaltyService.calculatePoints(10000, 'platinum');
      expect(points).toBe(200);
    });

    it('should return 0 points for zero or invalid spend', () => {
      expect(loyaltyService.calculatePoints(0, 'gold')).toBe(0);
      expect(loyaltyService.calculatePoints(-500, 'platinum')).toBe(0);
      expect(loyaltyService.calculatePoints('invalid', 'silver')).toBe(0);
    });
  });

  describe('Spending Thresholds & Immediate Promotions (AC2)', () => {
    it('correctly maps annual spend thresholds to qualifying tiers', () => {
      expect(loyaltyService.getTierForSpend(0)).toBe('silver');
      expect(loyaltyService.getTierForSpend(24999)).toBe('silver');
      expect(loyaltyService.getTierForSpend(25000)).toBe('gold');
      expect(loyaltyService.getTierForSpend(49999)).toBe('gold');
      expect(loyaltyService.getTierForSpend(50000)).toBe('platinum');
      expect(loyaltyService.getTierForSpend(120000)).toBe('platinum');
    });

    it('immediately promotes customer to Gold upon passing LKR 25,000 threshold (AC2)', async () => {
      const result = await loyaltyService.accruePoints(customerUser1.id, 28000, {
        orderNumber: 'ORD-PROMO-001',
      });

      expect(result.tier).toBe('gold');
      expect(result.tier_upgraded).toBe(true);
      expect(result.previous_tier).toBe('silver');
      // Silver multiplier was applied for initial tier
      expect(result.points_earned).toBe(280);
      expect(result.annual_spend).toBe(28000);

      // Verify sync with CustomerProfile
      const profile = await CustomerProfile.findOne({
        where: { user_id: customerUser1.id },
      });
      expect(profile.loyalty_tier).toBe('gold');
    });

    it('immediately promotes customer to Platinum upon reaching LKR 50,000 cumulative spend', async () => {
      const result = await loyaltyService.accruePoints(customerUser1.id, 25000, {
        orderNumber: 'ORD-PROMO-002',
      });

      expect(result.tier).toBe('platinum');
      expect(result.tier_upgraded).toBe(true);
      expect(result.previous_tier).toBe('gold');
      // Gold multiplier (1.5x) applied
      expect(result.points_earned).toBe(375); // (25000 / 100) * 1.5
      expect(result.annual_spend).toBe(53000);
    });
  });

  describe('2-Quarter Grace Period Downgrade Rule (AC3 / Appendix I / Issue #6)', () => {
    it('customer spend dropping below threshold for 1 quarter is NOT downgraded (Grace Period Quarter 1)', async () => {
      // Simulate annual spend dropping to LKR 10,000 (below Gold 25k and Platinum 50k)
      const account = await loyaltyService.getOrCreateAccount(customerUser1.id);
      account.tier = 'gold';
      account.annual_spend = 10000.0;
      account.consecutive_below_threshold_quarters = 0;
      await account.save();
      await CustomerProfile.update(
        { loyalty_tier: 'gold' },
        { where: { user_id: customerUser1.id } }
      );

      const auditReport = await loyaltyService.evaluateQuarterlyDowngrades();

      const updatedAccount = await LoyaltyAccount.findByPk(customerUser1.id);
      expect(updatedAccount.tier).toBe('gold'); // Tier retained!
      expect(updatedAccount.consecutive_below_threshold_quarters).toBe(1);
      expect(auditReport.grace_period_retained).toBeGreaterThanOrEqual(1);

      const profile = await CustomerProfile.findOne({
        where: { user_id: customerUser1.id },
      });
      expect(profile.loyalty_tier).toBe('gold');
    });

    it('customer spend dropping below threshold for 2 consecutive quarters IS downgraded to Silver (AC3)', async () => {
      // Quarter 2 audit runs with spend still below threshold
      const auditReport = await loyaltyService.evaluateQuarterlyDowngrades();

      const updatedAccount = await LoyaltyAccount.findByPk(customerUser1.id);
      expect(updatedAccount.tier).toBe('silver'); // Downgraded on 2nd consecutive quarter
      expect(updatedAccount.consecutive_below_threshold_quarters).toBe(0);
      expect(auditReport.downgraded).toBeGreaterThanOrEqual(1);

      const profile = await CustomerProfile.findOne({
        where: { user_id: customerUser1.id },
      });
      expect(profile.loyalty_tier).toBe('silver');
    });

    it('spending recovery in subsequent quarter clears the grace counter', async () => {
      // User 2: set as Gold with sub-threshold spend and 1 grace strike
      const account = await loyaltyService.getOrCreateAccount(customerUser2.id);
      account.tier = 'gold';
      account.annual_spend = 15000.0;
      account.consecutive_below_threshold_quarters = 1;
      await account.save();
      await CustomerProfile.update(
        { loyalty_tier: 'gold' },
        { where: { user_id: customerUser2.id } }
      );

      // Customer recovers with new purchase of LKR 15,000 -> Total spend 30,000 (above Gold threshold)
      await loyaltyService.accruePoints(customerUser2.id, 15000);

      // Run quarterly audit
      await loyaltyService.evaluateQuarterlyDowngrades();

      const refreshed = await LoyaltyAccount.findByPk(customerUser2.id);
      expect(refreshed.tier).toBe('gold');
      expect(refreshed.consecutive_below_threshold_quarters).toBe(0); // Grace strike reset!
    });
  });

  describe('Points Redemption (FR-022)', () => {
    it('successfully redeems points when balance is sufficient', async () => {
      const account = await loyaltyService.getOrCreateAccount(customerUser2.id);
      account.points_balance = 500;
      await account.save();

      const result = await loyaltyService.redeemPoints(customerUser2.id, 200);
      expect(result.points_redeemed).toBe(200);
      expect(result.remaining_points).toBe(300);

      const updated = await LoyaltyAccount.findByPk(customerUser2.id);
      expect(updated.points_balance).toBe(300);
    });

    it('rejects points redemption when balance is insufficient', async () => {
      await expect(
        loyaltyService.redeemPoints(customerUser2.id, 1000)
      ).rejects.toThrow('Insufficient points balance');
    });
  });
});
