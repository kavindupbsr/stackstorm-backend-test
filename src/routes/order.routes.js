const express = require('express');
const orderController = require('../controllers/order.controller');
const optionalAuthenticate = require('../middleware/optionalAuthenticate');

const router = express.Router();

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
