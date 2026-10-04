const request = require('supertest');
const app = require('../../src/app');
const { generateAccessToken } = require('../../src/services/token.service');
const {
  ProductVariant,
  Product,
  Category,
  InventoryLog,
  sequelize,
} = require('../../src/models');
const redisClient = require('../../src/config/redis');

describe('Integration: Admin Inventory Restock & Variant Management (STORM-037)', () => {
  const adminUser = {
    id: 'b0000000-0000-0000-0000-000000000001',
    email: 'admin@dickwellafashion.lk',
    role: 'admin',
  };

  const inventoryStaff = {
    id: 'b0000000-0000-0000-0000-000000000002',
    email: 'inventory@dickwellafashion.lk',
    role: 'inventory_staff',
  };

  const customerUser = {
    id: 'b0000000-0000-0000-0000-000000000003',
    email: 'pabasara@example.lk',
    role: 'customer',
  };

  const adminToken = generateAccessToken(adminUser);
  const inventoryToken = generateAccessToken(inventoryStaff);
  const customerToken = generateAccessToken(customerUser);

  let category;
  let product;
  let variant;

  beforeAll(async () => {
    try {
      category = await Category.create({
        name: `Inv Test Cat ${Date.now()}`,
        slug: `inv-test-cat-${Date.now()}`,
      });

      product = await Product.create({
        category_id: category.id,
        title: `Handloom Batik Kurta ${Date.now()}`,
        slug: `handloom-batik-kurta-${Date.now()}`,
        base_price: 6800.0,
        is_active: true,
      });

      variant = await ProductVariant.create({
        product_id: product.id,
        sku: `BATIK-BLU-${Date.now()}`,
        size: 'M',
        color: 'Indigo Blue',
        stock_quantity: 25,
        reserved_quantity: 0,
        price_override: null,
      });
    } catch (err) {
      console.warn('Inventory integration fixture notice:', err.message);
    }
  });

  afterAll(async () => {
    try {
      if (variant) {
        await InventoryLog.destroy({ where: { sku: variant.sku } });
        await ProductVariant.destroy({ where: { id: variant.id } });
      }
      if (product) await Product.destroy({ where: { id: product.id } });
      if (category) await Category.destroy({ where: { id: category.id } });

      await sequelize.close();
      await redisClient.quit();
    } catch {
      // Ignore teardown disconnect error
    }
  });

  describe('Security & Role-Based Access Control', () => {
    it('should reject unauthenticated stock adjustment with 401', async () => {
      const res = await request(app)
        .patch(`/api/v1/inventory/variants/${variant.sku}/stock`)
        .send({ adjustment: 10, reason: 'Unauthenticated attempt' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should reject customer token with 403 Forbidden', async () => {
      const res = await request(app)
        .patch(`/api/v1/inventory/variants/${variant.sku}/stock`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ adjustment: 10, reason: 'Customer attempt' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/insufficient permissions/i);
    });
  });

  describe('AC1 & AC2: Inventory Restocking & Audit Trail (PATCH /api/v1/inventory/variants/:sku/stock)', () => {
    it('should allow inventory staff to restock variant and record audit log', async () => {
      const res = await request(app)
        .patch(`/api/v1/inventory/variants/${variant.sku}/stock`)
        .set('Authorization', `Bearer ${inventoryToken}`)
        .send({
          adjustment: 20,
          reason: 'Restock shipment batch #402',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.sku).toBe(variant.sku);
      expect(res.body.data.previous_stock).toBe(25);
      expect(res.body.data.new_stock).toBe(45);
      expect(res.body.data.adjustment).toBe(20);
      expect(res.body.data.is_low_stock).toBe(false);

      // Verify audit log can be fetched via API
      const logsRes = await request(app)
        .get(`/api/v1/inventory/variants/${variant.sku}/logs`)
        .set('Authorization', `Bearer ${inventoryToken}`);

      expect(logsRes.status).toBe(200);
      expect(logsRes.body.success).toBe(true);
      expect(logsRes.body.data.logs.length).toBeGreaterThanOrEqual(1);

      const log = logsRes.body.data.logs.find((l) => l.reason === 'Restock shipment batch #402');
      expect(log).toBeDefined();
      expect(log.quantity_change).toBe(20);
    });

    it('should allow admin to perform stock adjustments', async () => {
      const res = await request(app)
        .patch(`/api/v1/inventory/variants/${variant.sku}/stock`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          adjustment: 5,
          reason: 'Admin inventory count adjustment',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.previous_stock).toBe(45);
      expect(res.body.data.new_stock).toBe(50);
    });

    it('should reject adjustments causing negative stock with 400 Bad Request', async () => {
      const res = await request(app)
        .patch(`/api/v1/inventory/variants/${variant.sku}/stock`)
        .set('Authorization', `Bearer ${inventoryToken}`)
        .send({
          adjustment: -100, // Stock is 50, -100 would be -50
          reason: 'Excessive deduction',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/stock_quantity cannot be negative/i);
    });
  });

  describe('AC3: Low Stock Warning Trigger', () => {
    it('should trigger low stock flag when balance falls <= 5 units', async () => {
      // Current stock is 50. Adjust by -47 -> new balance = 3 (<= 5)
      const res = await request(app)
        .patch(`/api/v1/inventory/variants/${variant.sku}/stock`)
        .set('Authorization', `Bearer ${inventoryToken}`)
        .send({
          adjustment: -47,
          reason: 'Fulfillment bulk dispatch',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.new_stock).toBe(3);
      expect(res.body.data.is_low_stock).toBe(true);
    });
  });

  describe('Audit Trail & Backwards Compatibility', () => {
    it('should retrieve global inventory audit logs via GET /api/v1/inventory/logs', async () => {
      const res = await request(app)
        .get('/api/v1/inventory/logs?page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.logs)).toBe(true);
      expect(res.body.data.pagination).toHaveProperty('total');
    });

    it('should support legacy POST /api/v1/inventory/adjust-stock endpoint', async () => {
      const res = await request(app)
        .post('/api/v1/inventory/adjust-stock')
        .set('Authorization', `Bearer ${inventoryToken}`)
        .send({
          sku: variant.sku,
          delta: 10,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.sku).toBe(variant.sku);
      expect(res.body.data.newStockLevel).toBe(13); // 3 + 10 = 13
    });
  });
});
