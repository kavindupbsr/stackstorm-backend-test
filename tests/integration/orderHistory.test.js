const request = require('supertest');
const app = require('../../src/app');
const { generateAccessToken } = require('../../src/services/token.service');
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

describe('Integration: Customer Order History & Delivery Tracking (STORM-033)', () => {
  const userA = {
    id: 'b0000000-0000-0000-0000-000000000003', // pabasara@example.lk
    email: 'pabasara@example.lk',
    role: 'customer',
  };

  const userB = {
    id: 'b0000000-0000-0000-0000-000000000004', // thanoo@example.lk
    email: 'thanoo@example.lk',
    role: 'customer',
  };

  const tokenA = generateAccessToken(userA);
  const tokenB = generateAccessToken(userB);

  let category;
  let product;
  let variant;
  let orderA1;
  let orderA2;
  let orderB1;

  beforeAll(async () => {
    try {
      category = await Category.create({
        name: `Tracking Cat ${Date.now()}`,
        slug: `tracking-cat-${Date.now()}`,
        description: 'Tracking test category',
      });

      product = await Product.create({
        category_id: category.id,
        title: `Linen Safari Shirt ${Date.now()}`,
        slug: `linen-safari-shirt-${Date.now()}`,
        base_price: 7500.0,
        is_active: true,
      });

      variant = await ProductVariant.create({
        product_id: product.id,
        sku: `SHIRT-SAFARI-${Date.now()}`,
        size: 'L',
        color: 'Olive Green',
        stock_quantity: 100,
        reserved_quantity: 0,
        price_override: null,
      });

      // Order 1 for User A: Processing status
      orderA1 = await Order.create({
        order_number: `DFC-TRK-A1-${Date.now()}`,
        customer_id: userA.id,
        order_status: 'processing',
        payment_status: 'paid',
        total_amount: 15000.0,
        shipping_amount: 0.0,
        discount_amount: 0.0,
        shipping_address_snapshot: {
          line1: '12 Beach Road',
          city: 'Dickwella',
          postal_code: '81100',
        },
        notes: 'Test Order A1',
      });

      await OrderItem.create({
        order_id: orderA1.id,
        product_variant_id: variant.id,
        quantity: 2,
        unit_price_at_purchase: 7500.0,
        total_price: 15000.0,
        product_title_snapshot: product.title,
        variant_sku_snapshot: variant.sku,
      });

      await Payment.create({
        order_id: orderA1.id,
        payment_method: 'stripe',
        payment_intent_id: `pi_test_${Date.now()}`,
        amount: 15000.0,
        currency: 'LKR',
        status: 'succeeded',
      });

      // Order 2 for User A: Shipped status
      orderA2 = await Order.create({
        order_number: `DFC-TRK-A2-${Date.now()}`,
        customer_id: userA.id,
        order_status: 'shipped',
        payment_status: 'paid',
        total_amount: 7500.0,
        shipping_amount: 350.0,
        discount_amount: 0.0,
        shipping_address_snapshot: {
          line1: '12 Beach Road',
          city: 'Dickwella',
          postal_code: '81100',
        },
        notes: 'Test Order A2',
      });

      await OrderItem.create({
        order_id: orderA2.id,
        product_variant_id: variant.id,
        quantity: 1,
        unit_price_at_purchase: 7500.0,
        total_price: 7500.0,
        product_title_snapshot: product.title,
        variant_sku_snapshot: variant.sku,
      });

      // Order 1 for User B: Pending status
      orderB1 = await Order.create({
        order_number: `DFC-TRK-B1-${Date.now()}`,
        customer_id: userB.id,
        order_status: 'pending',
        payment_status: 'pending',
        total_amount: 7500.0,
        shipping_amount: 350.0,
        discount_amount: 0.0,
        shipping_address_snapshot: {
          line1: '99 Temple Road',
          city: 'Matara',
          postal_code: '81000',
        },
        notes: 'Test Order B1',
      });
    } catch {
      // Offline fallback
    }
  });

  afterAll(async () => {
    try {
      const orderIds = [orderA1 && orderA1.id, orderA2 && orderA2.id, orderB1 && orderB1.id].filter(
        Boolean
      );
      if (orderIds.length > 0) {
        await Payment.destroy({ where: { order_id: orderIds } });
        await OrderItem.destroy({ where: { order_id: orderIds } });
        await Order.destroy({ where: { id: orderIds } });
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
      // Offline teardown error ignored
    }
  });

  describe('Unauthenticated Protection', () => {
    it('should reject GET /api/v1/orders/my-orders with 401 when token is missing', async () => {
      const res = await request(app).get('/api/v1/orders/my-orders');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/authentication token is required/i);
    });

    it('should reject GET /api/v1/orders/:id/track with 401 when token is missing', async () => {
      const res = await request(app).get(
        `/api/v1/orders/${orderA1 ? orderA1.id : 'd0000000-0000-0000-0000-000000000001'}/track`
      );
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('AC1: Customer Order History (GET /api/v1/orders/my-orders)', () => {
    it('should retrieve only orders placed by the authenticated customer', async () => {
      const res = await request(app)
        .get('/api/v1/orders/my-orders')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.orders)).toBe(true);
      expect(res.body.data.orders.length).toBeGreaterThanOrEqual(2);

      // Verify that every returned order belongs strictly to User A
      const orderIds = res.body.data.orders.map((o) => o.id);
      expect(orderIds).toContain(orderA1.id);
      expect(orderIds).toContain(orderA2.id);
      expect(orderIds).not.toContain(orderB1.id);

      // Verify items and snapshots are eager loaded
      const firstOrder = res.body.data.orders.find((o) => o.id === orderA1.id);
      expect(firstOrder.items).toBeDefined();
      expect(firstOrder.items.length).toBe(1);
      expect(firstOrder.items[0].product_title).toBe(product.title);
      expect(firstOrder.items[0].quantity).toBe(2);
      expect(firstOrder.items[0].unit_price).toBe(7500);
      expect(firstOrder.total_amount).toBe(15000);
      expect(firstOrder.invoice_number).toMatch(/DFC-\d{4}-/);

      // Verify pagination structure
      expect(res.body.data.pagination).toBeDefined();
      expect(res.body.data.pagination.page).toBe(1);
      expect(res.body.data.pagination.total).toBeGreaterThanOrEqual(2);
    });

    it('should support pagination via page and limit query parameters', async () => {
      const res = await request(app)
        .get('/api/v1/orders/my-orders?page=1&limit=1')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.data.orders.length).toBe(1);
      expect(res.body.data.pagination.limit).toBe(1);
      expect(res.body.data.pagination.total_pages).toBeGreaterThanOrEqual(2);
    });
  });

  describe('AC2: Real-Time Order Tracking Milestone Timeline (GET /api/v1/orders/:id/track)', () => {
    it('should return milestone timeline for processing order', async () => {
      const res = await request(app)
        .get(`/api/v1/orders/${orderA1.id}/track`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.order_id).toBe(orderA1.id);
      expect(res.body.data.order_number).toBe(orderA1.order_number);
      expect(res.body.data.current_status).toBe('processing');
      expect(res.body.data.carrier).toBe('PromptX Express / Koombiyo Logistics');
      expect(res.body.data.tracking_number).toBeDefined();
      expect(res.body.data.estimated_delivery).toBeDefined();

      // Check milestones array
      const { milestones } = res.body.data;
      expect(Array.isArray(milestones)).toBe(true);
      expect(milestones.length).toBe(4);

      const placedStep = milestones.find((m) => m.key === 'placed');
      const processingStep = milestones.find((m) => m.key === 'processing');
      const shippedStep = milestones.find((m) => m.key === 'shipped');
      const deliveredStep = milestones.find((m) => m.key === 'delivered');

      expect(placedStep.status).toBe('completed');
      expect(processingStep.status).toBe('current');
      expect(shippedStep.status).toBe('pending');
      expect(deliveredStep.status).toBe('pending');
    });

    it('should return milestone timeline for shipped order with step 3 current', async () => {
      const res = await request(app)
        .get(`/api/v1/orders/${orderA2.id}/track`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.data.current_status).toBe('shipped');

      const { milestones } = res.body.data;
      const placedStep = milestones.find((m) => m.key === 'placed');
      const processingStep = milestones.find((m) => m.key === 'processing');
      const shippedStep = milestones.find((m) => m.key === 'shipped');

      expect(placedStep.status).toBe('completed');
      expect(processingStep.status).toBe('completed');
      expect(shippedStep.status).toBe('current');
    });
  });

  describe('AC3 & Security: IDOR Ownership Enforcement on Order Tracking', () => {
    it('should return 403 Forbidden when User B attempts to track User A order', async () => {
      const res = await request(app)
        .get(`/api/v1/orders/${orderA1.id}/track`)
        .set('Authorization', `Bearer ${tokenB}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/permission/i);
    });

    it('should return 404 Not Found when tracking a non-existent order ID', async () => {
      const res = await request(app)
        .get('/api/v1/orders/d0000000-0000-0000-0000-000000000099/track')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/not found/i);
    });
  });
});
