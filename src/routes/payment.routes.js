const express = require('express');
const paymentController = require('../controllers/payment.controller');

const router = express.Router();

/**
 * @route   POST /api/v1/payments/create-intent
 * @desc    Generate a Stripe PaymentIntent for order amount in LKR
 * @access  Public (Guest or Authenticated)
 */
router.post('/create-intent', paymentController.createPaymentIntent);

/**
 * @route   POST /api/v1/payments/webhook
 * @desc    Idempotent Stripe Webhook endpoint verifying HMAC-SHA256 signature
 * @access  Public (Called by Stripe servers)
 */
router.post('/webhook', paymentController.handleWebhook);

module.exports = router;
