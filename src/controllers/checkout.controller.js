const checkoutService = require('../services/checkout.service');
const reservationService = require('../services/reservation.service');
const { successResponse } = require('../utils/responseFormatter');

/**
 * Initiates checkout for guest or registered customer.
 * Creates order with pending status and locks temporary 15-minute stock hold.
 */
const initiate = async (req, res, next) => {
  try {
    const userId = req.user ? req.user.id : null;
    const checkoutData = {
      ...req.body,
      userId,
    };

    const result = await checkoutService.initiateCheckout(checkoutData);
    return successResponse(res, result, 'Checkout initiated successfully', 201);
  } catch (error) {
    return next(error);
  }
};

/**
 * Initiates temporary 15-minute stock reservation during checkout.
 */
const reserve = async (req, res, next) => {
  try {
    const userId = req.user ? req.user.id : null;
    const { order_id: orderId, items, variant_id: variantId, quantity } = req.body;

    const result = await reservationService.reserveStock({
      orderId,
      userId,
      items,
      variant_id: variantId,
      quantity,
    });

    return successResponse(res, result, 'Stock reserved successfully for 15 minutes', 200);
  } catch (error) {
    return next(error);
  }
};

/**
 * Releases a temporary reservation immediately.
 */
const release = async (req, res, next) => {
  try {
    const { reservationId } = req.params;
    await reservationService.releaseReservation(reservationId);
    return successResponse(res, null, 'Reservation released successfully', 200);
  } catch (error) {
    return next(error);
  }
};

/**
 * Confirms a temporary reservation permanently upon payment success.
 */
const confirm = async (req, res, next) => {
  try {
    const { reservationId } = req.params;
    await reservationService.confirmReservation(reservationId);
    return successResponse(res, null, 'Reservation confirmed permanently', 200);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  initiate,
  reserve,
  release,
  confirm,
};
