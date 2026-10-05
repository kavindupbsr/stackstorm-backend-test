/* eslint-disable camelcase */
const returnService = require('../services/return.service');
const { successResponse } = require('../utils/responseFormatter');
const ApiError = require('../utils/ApiError');

/**
 * Controller handling Return & Exchange workflows (Issue #8 / FR-021).
 */

/**
 * Customer submits a return for refund or size exchange request.
 * Route: POST /api/v1/returns
 */
const requestReturn = async (req, res, next) => {
  try {
    const userId = req.user && req.user.id;
    const { order_item_id, orderItemId, type, exchange_variant_id, exchangeVariantId, reason } =
      req.body || {};

    const targetOrderItemId = order_item_id || orderItemId;
    const targetExchangeVariantId = exchange_variant_id || exchangeVariantId;

    const result = await returnService.requestReturn({
      userId,
      order_item_id: targetOrderItemId,
      type: type || 'return',
      exchange_variant_id: targetExchangeVariantId,
      reason,
    });

    return successResponse(res, result, 'Return request submitted successfully', 201);
  } catch (error) {
    return next(error);
  }
};

/**
 * Customer or Admin retrieves a specific return record by ID.
 * Route: GET /api/v1/returns/:id
 */
const getReturn = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await returnService.getReturnById(id, req.user);
    return successResponse(res, result, 'Return details retrieved successfully');
  } catch (error) {
    return next(error);
  }
};

/**
 * Customer retrieves their submitted return requests.
 * Route: GET /api/v1/returns/my-returns
 */
const getMyReturns = async (req, res, next) => {
  try {
    const userId = req.user && req.user.id;
    if (!userId) {
      throw ApiError.unauthorized('Authentication token is required');
    }

    const { page, limit, status } = req.query;
    const result = await returnService.getUserReturns(userId, { page, limit, status });
    return successResponse(res, result, 'Customer returns retrieved successfully');
  } catch (error) {
    return next(error);
  }
};

/**
 * Admin / Support Staff lists all platform return requests.
 * Route: GET /api/v1/returns, GET /api/v1/admin/returns
 */
const listAllReturns = async (req, res, next) => {
  try {
    const { page, limit, status, type } = req.query;
    const result = await returnService.getAllReturns({ page, limit, status, type });
    return successResponse(res, result, 'Platform returns retrieved successfully');
  } catch (error) {
    return next(error);
  }
};

/**
 * Admin approves a return or exchange request.
 * Route: PATCH /api/v1/returns/:id/approve or PATCH /api/v1/admin/returns/:id/approve
 */
const approveReturn = async (req, res, next) => {
  try {
    const { id } = req.params;
    const adminId = req.user && req.user.id;
    const result = await returnService.approveReturn(id, adminId);
    return successResponse(res, result, 'Return request approved successfully');
  } catch (error) {
    return next(error);
  }
};

/**
 * Admin rejects a return or exchange request.
 * Route: PATCH /api/v1/returns/:id/reject or PATCH /api/v1/admin/returns/:id/reject
 */
const rejectReturn = async (req, res, next) => {
  try {
    const { id } = req.params;
    const adminId = req.user && req.user.id;
    const { reason } = req.body || {};
    const result = await returnService.rejectReturn(id, adminId, reason);
    return successResponse(res, result, 'Return request rejected successfully');
  } catch (error) {
    return next(error);
  }
};

/**
 * Unified status update endpoint adhering to SDS §11.3 state transitions.
 * Route: PATCH /api/v1/returns/:id
 */
const updateReturnStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { action, status, reason } = req.body || {};
    const actionType = action || status;

    if (actionType === 'approve' || actionType === 'approved') {
      const result = await returnService.approveReturn(id, req.user && req.user.id);
      return successResponse(res, result, 'Return request approved successfully');
    }

    if (actionType === 'reject' || actionType === 'rejected') {
      const result = await returnService.rejectReturn(id, req.user && req.user.id, reason);
      return successResponse(res, result, 'Return request rejected successfully');
    }

    throw ApiError.badRequest(`Unsupported return update action: ${actionType}`);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  requestReturn,
  getReturn,
  getMyReturns,
  listAllReturns,
  approveReturn,
  rejectReturn,
  updateReturnStatus,
};
