const request = require('supertest');
const app = require('../../src/app');
const { generateAccessToken } = require('../../src/services/token.service');
const wishlistService = require('../../src/services/wishlist.service');
const { Wishlist, sequelize } = require('../../src/models');
const redisClient = require('../../src/config/redis');

describe('Integration: Customer Wishlist API & Stock Alert Triggers (STORM-025)', () => {
  const customerUser = {
    id: 'b0000000-0000-0000-0000-000000000001',
    email: 'nimal.perera@gmail.com',
    role: 'customer',
  };

  const customerToken = generateAccessToken(customerUser);
  const productId = 'c0000000-0000-0000-0000-000000000001'; // Classic Batik Shirt
  const secondProductId = 'c0000000-0000-0000-0000-000000000002'; // Handloom Cotton Sarong

  beforeEach(async () => {
    wishlistService.resetFallbackStore();
    try {
      await Wishlist.destroy({
        where: { user_id: customerUser.id },
      });
    } catch {
      // Ignore if offline
    }
  });

  afterAll(async () => {
    try {
      wishlistService.resetFallbackStore();
      await Wishlist.destroy({
        where: { user_id: customerUser.id },
      });
      await sequelize.close();
      await redisClient.quit();
    } catch {
      // Ignore cleanup error if already closed
    }
  });

  describe('Unauthenticated Protection', () => {
    it('should allow guest GET /api/v1/wishlist with 200 OK and empty array if token is missing', async () => {
      const res = await request(app).get('/api/v1/wishlist');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual([]);
    });

    it('should reject POST /api/v1/wishlist with 401 Unauthorized if token is missing', async () => {
      const res = await request(app).post('/api/v1/wishlist').send({ productId });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/wishlist (AC1 - Add to Wishlist & Composite Uniqueness)', () => {
    it('should add a product to the user wishlist with composite uniqueness', async () => {
      const res = await request(app)
        .post('/api/v1/wishlist')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ productId });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.created).toBe(true);

      // Attempting to add duplicate product should be idempotent
      const duplicateRes = await request(app)
        .post('/api/v1/wishlist')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ productId });

      expect(duplicateRes.status).toBe(200);
      expect(duplicateRes.body.success).toBe(true);
      expect(duplicateRes.body.data.created).toBe(false);
      expect(duplicateRes.body.data.message).toMatch(/already exists/i);
    });

    it('should accept snake_case product_id in request body', async () => {
      const res = await request(app)
        .post('/api/v1/wishlist')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ product_id: secondProductId });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.created).toBe(true);
    });

    it('should return 400 Bad Request when productId is omitted', async () => {
      const res = await request(app)
        .post('/api/v1/wishlist')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/wishlist (AC2 - Live Stock & LKR Pricing)', () => {
    it('should return wishlisted products with pricing in LKR and live stock status', async () => {
      // Seed item into wishlist
      await request(app)
        .post('/api/v1/wishlist')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ productId });

      const res = await request(app)
        .get('/api/v1/wishlist')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);

      const item = res.body.data.find((w) => String(w.product_id) === String(productId));
      expect(item).toBeDefined();
      expect(item.product).toBeDefined();
      expect(typeof item.product.base_price).toBe('number');
      expect(item.product.formatted_price).toMatch(/^LKR\s\d+/);
      expect(typeof item.product.available_stock).toBe('number');
      expect(typeof item.product.in_stock).toBe('boolean');
    });

    it('should return an empty array if customer has no wishlisted items', async () => {
      const emptyUserToken = generateAccessToken({
        id: 'b0000000-0000-0000-0000-000000000099',
        email: 'empty.customer@gmail.com',
        role: 'customer',
      });

      const res = await request(app)
        .get('/api/v1/wishlist')
        .set('Authorization', `Bearer ${emptyUserToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual([]);
    });
  });

  describe('POST /api/v1/wishlist/toggle (Toggle Behavior)', () => {
    it('should add item if missing and remove if already present', async () => {
      // 1. Initial toggle: item is absent -> should add
      const toggleAddRes = await request(app)
        .post('/api/v1/wishlist/toggle')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ productId });

      expect(toggleAddRes.status).toBe(200);
      expect(toggleAddRes.body.success).toBe(true);
      expect(toggleAddRes.body.data.wishlisted).toBe(true);
      expect(toggleAddRes.body.data.message).toMatch(/added to wishlist/i);

      // 2. Second toggle: item is present -> should remove
      const toggleRemoveRes = await request(app)
        .post('/api/v1/wishlist/toggle')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ productId });

      expect(toggleRemoveRes.status).toBe(200);
      expect(toggleRemoveRes.body.success).toBe(true);
      expect(toggleRemoveRes.body.data.wishlisted).toBe(false);
      expect(toggleRemoveRes.body.data.message).toMatch(/removed from wishlist/i);
    });
  });

  describe('DELETE /api/v1/wishlist/:productId (Removal Flow)', () => {
    it('should remove a product from customer wishlist', async () => {
      // Add product
      await request(app)
        .post('/api/v1/wishlist')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ productId });

      // Delete product
      const deleteRes = await request(app)
        .delete(`/api/v1/wishlist/${productId}`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.success).toBe(true);
      expect(deleteRes.body.data.removed).toBe(true);

      // Verify it no longer appears in GET /api/v1/wishlist
      const listRes = await request(app)
        .get('/api/v1/wishlist')
        .set('Authorization', `Bearer ${customerToken}`);

      const found = listRes.body.data.find((w) => String(w.product_id) === String(productId));
      expect(found).toBeUndefined();
    });
  });

  describe('Restock Notification Triggers (AC3 - SendGrid Hook)', () => {
    it('should trigger restock alert for subscribers and return dispatch summary', async () => {
      // User wishlists product
      await request(app)
        .post('/api/v1/wishlist')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ productId });

      const alertRes = await request(app)
        .post(`/api/v1/wishlist/restock-alert/${productId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          variant_sku: 'BATIK-SHIRT-M-BLU',
          restocked_quantity: 50,
        });

      expect(alertRes.status).toBe(200);
      expect(alertRes.body.success).toBe(true);
      expect(alertRes.body.data.product_id).toBe(productId);
      expect(typeof alertRes.body.data.notified_count).toBe('number');
      expect(Array.isArray(alertRes.body.data.subscribers)).toBe(true);
    });

    it('should handle restock alerts when no subscribers exist without crashing', async () => {
      const unusedProductId = 'c0000000-0000-0000-0000-000000000025';
      const alertRes = await request(app)
        .post(`/api/v1/wishlist/restock-alert/${unusedProductId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ restocked_quantity: 10 });

      expect(alertRes.status).toBe(200);
      expect(alertRes.body.data.notified_count).toBe(0);
      expect(alertRes.body.data.subscribers).toEqual([]);
    });
  });
});
