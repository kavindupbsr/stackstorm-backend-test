const request = require('supertest');
const app = require('../../src/app');
const redisClient = require('../../src/config/redis');
const cacheService = require('../../src/services/cache.service');
const { generateAccessToken } = require('../../src/services/token.service');
const { ROLES } = require('../../src/config/constants');
const { CACHE_KEY } = require('../../src/services/category.service');
const { Product, Category, sequelize } = require('../../src/models');

describe('Integration: Redis Cache Invalidation Pipeline & Cache-Aside Integration Tests (STORM-022)', () => {
  let adminToken;
  let customerToken;

  beforeAll(() => {
    adminToken = generateAccessToken({
      id: 'usr-admin-uuid-001',
      email: 'admin@dickwellafashion.lk',
      role: ROLES.ADMIN,
    });

    customerToken = generateAccessToken({
      id: 'usr-cust-uuid-002',
      email: 'shopper@dickwellafashion.lk',
      role: ROLES.CUSTOMER,
    });
  });

  beforeEach(async () => {
    await cacheService.invalidatePattern('cache:*');
  });

  afterAll(async () => {
    try {
      await cacheService.invalidatePattern('cache:*');
      await sequelize.close();
      await redisClient.quit();
    } catch {
      // Ignore if connection already terminated
    }
  });

  describe('cacheService Unit-Level Operations (SCAN & Invalidation)', () => {
    it('getOrSet should return cached value if present and avoid executing fetcherFn', async () => {
      const testKey = 'cache:test:cached-read';
      await cacheService.set(testKey, { cached: true, timestamp: 12345 }, 60);

      const fetcherMock = jest.fn().mockResolvedValue({ cached: false });
      const result = await cacheService.getOrSet(testKey, 60, fetcherMock);

      expect(result).toEqual({ cached: true, timestamp: 12345 });
      expect(fetcherMock).not.toHaveBeenCalled();
    });

    it('getOrSet should invoke fetcherFn on cache miss, set the cache, and return fresh data', async () => {
      const testKey = 'cache:test:cache-miss';
      const fetcherMock = jest.fn().mockResolvedValue({ fetched: true, data: [1, 2, 3] });

      const result = await cacheService.getOrSet(testKey, 60, fetcherMock);

      expect(result).toEqual({ fetched: true, data: [1, 2, 3] });
      expect(fetcherMock).toHaveBeenCalledTimes(1);

      // Verify that Redis was populated with serialized data
      const stored = await cacheService.get(testKey);
      expect(stored).toEqual({ fetched: true, data: [1, 2, 3] });
    });

    it('invalidatePattern should scan and purge all keys matching wildcard pattern', async () => {
      // Seed several matching keys and one non-matching key
      await cacheService.set('cache:products:filter1', { val: 1 }, 60);
      await cacheService.set('cache:products:filter2', { val: 2 }, 60);
      await cacheService.set('cache:products:detail:xyz', { val: 3 }, 60);
      await cacheService.set('cache:other:keepme', { val: 4 }, 60);

      const deletedCount = await cacheService.invalidatePattern('cache:products:*');
      expect(deletedCount).toBeGreaterThanOrEqual(3);

      // Verify targeted keys are gone
      const k1 = await cacheService.get('cache:products:filter1');
      const k2 = await cacheService.get('cache:products:filter2');
      const k3 = await cacheService.get('cache:products:detail:xyz');
      expect(k1).toBeNull();
      expect(k2).toBeNull();
      expect(k3).toBeNull();

      // Verify non-matching key is intact
      const keep = await cacheService.get('cache:other:keepme');
      expect(keep).toEqual({ val: 4 });
    });
  });

  describe('Product Catalog Cache Invalidation Pipeline (AC1 & AC3)', () => {
    it('GET /api/v1/products/:slug primes cache and subsequent GET delivers cached payload', async () => {
      const slug = 'classic-batik-short-sleeve-shirt';
      const cacheKey = `cache:product:slug:${slug}`;

      // Ensure cache is cold
      await cacheService.del(cacheKey);

      // Prime read
      const res1 = await request(app).get(`/api/v1/products/${slug}`);
      expect(res1.status).toBe(200);
      expect(res1.body.success).toBe(true);

      // Verify key exists in Redis
      const cached = await cacheService.get(cacheKey);
      expect(cached).not.toBeNull();
      expect(cached.slug).toBe(slug);

      // Second read should match cached object
      const res2 = await request(app).get(`/api/v1/products/${slug}`);
      expect(res2.status).toBe(200);
      expect(res2.body.data.slug).toBe(slug);
    });

    it('PUT /api/v1/products/:id by Admin evicts cache:product:* and cache:products:*', async () => {
      const slug = 'classic-batik-short-sleeve-shirt';
      const targetId = 'b0000000-0000-0000-0000-000000000001';

      // 1. Prime cache entries for product and listing
      await cacheService.set(`cache:product:${targetId}`, { id: targetId, price: 5500 }, 3600);
      await cacheService.set(
        `cache:product:slug:${slug}`,
        { id: targetId, slug, title: 'Old Title' },
        3600
      );
      await cacheService.set('cache:products:page:1', [{ id: targetId }], 3600);

      // Mock Product.findByPk and update if database record exists
      jest.spyOn(Product, 'findByPk').mockResolvedValue({
        id: targetId,
        slug,
        title: 'Original Title',
        update: jest.fn().mockResolvedValue(true),
        get: () => ({ id: targetId, slug, title: 'Updated Batik Luxury Shirt' }),
      });

      // 2. Admin performs update
      const response = await request(app)
        .put(`/api/v1/products/${targetId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Updated Batik Luxury Shirt',
          description: 'Refined description with premium cotton',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // 3. Verify Redis eviction
      const productById = await cacheService.get(`cache:product:${targetId}`);
      const productBySlug = await cacheService.get(`cache:product:slug:${slug}`);
      const listingCache = await cacheService.get('cache:products:page:1');

      expect(productById).toBeNull();
      expect(productBySlug).toBeNull();
      expect(listingCache).toBeNull();
    });

    it('DELETE /api/v1/products/:id by Admin evicts product and listing cache', async () => {
      const targetId = 'b0000000-0000-0000-0000-000000000002';
      const slug = 'mens-formal-white-shirt';

      // Prime cache
      await cacheService.set(`cache:product:${targetId}`, { id: targetId }, 3600);
      await cacheService.set(`cache:product:slug:${slug}`, { id: targetId, slug }, 3600);
      await cacheService.set('cache:products:all', { total: 5 }, 3600);

      jest.spyOn(Product, 'findByPk').mockResolvedValue({
        id: targetId,
        slug,
        destroy: jest.fn().mockResolvedValue(true),
      });

      const response = await request(app)
        .delete(`/api/v1/products/${targetId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify eviction
      const checkId = await cacheService.get(`cache:product:${targetId}`);
      const checkSlug = await cacheService.get(`cache:product:slug:${slug}`);
      const checkList = await cacheService.get('cache:products:all');

      expect(checkId).toBeNull();
      expect(checkSlug).toBeNull();
      expect(checkList).toBeNull();
    });

    it('PUT /api/v1/products/:id should reject unauthenticated or non-admin callers', async () => {
      const targetId = 'b0000000-0000-0000-0000-000000000001';

      // Unauthenticated
      const resUnauth = await request(app)
        .put(`/api/v1/products/${targetId}`)
        .send({ title: 'Unauthorized Hack' });
      expect(resUnauth.status).toBe(401);

      // Customer role
      const resCust = await request(app)
        .put(`/api/v1/products/${targetId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ title: 'Customer Attempt' });
      expect(resCust.status).toBe(403);
    });
  });

  describe('Category Cache Invalidation Pipeline (AC2 & AC3)', () => {
    it('PUT /api/v1/categories/:id evicts cache:categories:tree and subsequent read primes cache', async () => {
      const catId = 'a0000000-0000-0000-0000-000000000001';

      // 1. Prime category tree cache
      await request(app).get('/api/v1/categories');
      const cachedBefore = await redisClient.get(CACHE_KEY);
      expect(cachedBefore).not.toBeNull();

      // Mock Category.findByPk
      jest.spyOn(Category, 'findByPk').mockResolvedValue({
        id: catId,
        name: 'Men Premium',
        slug: 'men',
        update: jest.fn().mockResolvedValue(true),
        toJSON: () => ({ id: catId, name: 'Men Premium', slug: 'men' }),
      });

      // 2. Admin updates category
      const response = await request(app)
        .put(`/api/v1/categories/${catId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Men Premium Wear',
          description: 'Updated description for men category',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // 3. Assert cache is purged
      const cachedAfter = await redisClient.get(CACHE_KEY);
      expect(cachedAfter).toBeNull();

      // 4. Subsequent read should result in X-Cache: MISS and re-prime Redis
      const readAfter = await request(app).get('/api/v1/categories');
      expect(readAfter.status).toBe(200);
      expect(readAfter.headers['x-cache']).toBe('MISS');

      const rePrimed = await redisClient.get(CACHE_KEY);
      expect(rePrimed).not.toBeNull();
    });

    it('DELETE /api/v1/categories/:id evicts category cache immediately', async () => {
      const catId = 'a0000000-0000-0000-0000-000000000002';

      // Prime cache
      await redisClient.set(CACHE_KEY, JSON.stringify([{ id: catId, name: 'Women' }]));

      jest.spyOn(Category, 'findByPk').mockResolvedValue({
        id: catId,
        destroy: jest.fn().mockResolvedValue(true),
      });

      const response = await request(app)
        .delete(`/api/v1/categories/${catId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      const cachedAfter = await redisClient.get(CACHE_KEY);
      expect(cachedAfter).toBeNull();
    });
  });
});
