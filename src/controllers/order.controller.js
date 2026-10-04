const orderService = require('../services/order.service');
const { successResponse } = require('../utils/responseFormatter');

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
  finalizeOrder,
};
