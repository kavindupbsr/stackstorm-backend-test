const orderService = require('../services/order.service');
const { successResponse } = require('../utils/responseFormatter');
const ApiError = require('../utils/ApiError');

/**
 * Retrieves order details by ID.
 */
const getOrderById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user ? req.user.id : null;
    const order = await orderService.getOrderById(id, userId);

    return successResponse(res, order, 'Order retrieved successfully', 200);
  } catch (error) {
    return next(error);
  }
};

/**
 * Retrieves paginated list of past orders for the authenticated customer.
 * Route: GET /api/v1/orders/my-orders
 */
const getMyOrders = async (req, res, next) => {
  try {
    const userId = req.user && req.user.id;
    if (!userId) {
      throw ApiError.unauthorized('Authentication token is required');
    }

    const result = await orderService.getCustomerOrders(userId, req.query);
    return successResponse(res, result, 'Customer orders retrieved successfully', 200);
  } catch (error) {
    return next(error);
  }
};

/**
 * Retrieves delivery milestone timeline for an order with customer ownership check.
 * Route: GET /api/v1/orders/:id/track
 */
const trackOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user && req.user.id;
    if (!userId) {
      throw ApiError.unauthorized('Authentication token is required');
    }

    const tracking = await orderService.getOrderTracking(id, userId);
    return successResponse(res, tracking, 'Order tracking details retrieved successfully', 200);
  } catch (error) {
    return next(error);
  }
};

/**
 * Finalizes an order upon payment completion.
 */
const finalizeOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const paymentDetails = req.body.payment_details || req.body;
    const result = await orderService.finalizeOrder(id, paymentDetails);

    return successResponse(res, result, 'Order finalized successfully', 200);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getOrderById,
  getMyOrders,
  trackOrder,
  finalizeOrder,
};
