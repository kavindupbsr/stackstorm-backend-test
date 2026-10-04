const request = require('supertest');
const app = require('../../src/app');
const redisClient = require('../../src/config/redis');
const cartService = require('../../src/services/cart.service');
const { generateAccessToken } = require('../../src/services/token.service');
const { ROLES } = require('../../src/config/constants');
const { sequelize } = require('../../src/models');

describe('Integration: Hybrid Shopping Cart Management & Merge Pipeline (STORM-023)', () => {
  let customerToken;
  const testUserId = 'usr-cust-cart-001';
  const guestSessionId = 'guest_sess_flow_test_888';
  const variantId1 = 'd0000000-0000-0000-0000-000000000001'; // Batik Shirt M (Stock: 25, Price: 4850)
  const variantId2 = 'd0000000-0000-0000-0000-000000000002'; // Batik Shirt L (Stock: 20, Price: 4850)

  beforeAll(() => {
    customerToken = generateAccessToken({
      id: testUserId,
      email: 'cart.shopper@dickwellafashion.lk',
      role: ROLES.CUSTOMER,
    });
  });

  beforeEach(async () => {
    cartService.fallbackUserCarts.clear();
    await cartService.clearCart({ sessionId: guestSessionId });
    await cartService.clearCart({ userId: testUserId });
  });

  afterAll(async () => {
    try {
      cartService.fallbackUserCarts.clear();
      await cartService.clearCart({ sessionId: guestSessionId });
      await cartService.clearCart({ userId: testUserId });
      await sequelize.close();
      await redisClient.quit();
    } catch {
      // Ignore cleanup error if already closed
    }
  });

  describe('Anonymous Guest Shopping Cart Flow', () => {
    it('POST /api/v1/cart adds item and returns subtotal in Sri Lankan Rupees (LKR)', async () => {
      const response = await request(app)
        .post('/api/v1/cart')
        .set('X-Session-ID', guestSessionId)
        .send({
          variant_id: variantId1,
          quantity: 2,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('items');
      expect(response.body.data.items.length).toBe(1);
      expect(response.body.data.items[0].quantity).toBe(2);

      // Verify subtotal in LKR
      expect(response.body.data).toHaveProperty('subtotal');
      expect(response.body.data.subtotal).toContain('LKR');
      expect(response.body.data.subtotal_amount).toBe(9700);
      expect(response.body.data.total_items).toBe(2);
    });

    it('GET /api/v1/cart retrieves guest active cart with line items and subtotal', async () => {
      // Seed item
      await request(app)
        .post('/api/v1/cart')
        .set('X-Session-ID', guestSessionId)
        .send({ variant_id: variantId1, quantity: 1 });

      const response = await request(app).get('/api/v1/cart').set('X-Session-ID', guestSessionId);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.items.length).toBe(1);
      expect(response.body.data.subtotal).toContain('LKR');
      expect(response.body.data.subtotal_amount).toBe(4850);
    });

    it('PUT /api/v1/cart/:itemId updates quantity and recalculates subtotal in LKR', async () => {
      // 1. Add 1 item
      await request(app)
        .post('/api/v1/cart')
        .set('X-Session-ID', guestSessionId)
        .send({ variant_id: variantId1, quantity: 1 });

      // 2. Update to 3 units
      const response = await request(app)
        .put(`/api/v1/cart/${variantId1}`)
        .set('X-Session-ID', guestSessionId)
        .send({ quantity: 3 });

      expect(response.status).toBe(200);
      expect(response.body.data.items[0].quantity).toBe(3);
      expect(response.body.data.subtotal_amount).toBe(14550);
      expect(response.body.data.subtotal).toBe('LKR 14,550.00');
    });

    it('DELETE /api/v1/cart/:itemId removes item and resets subtotal', async () => {
      // 1. Add item
      await request(app)
        .post('/api/v1/cart')
        .set('X-Session-ID', guestSessionId)
        .send({ variant_id: variantId1, quantity: 2 });

      // 2. Remove item
      const response = await request(app)
        .delete(`/api/v1/cart/${variantId1}`)
        .set('X-Session-ID', guestSessionId);

      expect(response.status).toBe(200);
      expect(response.body.data.items.length).toBe(0);
      expect(response.body.data.subtotal_amount).toBe(0);
    });

    it('should reject quantity exceeding available stock with 400 Bad Request', async () => {
      // Batik Shirt M has 25 units in demo catalog
      const response = await request(app)
        .post('/api/v1/cart')
        .set('X-Session-ID', guestSessionId)
        .send({
          variant_id: variantId1,
          quantity: 999, // Exceeds stock
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toMatch(/Only \d+ units available for this variant/);
    });
  });

  describe('Authenticated Customer Cart & Hybrid Merge Flow', () => {
    it('POST /api/v1/cart/merge merges anonymous guest Redis cart into customer account', async () => {
      // 1. Customer already has 1 unit of variant2 in their account
      await request(app)
        .post('/api/v1/cart')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ variant_id: variantId2, quantity: 1 });

      // 2. Guest shopper adds 2 units of variant1 to their anonymous session
      await request(app)
        .post('/api/v1/cart')
        .set('X-Session-ID', guestSessionId)
        .send({ variant_id: variantId1, quantity: 2 });

      // 3. Customer logs in and invokes cart merge
      const mergeResponse = await request(app)
        .post('/api/v1/cart/merge')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ guest_session_id: guestSessionId });

      expect(mergeResponse.status).toBe(200);
      expect(mergeResponse.body.success).toBe(true);
      expect(mergeResponse.body.data.items.length).toBe(2);

      // Verify guest session Redis key is now null/evicted
      const guestAfter = await redisClient.get(`cart:guest:${guestSessionId}`);
      expect(guestAfter).toBeNull();

      // Subsequent GET /api/v1/cart by user retains all merged items
      const userCartResponse = await request(app)
        .get('/api/v1/cart')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(userCartResponse.status).toBe(200);
      expect(userCartResponse.body.data.items.length).toBe(2);
      expect(userCartResponse.body.data.total_items).toBe(3); // 1 + 2
      expect(userCartResponse.body.data.subtotal_amount).toBe(14550); // (1 * 4850) + (2 * 4850)
    });
  });
});
