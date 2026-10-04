const request = require('supertest');
const app = require('../../src/app');
const redisClient = require('../../src/config/redis');
const { generateAccessToken } = require('../../src/services/token.service');
const { ROLES } = require('../../src/config/constants');
const { CACHE_KEY } = require('../../src/services/category.service');
const { Category, sequelize } = require('../../src/models');

describe('Integration: Category Hierarchy API & Redis Sub-Tree Caching (STORM-018)', () => {
  let adminToken;

  beforeAll(() => {
    adminToken = generateAccessToken({
      id: 'usr-admin-uuid-001',
      email: 'admin@dickwellafashion.lk',
      role: ROLES.ADMIN,
    });
  });

  beforeEach(async () => {
    await redisClient.del(CACHE_KEY);
  });

  afterAll(async () => {
    try {
      await redisClient.del(CACHE_KEY);
      await sequelize.close();
      await redisClient.quit();
    } catch {
      // Ignore cleanup error if already closed
    }
  });

  describe('GET /api/v1/categories (Cache-Aside Pattern)', () => {
    it('first request should fetch data, set X-Cache: MISS, and populate Redis', async () => {
      // Verify Redis is empty prior to call
      const preCheck = await redisClient.get(CACHE_KEY);
      expect(preCheck).toBeNull();

      const response = await request(app).get('/api/v1/categories');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.headers['x-cache']).toBe('MISS');

      // Assert each root item contains children array
      expect(response.body.data[0]).toHaveProperty('children');

      // Assert Redis cache key is now populated
      const postCheck = await redisClient.get(CACHE_KEY);
      expect(postCheck).not.toBeNull();
      const parsed = JSON.parse(postCheck);
      expect(Array.isArray(parsed)).toBe(true);
    });

    it('second request should return immediately from Redis with X-Cache: HIT', async () => {
      // 1. Initial prime request (MISS)
      const res1 = await request(app).get('/api/v1/categories');
      expect(res1.status).toBe(200);
      expect(res1.headers['x-cache']).toBe('MISS');

      // 2. Immediate second request (HIT)
      const res2 = await request(app).get('/api/v1/categories');
      expect(res2.status).toBe(200);
      expect(res2.headers['x-cache']).toBe('HIT');
      expect(res2.body.data).toEqual(res1.body.data);
    });
  });

  describe('POST /api/v1/categories (Admin Creation & Cache Invalidation)', () => {
    it('should reject unauthenticated category creation with 401', async () => {
      const response = await request(app)
        .post('/api/v1/categories')
        .send({ name: 'Unauthenticated Category', slug: 'unauth-cat' });

      expect(response.status).toBe(401);
    });

    it('should reject customer category creation with 403 Forbidden', async () => {
      const customerToken = generateAccessToken({
        id: 'usr-cust-001',
        email: 'shopper@dickwella.lk',
        role: ROLES.CUSTOMER,
      });

      const response = await request(app)
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ name: 'Hacker Category', slug: 'hacker-cat' });

      expect(response.status).toBe(403);
      expect(response.body.message).toBe('Access denied: insufficient permissions');
    });

    it('should allow admin to create category and immediately invalidate the Redis cache', async () => {
      // 1. Warm cache
      await request(app).get('/api/v1/categories');
      const cachedBefore = await redisClient.get(CACHE_KEY);
      expect(cachedBefore).not.toBeNull();

      // 2. Admin creates category
      const mockCreated = {
        id: 'new-cat-uuid-001',
        name: 'Festive Wear',
        slug: 'festive-wear',
        parent_id: null,
      };
      jest.spyOn(Category, 'findOne').mockResolvedValue(null);
      jest.spyOn(Category, 'create').mockResolvedValue(mockCreated);

      const response = await request(app)
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Festive Wear',
          slug: 'festive-wear',
          description: 'Special seasonal and festival traditional wear',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);

      // 3. Verify Redis cache key was deleted (invalidated)
      const cachedAfter = await redisClient.get(CACHE_KEY);
      expect(cachedAfter).toBeNull();

      // 4. Next GET request must be a MISS
      const resAfterInvalidation = await request(app).get('/api/v1/categories');
      expect(resAfterInvalidation.headers['x-cache']).toBe('MISS');
    });
  });
});
