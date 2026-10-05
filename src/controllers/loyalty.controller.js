/* eslint-disable camelcase */
const loyaltyService = require('../services/loyalty.service');
const { successResponse } = require('../utils/responseFormatter');
const ApiError = require('../utils/ApiError');

/**
 * Controller handling loyalty rewards, tier status, and quarterly audit operations.
 */

/**
 * Retrieves the authenticated customer's loyalty account and tier benefits.
 * Route: GET /api/v1/loyalty/my-account
 */
const getMyAccount = async (req, res, next) => {
  try {
    const customerId = req.user && req.user.id;
    if (!customerId) {
      throw ApiError.unauthorized('Authentication token is required');
    }

    const result = await loyaltyService.getLoyaltyAccount(customerId);
    return successResponse(res, result, 'Loyalty account retrieved successfully');
  } catch (error) {
    return next(error);
  }
};

/**
 * Retrieves a customer's loyalty account by customer ID (Staff / Admin).
 * Route: GET /api/v1/loyalty/accounts/:id
 */
const getAccountById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await loyaltyService.getLoyaltyAccount(id);
    return successResponse(res, result, 'Loyalty account retrieved successfully');
  } catch (error) {
    return next(error);
  }
};

/**
 * Manually triggers a quarterly audit run evaluating spending and enforcing grace periods.
 * Route: POST /api/v1/loyalty/audit
 */
const triggerQuarterlyAudit = async (req, res, next) => {
  try {
    const { audit_date } = req.body || {};
    const auditDate = audit_date ? new Date(audit_date) : new Date();
    const result = await loyaltyService.evaluateQuarterlyDowngrades(auditDate);
    return successResponse(res, result, 'Quarterly loyalty audit completed successfully');
  } catch (error) {
    return next(error);
  }
};

/**
 * Redeems points from the authenticated customer's loyalty account.
 * Route: POST /api/v1/loyalty/redeem
 */
const redeemPoints = async (req, res, next) => {
  try {
    const customerId = req.user && req.user.id;
    if (!customerId) {
      throw ApiError.unauthorized('Authentication token is required');
    }

    const { points } = req.body || {};
    const result = await loyaltyService.redeemPoints(customerId, points);
    return successResponse(res, result, 'Points redeemed successfully');
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getMyAccount,
  getAccountById,
  triggerQuarterlyAudit,
  redeemPoints,
};
