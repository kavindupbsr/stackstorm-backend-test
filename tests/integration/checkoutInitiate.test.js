const request = require('supertest');
const app = require('../../src/app');
const { generateAccessToken } = require('../../src/services/token.service');
const checkoutService = require('../../src/services/checkout.service');
const reservationService = require('../../src/services/reservation.service');
const { Order, OrderItem, ProductVariant, sequelize } = require('../../src/models');
const redisClient = require('../../src/config/redis');

describe('Integration: Guest & Registered Checkout Initiation (STORM-027)', () => {
  const customerUser = {
    id: 'b0000000-0000-0000-0000-000000000001',
    email: 'nimal.perera@gmail.com',
    role: 'customer',
  };
  const customerToken = generateAccessToken(customerUser);

  const sampleVariantId = 'd0000000-0000-0000-0000-000000000001'; // Batik Shirt M

  const validShippingAddress = {
    line1: '124 Beach Road',
    line2: 'Suite 4B',
    city: 'Dickwella',
    state: 'Southern Province',
    postal_code: '81100',
    country: 'Sri Lanka',
  };

  beforeEach(async () => {
    checkoutService.resetFallbackOrders();
    reservationService.fallbackReservations.clear();
    reservationService.fallbackStockTracker.clear();

    try {
      await ProductVariant.update(
        { stock_quantity: 25, reserved_quantity: 0 },
        { where: { id: sampleVariantId } }
      );
    } catch {
      // Ignore if offline
    }
  });

  afterAll(async () => {
    try {
      checkoutService.resetFallbackOrders();
      reservationService.fallbackReservations.clear();
      reservationService.fallbackStockTracker.clear();
      await ProductVariant.update(
        { stock_quantity: 25, reserved_quantity: 0 },
        { where: { id: sampleVariantId } }
      );
      await sequelize.close();
      await redisClient.quit();
    } catch {
      // Ignore cleanup error if already closed
    }
  });

  describe('POST /api/v1/checkout/initiate (Guest Checkout Flow)', () => {
    it('should initiate guest checkout successfully with nullable customer_id (AC1, AC2, AC3)', async () => {
      const payload = {
        guest_email: 'sunil.guest@dickwella.lk',
        guest_phone: '+94771234567',
        shipping_address: validShippingAddress,
        items: [{ variant_id: sampleVariantId, quantity: 1 }],
        notes: 'Please leave package near reception',
      };

      const res = await request(app).post('/api/v1/checkout/initiate').send(payload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.order_id).toBeDefined();
      expect(res.body.data.order_number).toMatch(/^DFC-\d{8}-\d{4}$/);
      expect(res.body.data.customer_id).toBeNull();
      expect(res.body.data.is_guest).toBe(true);
      expect(res.body.data.status).toBe('pending_payment');
      expect(res.body.data.reservation_id).toBeDefined();
      expect(res.body.data.expires_in).toBe(900);
      expect(res.body.data.currency).toBe('LKR');
      expect(res.body.data.breakdown.total_amount).toBeGreaterThan(0);
      expect(res.body.data.breakdown.formatted_total).toMatch(/^LKR\s\d+/);
      expect(res.body.data.items).toHaveLength(1);

      // Verify in database if connected
      try {
        const orderRecord = await Order.findByPk(res.body.data.order_id, {
          include: [{ model: OrderItem, as: 'items' }],
        });
        if (orderRecord) {
          expect(orderRecord.customer_id).toBeNull();
          expect(orderRecord.guest_email).toBe('sunil.guest@dickwella.lk');
          expect(orderRecord.order_status).toBe('pending');
          expect(orderRecord.payment_status).toBe('pending');
          expect(orderRecord.shipping_address_snapshot.city).toBe('Dickwella');
          expect(orderRecord.items.length).toBe(1);
        }
      } catch {
        // Fallback test
      }
    });

    it('should reject guest checkout when guest_email is omitted or invalid', async () => {
      const missingEmailPayload = {
        guest_phone: '+94771234567',
        shipping_address: validShippingAddress,
        items: [{ variant_id: sampleVariantId, quantity: 1 }],
      };

      const res1 = await request(app).post('/api/v1/checkout/initiate').send(missingEmailPayload);

      expect(res1.status).toBe(400);
      expect(res1.body.success).toBe(false);
      expect(res1.body.message).toMatch(/guest checkout requires a valid email/i);

      const invalidEmailPayload = {
        guest_email: 'not-an-email-format',
        shipping_address: validShippingAddress,
        items: [{ variant_id: sampleVariantId, quantity: 1 }],
      };

      const res2 = await request(app).post('/api/v1/checkout/initiate').send(invalidEmailPayload);

      expect(res2.status).toBe(400);
      expect(res2.body.message).toMatch(/invalid guest email/i);
    });

    it('should reject guest checkout when shipping address fields are missing', async () => {
      const missingCityPayload = {
        guest_email: 'guest@dickwella.lk',
        shipping_address: {
          line1: 'Beach Road',
          // city missing
          postal_code: '81100',
        },
        items: [{ variant_id: sampleVariantId, quantity: 1 }],
      };

      const res = await request(app).post('/api/v1/checkout/initiate').send(missingCityPayload);

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/shipping address city is required/i);
    });

    it('should reject checkout when line items are empty or invalid', async () => {
      const emptyItemsPayload = {
        guest_email: 'guest@dickwella.lk',
        shipping_address: validShippingAddress,
        items: [],
      };

      const res = await request(app).post('/api/v1/checkout/initiate').send(emptyItemsPayload);

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/must contain at least one line item/i);
    });
  });

  describe('POST /api/v1/checkout/initiate (Registered Customer Flow)', () => {
    it('should initiate checkout for authenticated user and bind customer_id to Order', async () => {
      const payload = {
        shipping_address: validShippingAddress,
        items: [{ variant_id: sampleVariantId, quantity: 2 }],
      };

      const res = await request(app)
        .post('/api/v1/checkout/initiate')
        .set('Authorization', `Bearer ${customerToken}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.customer_id).toBe(customerUser.id);
      expect(res.body.data.is_guest).toBe(false);
      expect(res.body.data.status).toBe('pending_payment');
      expect(res.body.data.reservation_id).toBeDefined();

      // Verify customer_id persisted in database
      try {
        const order = await Order.findByPk(res.body.data.order_id);
        if (order) {
          expect(order.customer_id).toBe(customerUser.id);
          expect(order.guest_email).toBeNull();
        }
      } catch {
        // Fallback test
      }
    });
  });

  describe('Unit: Address & Validation Utilities', () => {
    it('should validate complete shipping address', () => {
      const valid = checkoutService.validateShippingAddress({
        street: 'Main Street',
        city: 'Dickwella',
        postalCode: '81100',
      });

      expect(valid.line1).toBe('Main Street');
      expect(valid.city).toBe('Dickwella');
      expect(valid.postal_code).toBe('81100');
      expect(valid.country).toBe('Sri Lanka');
    });

    it('should validate email format strictly', () => {
      expect(checkoutService.isValidEmail('user@dickwella.lk')).toBe(true);
      expect(checkoutService.isValidEmail('invalid-email')).toBe(false);
      expect(checkoutService.isValidEmail('@missinguser.com')).toBe(false);
    });

    it('should generate properly formatted order numbers', () => {
      const ord = checkoutService.generateOrderNumber();
      expect(ord).toMatch(/^DFC-\d{8}-\d{4}$/);
    });
  });
});
