const request = require('supertest');
const app = require('../../src/app');
const { generateAccessToken } = require('../../src/services/token.service');
const {
  Order,
  OrderItem,
  ProductVariant,
  Product,
  Category,
  sequelize,
} = require('../../src/models');
const redisClient = require('../../src/config/redis');

describe('Integration: Admin Dashboard Analytics & Financial Metrics (STORM-036)', () => {
  const adminUser = {
    id: 'b0000000-0000-0000-0000-000000000001',
    email: 'admin@dickwellafashion.lk',
    role: 'admin',
  };

  const customerUser = {
    id: 'b0000000-0000-0000-0000-000000000003',
    email: 'pabasara@example.lk',
    role: 'customer',
  };

  const inventoryUser = {
    id: 'b0000000-0000-0000-0000-000000000002',
    email: 'inventory@dickwellafashion.lk',
    role: 'inventory_staff',
  };

  const adminToken = generateAccessToken(adminUser);
  const customerToken = generateAccessToken(customerUser);
  const inventoryToken = generateAccessToken(inventoryUser);

  let category;
  let product;
  let variant;
  let testOrder;
  let testOrderItem;

  beforeAll(async () => {
    try {
      category = await Category.create({
        name: `Analytics Cat ${Date.now()}`,
        slug: `analytics-cat-${Date.now()}`,
      });

      product = await Product.create({
        category_id: category.id,
        title: `Analytics Test Kaftan ${Date.now()}`,
        slug: `analytics-kaftan-${Date.now()}`,
        base_price: 7500.0,
        is_active: true,
      });

      variant = await ProductVariant.create({
        product_id: product.id,
        sku: `ANALYTICS-SKU-${Date.now()}`,
        size: 'M',
        color: 'Ocean Blue',
        stock_quantity: 5, // Triggers low-stock alert (< 10)
        reserved_quantity: 0,
        price_override: null,
      });

      testOrder = await Order.create({
        order_number: `DFC-ANALYTICS-${Date.now()}`,
        customer_id: customerUser.id,
        order_status: 'delivered',
        payment_status: 'paid',
        total_amount: 15000.0,
        shipping_amount: 0.0,
        discount_amount: 0.0,
        shipping_address_snapshot: { city: 'Dickwella' },
        notes: 'Analytics Test Paid Order',
      });

      testOrderItem = await OrderItem.create({
        order_id: testOrder.id,
        product_variant_id: variant.id,
        quantity: 2,
        unit_price_at_purchase: 7500.0,
        total_price: 15000.0,
        product_title_snapshot: product.title,
        variant_sku_snapshot: variant.sku,
      });
    } catch (err) {
      console.warn('Analytics test fixture warning:', err.message);
    }
  });

  afterAll(async () => {
    try {
      if (testOrderItem) await OrderItem.destroy({ where: { id: testOrderItem.id } });
      if (testOrder) await Order.destroy({ where: { id: testOrder.id } });
      if (variant) await ProductVariant.destroy({ where: { id: variant.id } });
      if (product) await Product.destroy({ where: { id: product.id } });
      if (category) await Category.destroy({ where: { id: category.id } });

      await sequelize.close();
      await redisClient.quit();
    } catch {
      // Ignore teardown disconnect errors
    }
  });

  describe('Security & RBAC Enforcement (AC3)', () => {
    it('should reject GET /api/v1/admin/analytics/overview with 401 when token is missing', async () => {
      const res = await request(app).get('/api/v1/admin/analytics/overview');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should reject GET /api/v1/admin/analytics/overview with 403 when user is customer', async () => {
      const res = await request(app)
        .get('/api/v1/admin/analytics/overview')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/insufficient permissions/i);
    });

    it('should reject GET /api/v1/admin/analytics/overview with 403 when user is inventory_staff', async () => {
      const res = await request(app)
        .get('/api/v1/admin/analytics/overview')
        .set('Authorization', `Bearer ${inventoryToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/insufficient permissions/i);
    });
  });

  describe('AC1: Business Overview Analytics (GET /api/v1/admin/analytics/overview)', () => {
    it('should return 200 with Total Revenue in LKR, Orders, and Low Stock count for admin', async () => {
      const res = await request(app)
        .get('/api/v1/admin/analytics/overview')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('totalRevenue');
      expect(res.body.data).toHaveProperty('totalRevenueRaw');
      expect(res.body.data).toHaveProperty('totalOrders');
      expect(res.body.data).toHaveProperty('todaysOrders');
      expect(res.body.data).toHaveProperty('activeCustomers');
      expect(res.body.data).toHaveProperty('lowStockItems');
      expect(res.body.data.currency).toBe('LKR');
      expect(typeof res.body.data.totalRevenue).toBe('string');
      expect(res.body.data.totalRevenue).toMatch(/^LKR /);
      expect(res.body.data.lowStockItems).toBeGreaterThanOrEqual(1);
    });
  });

  describe('AC2: Sales Trend Aggregations (GET /api/v1/admin/analytics/sales-trend)', () => {
    it('should return 200 with daily revenue and order volume for 30-day window', async () => {
      const res = await request(app)
        .get('/api/v1/admin/analytics/sales-trend?days=30')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.days).toBe(30);
      expect(Array.isArray(res.body.data.trend)).toBe(true);
      expect(res.body.data.trend).toHaveLength(30);

      const todayKey = new Date().toISOString().split('T')[0];
      const todayBucket = res.body.data.trend.find((t) => t.date === todayKey);
      expect(todayBucket).toBeDefined();
      expect(todayBucket.revenue).toBeGreaterThanOrEqual(0);
    });

    it('should support custom day window parameter (e.g., 7 days)', async () => {
      const res = await request(app)
        .get('/api/v1/admin/analytics/sales-trend?days=7')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.days).toBe(7);
      expect(res.body.data.trend).toHaveLength(7);
    });
  });

  describe('Additional Executive Intelligence Endpoints', () => {
    it('should return top selling garments ranked by volume via GET /api/v1/admin/analytics/top-products', async () => {
      const res = await request(app)
        .get('/api/v1/admin/analytics/top-products?limit=5')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      if (res.body.data.length > 0) {
        expect(res.body.data[0]).toHaveProperty('title');
        expect(res.body.data[0]).toHaveProperty('units_sold');
        expect(res.body.data[0]).toHaveProperty('revenue');
      }
    });

    it('should return low-stock inventory alerts via GET /api/v1/admin/analytics/low-stock', async () => {
      const res = await request(app)
        .get('/api/v1/admin/analytics/low-stock?threshold=10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);

      const foundLowStock = res.body.data.some((item) => item.sku === variant.sku);
      expect(foundLowStock).toBe(true);
    });
  });
});
