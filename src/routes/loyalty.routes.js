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
 * @route   POST /api/v1/loyalty/audit
 * @desc    Trigger quarterly audit sweep enforcing 2-quarter grace period
 * @access  Private (Admin)
 */
router.post('/audit', authenticate, authorize(ROLES.ADMIN), loyaltyController.triggerQuarterlyAudit);

module.exports = router;
