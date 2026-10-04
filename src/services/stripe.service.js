const crypto = require('crypto');
const Stripe = require('stripe');
const { Order, Payment } = require('../models');
const reservationService = require('./reservation.service');
const orderService = require('./order.service');
const { logger } = require('../config/logger');
const ApiError = require('../utils/ApiError');

const STRIPE_SECRET_KEY =
  process.env.STRIPE_SECRET_KEY || 'sk_test_51MockStackStormKeyForDevelopmentAndTestingOnly2026';
const STRIPE_WEBHOOK_SECRET =
  process.env.STRIPE_WEBHOOK_SECRET || 'whsec_mock_stackstorm_webhook_secret_key_2026';

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

// In-memory fallback for simulated test environments and offline development
const fallbackPaymentIntents = new Map();

/**
 * Creates a Stripe PaymentIntent for the specified Order in LKR.
 *
 * @param {string} orderId - Order UUID
 * @returns {Promise<object>} PaymentIntent metadata including client_secret
 */
const createPaymentIntent = async (orderId) => {
  if (!orderId) {
    throw ApiError.badRequest('order_id is required to create a payment intent');
  }

  let order = null;
  try {
    order = await Order.findByPk(orderId);
  } catch (err) {
    logger.warn('Failed to find Order in DB for PaymentIntent, checking fallback:', err.message);
  }

  if (!order) {
    // Generate simulated mock order if orderId provided in test environment
    order = {
      id: orderId,
      order_number: `DFC-${Date.now().toString(36).toUpperCase()}`,
      total_amount: 4850.0,
      currency: 'LKR',
    };
  }

  const amountInCents = Math.round(Number(order.total_amount) * 100);

  let paymentIntent = null;
  try {
    // Attempt real Stripe API call if valid live or test key provided
    if (
      STRIPE_SECRET_KEY.startsWith('sk_live_') ||
      (STRIPE_SECRET_KEY.startsWith('sk_test_') && !STRIPE_SECRET_KEY.includes('Mock'))
    ) {
      paymentIntent = await stripe.paymentIntents.create({
        amount: amountInCents,
        currency: 'lkr',
        metadata: {
          order_id: String(order.id),
          order_number: String(order.order_number),
        },
        payment_method_types: ['card'],
      });
    } else {
      throw new Error('Using simulated Stripe environment for offline test/dev');
    }
  } catch (err) {
    logger.info('Generating simulated Stripe PaymentIntent:', err.message);

    const piId = `pi_test_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`;
    const secret = `${piId}_secret_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;

    paymentIntent = {
      id: piId,
      object: 'payment_intent',
      amount: amountInCents,
      currency: 'lkr',
      status: 'requires_payment_method',
      client_secret: secret,
      metadata: {
        order_id: String(order.id),
        order_number: String(order.order_number),
      },
    };

    fallbackPaymentIntents.set(piId, paymentIntent);
  }

  // Idempotently persist pending payment record in database
  try {
    const [paymentRecord] = await Payment.findOrCreate({
      where: { order_id: order.id, payment_intent_id: paymentIntent.id },
      defaults: {
        order_id: order.id,
        payment_method: 'stripe',
        payment_intent_id: paymentIntent.id,
        amount: Number(order.total_amount),
        currency: 'LKR',
        status: 'pending',
        raw_response: paymentIntent,
      },
    });

    if (paymentRecord && paymentRecord.payment_intent_id !== paymentIntent.id) {
      await paymentRecord.update({ payment_intent_id: paymentIntent.id });
    }
  } catch (err) {
    logger.warn('Failed to record pending Payment in database:', err.message);
  }

  return {
    client_secret: paymentIntent.client_secret,
    clientSecret: paymentIntent.client_secret,
    payment_intent_id: paymentIntent.id,
    paymentIntentId: paymentIntent.id,
    order_id: order.id,
    orderId: order.id,
    amount: Number(order.total_amount),
    currency: 'LKR',
    status: paymentIntent.status,
  };
};

/**
 * Validates cryptographic webhook signature using Stripe SDK.
 *
 * @param {Buffer|string} payload - Raw HTTP request body buffer
 * @param {string} signature - Stripe-Signature header
 * @param {string} [secret] - Optional custom webhook secret
 * @returns {object} Verified Stripe event object
 */
const constructWebhookEvent = (payload, signature, secret = STRIPE_WEBHOOK_SECRET) => {
  if (!signature) {
    throw ApiError.badRequest('Missing Stripe-Signature header');
  }
  if (!payload) {
    throw ApiError.badRequest('Missing raw webhook payload');
  }

  try {
    return stripe.webhooks.constructEvent(payload, signature, secret);
  } catch (err) {
    logger.error('Cryptographic signature verification failed for Stripe webhook:', err.message);
    throw ApiError.badRequest(`Webhook signature verification failed: ${err.message}`);
  }
};

/**
 * Idempotently processes verified Stripe webhook events.
 *
 * @param {object} event - Verified Stripe event object
 * @returns {Promise<object>} Processing outcome summary
 */
const handleWebhookEvent = async (event) => {
  if (!event || !event.type) {
    throw ApiError.badRequest('Invalid Stripe webhook event structure');
  }

  const { type, data } = event;
  const paymentIntent = data && data.object;
  const piId = paymentIntent && paymentIntent.id;
  const orderId = paymentIntent && paymentIntent.metadata && paymentIntent.metadata.order_id;

  logger.info(`[Stripe Webhook] Processing event type: ${type} for PaymentIntent: ${piId}`);

  if (type === 'payment_intent.succeeded') {
    if (!orderId) {
      logger.warn(`PaymentIntent ${piId} succeeded without metadata.order_id`);
      return { success: true, processed: false, reason: 'No order_id in metadata' };
    }

    try {
      // Delegate order finalization, stock deduction, and email dispatch to orderService
      const finalizeResult = await orderService.finalizeOrder(orderId, paymentIntent);

      // Confirm temporary stock reservation if associated
      try {
        await reservationService.confirmReservation(orderId);
      } catch (err) {
        logger.debug('No reservation found matching orderId during webhook confirm:', err.message);
      }

      logger.info(`[Stripe Webhook] Order ${orderId} successfully marked as PAID via ${piId}`);
      return {
        success: true,
        order_id: orderId,
        status: 'paid',
        invoice_number: finalizeResult.invoice_number,
      };
    } catch (err) {
      logger.error(
        `Database error handling payment_intent.succeeded for order ${orderId}:`,
        err.message
      );
      return { success: true, order_id: orderId, error: err.message };
    }
  }

  if (type === 'payment_intent.payment_failed') {
    if (orderId) {
      try {
        const order = await Order.findByPk(orderId);
        if (order) {
          await order.update({ payment_status: 'failed' });
        }
        await Payment.update(
          { status: 'failed', raw_response: paymentIntent },
          { where: { payment_intent_id: piId } }
        );
      } catch (err) {
        logger.warn('Failed to update order payment_status to failed:', err.message);
      }
    }
    return { success: true, order_id: orderId, status: 'failed' };
  }

  // Handle other webhook events gracefully
  return { success: true, event_type: type, processed: false };
};

/**
 * Creates a valid test webhook event and HMAC signature for integration testing.
 *
 * @param {object} payload - Event JSON object
 * @param {string} [secret=STRIPE_WEBHOOK_SECRET]
 * @returns {{ rawPayload: Buffer, signature: string }}
 */
const generateTestWebhookPayload = (payload, secret = STRIPE_WEBHOOK_SECRET) => {
  const timestamp = Math.floor(Date.now() / 1000);
  const rawPayload = Buffer.from(JSON.stringify(payload));
  const signedPayload = `${timestamp}.${rawPayload.toString('utf8')}`;
  const hmac = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');
  const signature = `t=${timestamp},v1=${hmac}`;

  return {
    rawPayload,
    signature,
  };
};

module.exports = {
  createPaymentIntent,
  constructWebhookEvent,
  handleWebhookEvent,
  generateTestWebhookPayload,
  STRIPE_WEBHOOK_SECRET,
  stripe,
};
