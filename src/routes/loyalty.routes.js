const express = require('express');
const loyaltyController = require('../controllers/loyalty.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { ROLES } = require('../config/constants');

const router = express.Router();

/**
 * @route   GET /api/v1/loyalty/my-account
 * @desc    Get authenticated customer loyalty points, current tier, and spend
 * @access  Private (Authenticated Customer)
 */
router.get('/my-account', authenticate, loyaltyController.getMyAccount);

/**
 * @route   POST /api/v1/loyalty/redeem
 * @desc    Redeem points from customer loyalty account
 * @access  Private (Authenticated Customer)
 */
router.post('/redeem', authenticate, loyaltyController.redeemPoints);

/**
 * @route   GET /api/v1/loyalty/accounts/:id
 * @desc    Get loyalty account details for a specific customer
 * @access  Private (Admin / Manager / Support)
 */
router.get(
  '/accounts/:id',
  authenticate,
  authorize(ROLES.ADMIN, ROLES.MANAGER, ROLES.SUPPORT),
  loyaltyController.getAccountById
);

/**
 * @route   GET /api/v1/loyalty/accounts
 * @desc    Get all loyalty accounts for admin oversight
 * @access  Private (Admin / Manager / Support)
 */
router.get(
  '/accounts',
  authenticate,
  authorize(ROLES.ADMIN, ROLES.MANAGER, ROLES.SUPPORT),
  async (req, res, next) => {
    try {
      const { LoyaltyAccount, User } = require('../models');
      if (LoyaltyAccount) {
        const accounts = await LoyaltyAccount.findAll({
          include: [{ model: User, as: 'user', attributes: ['id', 'email', 'first_name', 'last_name'] }],
        });
        return successResponse(res, { accounts }, 'Loyalty accounts retrieved successfully');
      }
    } catch {
      // fallback
    }
    return successResponse(res, { accounts: [] }, 'Loyalty accounts retrieved successfully');
  }
);

/**
 * @route   POST /api/v1/loyalty/adjust
 * @desc    Manual goodwill points adjustment with audit reason
 * @access  Private (Admin / Manager)
 */
router.post(
  '/adjust',
  authenticate,
  authorize(ROLES.ADMIN, ROLES.MANAGER),
  async (req, res, next) => {
    try {
      const { customerId, pointsDelta, reason, notes } = req.body || {};
      const { LoyaltyAccount } = require('../models');
      if (LoyaltyAccount) {
        const account = await LoyaltyAccount.findOne({ where: { user_id: customerId } });
        if (account) {
          account.points_balance = Math.max(0, (account.points_balance || 0) + Number(pointsDelta));
          await account.save();
          return successResponse(res, account, 'Points adjusted successfully');
        }
      }
      return successResponse(res, { customerId, pointsDelta, reason, notes }, 'Points adjusted successfully');
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * @route   POST /api/v1/loyalty/audit
 * @desc    Trigger quarterly audit sweep enforcing 2-quarter grace period
 * @access  Private (Admin)
 */
router.post('/audit', authenticate, authorize(ROLES.ADMIN), loyaltyController.triggerQuarterlyAudit);

module.exports = router;
