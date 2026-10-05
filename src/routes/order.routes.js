const express = require('express');
const orderController = require('../controllers/order.controller');
const authenticate = require('../middleware/authenticate');
const optionalAuthenticate = require('../middleware/optionalAuthenticate');

const router = express.Router();

/**
 * @route   GET /api/v1/orders/my-orders
 * @desc    Get paginated order history for the authenticated customer
 * @access  Private (Authenticated Customer)
 */
router.get('/my-orders', authenticate, orderController.getMyOrders);
router.get('/', authenticate, orderController.getMyOrders);

/**
 * @route   GET /api/v1/orders/:id/track
 * @desc    Get real-time delivery tracking milestone history for an order
 * @access  Private (Authenticated Customer)
 */
router.get('/:id/track', authenticate, orderController.trackOrder);
router.get('/:id/tracking', authenticate, orderController.trackOrder);

/**
 * @route   GET /api/v1/orders/:id
 * @desc    Get order details, items, invoice number, and payment status
 * @access  Public (Guest or Authenticated Customer)
 */
router.get('/:id', optionalAuthenticate, orderController.getOrderById);

/**
 * @route   POST /api/v1/orders/:id/finalize
 * @desc    Finalize order line items, deduct stock, and generate invoice
 * @access  Public (or webhook/admin callback)
 */
router.post('/:id/finalize', orderController.finalizeOrder);

module.exports = router;
