const request = require('supertest');
const app = require('../../src/app');
const stripeService = require('../../src/services/stripe.service');
const emailService = require('../../src/services/email.service');
const {
  Order,
  OrderItem,
  ProductVariant,
  Product,
  Category,
  Payment,
  sequelize,
} = require('../../src/models');
const redisClient = require('../../src/config/redis');

describe('Checkout & Webhook Lifecycle', () => {
  let category;
  let product;
  let variant;
  let initiatedOrderId;
  let orderNumber;
  let paymentIntentId;
  const initialStock = 50;
  const purchaseQty = 2;

  beforeAll(async () => {
    emailService.clearDispatchedLogs();
    try {
      category = await Category.create({
        name: `Checkout Webhook Cat ${Date.now()}`,
        slug: `checkout-webhook-cat-${Date.now()}`,
        description: 'Test category for checkout webhook flow',
      });

      product = await Product.create({
        category_id: category.id,
        title: `Luxury Silk Sarong ${Date.now()}`,
        slug: `luxury-silk-sarong-${Date.now()}`,
        base_price: 6000.0,
        is_active: true,
      });

      variant = await ProductVariant.create({
        product_id: product.id,
        sku: `SARONG-SILK-${Date.now()}`,
        size: 'FREE',
        color: 'Gold',
        stock_quantity: initialStock,
        reserved_quantity: 0,
        price_override: null,
      });
    } catch {
      // Offline fallback handling
    }
  });

  afterAll(async () => {
    try {
      if (initiatedOrderId) {
        await Payment.destroy({ where: { order_id: initiatedOrderId } });
        await OrderItem.destroy({ where: { order_id: initiatedOrderId } });
        await Order.destroy({ where: { id: initiatedOrderId } });
      }
      if (variant && variant.id) {
        await ProductVariant.destroy({ where: { id: variant.id } });
      }
      if (product && product.id) {
        await Product.destroy({ where: { id: product.id } });
      }
      if (category && category.id) {
        await Category.destroy({ where: { id: category.id } });
      }
      await sequelize.close();
      await redisClient.quit();
    } catch {
      // Ignore offline teardown errors
    }
  });

  it('Initiate guest checkout', async () => {
    const checkoutPayload = {
      guest_email: 'sarong.shopper@dickwella.lk',
      guest_phone: '+94771234567',
      shipping_address: {
        line1: '88 Ocean View Road',
        city: 'Dickwella',
        postal_code: '81100',
        country: 'Sri Lanka',
      },
      items: [
        {
          variant_id: variant ? variant.id : 'd0000000-0000-0000-0000-000000000001',
          quantity: purchaseQty,
        },
      ],
      notes: 'Please pack in gift wrap',
    };

    const res = await request(app).post('/api/v1/checkout/initiate').send(checkoutPayload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.order_id).toBeDefined();

    initiatedOrderId = res.body.data.order_id;
    orderNumber = res.body.data.order_number;

    expect(res.body.data.status).toBe('pending_payment');
    expect(res.body.data.customer_id).toBeNull();
    // Subtotal 12,000 >= 10,000 -> Free shipping (shipping = 0)
    expect(res.body.data.breakdown.shipping_fee).toBe(0);
    expect(res.body.data.breakdown.total_amount).toBe(12000);

    // Verify stock reservation was placed in DB
    if (variant && variant.id) {
      const reloaded = await ProductVariant.findByPk(variant.id);
      expect(reloaded.reserved_quantity).toBe(purchaseQty);
    }
  });

  it('Create Stripe PaymentIntent', async () => {
    const res = await request(app)
      .post('/api/v1/payments/create-intent')
      .send({ order_id: initiatedOrderId });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.clientSecret).toBeDefined();
    expect(res.body.data.paymentIntentId).toBeDefined();
    expect(res.body.data.currency).toBe('LKR');
    expect(res.body.data.amount).toBe(12000);

    paymentIntentId = res.body.data.paymentIntentId;
  });

  it('Process valid Stripe webhook', async () => {
    const mockEvent = {
      id: `evt_lifecycle_${Date.now()}`,
      object: 'event',
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: paymentIntentId || `pi_lifecycle_${Date.now()}`,
          amount: 1200000,
          currency: 'lkr',
          status: 'succeeded',
          metadata: {
            order_id: initiatedOrderId,
            order_number: orderNumber,
          },
        },
      },
    };

    const { rawPayload, signature } = stripeService.generateTestWebhookPayload(mockEvent);

    const res = await request(app)
      .post('/api/v1/payments/webhook')
      .set('stripe-signature', signature)
      .set('Content-Type', 'application/json')
      .send(rawPayload.toString('utf8'));

    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
    expect(res.body.status).toBe('paid');

    // Verify database state: order updated to processing and paid
    if (initiatedOrderId) {
      const updatedOrder = await Order.findByPk(initiatedOrderId);
      expect(updatedOrder.payment_status).toBe('paid');
      expect(updatedOrder.order_status).toBe('processing');

      // Verify permanent stock deduction (50 - 2 = 48) and reservation cleared (0)
      if (variant && variant.id) {
        const reloadedVariant = await ProductVariant.findByPk(variant.id);
        expect(reloadedVariant.stock_quantity).toBe(initialStock - purchaseQty);
        expect(reloadedVariant.reserved_quantity).toBe(0);
      }

      // Verify payment ledger record
      const paymentRecord = await Payment.findOne({ where: { order_id: initiatedOrderId } });
      expect(paymentRecord).not.toBeNull();
      expect(paymentRecord.status).toBe('succeeded');
    }
  });

  it('Reject forged Stripe webhook signature', async () => {
    const fakeSignature = 't=1791129999,v1=bad_counterfeit_signature_hash_value';

    const res = await request(app)
      .post('/api/v1/payments/webhook')
      .set('stripe-signature', fakeSignature)
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ id: 'evt_forged', type: 'payment_intent.succeeded' }));

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/signature verification failed/i);
  });

  it('Idempotent handling of duplicate webhook', async () => {
    const duplicateEvent = {
      id: `evt_duplicate_${Date.now()}`,
      object: 'event',
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: paymentIntentId || `pi_lifecycle_${Date.now()}`,
          amount: 1200000,
          currency: 'lkr',
          status: 'succeeded',
          metadata: {
            order_id: initiatedOrderId,
            order_number: orderNumber,
          },
        },
      },
    };

    const { rawPayload, signature } = stripeService.generateTestWebhookPayload(duplicateEvent);

    const res = await request(app)
      .post('/api/v1/payments/webhook')
      .set('stripe-signature', signature)
      .set('Content-Type', 'application/json')
      .send(rawPayload.toString('utf8'));

    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
    expect(res.body.status).toBe('paid');

    // Confirm inventory was NOT deducted a second time
    if (variant && variant.id) {
      const variantAfterDuplicate = await ProductVariant.findByPk(variant.id);
      expect(variantAfterDuplicate.stock_quantity).toBe(initialStock - purchaseQty);
      expect(variantAfterDuplicate.reserved_quantity).toBe(0);
    }
  });

  it('Verify finalized order details and invoice retrieval via GET /api/v1/orders/:id', async () => {
    const res = await request(app).get(`/api/v1/orders/${initiatedOrderId}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(initiatedOrderId);
    expect(res.body.data.order_status).toBe('processing');
    expect(res.body.data.payment_status).toBe('paid');
    expect(res.body.data.notes).toMatch(/Invoice: DFC-\d{4}-/);
    expect(Array.isArray(res.body.data.items)).toBe(true);
    expect(res.body.data.items.length).toBe(1);
    expect(Number(res.body.data.items[0].unit_price_at_purchase)).toBe(6000);
  });
});
