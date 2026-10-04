const request = require('supertest');
const app = require('../../src/app');
const redisClient = require('../../src/config/redis');
const { sequelize } = require('../../src/models');

describe('Integration: Product Listing, Multi-Faceted Filtering & Pagination (STORM-019)', () => {
  afterAll(async () => {
    try {
      await sequelize.close();
      await redisClient.quit();
    } catch {
      // Ignore cleanup error if already closed
    }
  });

  describe('GET /api/v1/products', () => {
    it('should retrieve default paginated product catalog with HTTP 200', async () => {
      const response = await request(app).get('/api/v1/products?limit=5');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Products retrieved successfully');
      expect(Array.isArray(response.body.data.products)).toBe(true);
      expect(response.body.data.products.length).toBeLessThanOrEqual(5);

      const { pagination } = response.body.data;
      expect(pagination).toBeDefined();
      expect(pagination.page).toBe(1);
      expect(pagination.limit).toBe(5);
      expect(pagination.total).toBeGreaterThan(0);
      expect(pagination.totalPages).toBeGreaterThanOrEqual(1);

      // Verify product card structure
      const sample = response.body.data.products[0];
      expect(sample).toHaveProperty('id');
      expect(sample).toHaveProperty('title');
      expect(sample).toHaveProperty('slug');
      expect(sample).toHaveProperty('base_price');
      expect(sample).toHaveProperty('primary_image');
      expect(sample).toHaveProperty('availableStock');
    });

    it('should filter products within LKR price range 2000 to 10000', async () => {
      const response = await request(app).get(
        '/api/v1/products?min_price=2000&max_price=10000&limit=20'
      );

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.products.length).toBeGreaterThan(0);

      response.body.data.products.forEach((prod) => {
        expect(prod.base_price).toBeGreaterThanOrEqual(2000);
        expect(prod.base_price).toBeLessThanOrEqual(10000);
      });
    });

    it('should filter products by size=L returning only products with Large variants in stock', async () => {
      const response = await request(app).get('/api/v1/products?size=L');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.products.length).toBeGreaterThan(0);

      response.body.data.products.forEach((prod) => {
        const matchingLVariant = prod.variants.find(
          (v) => String(v.size).toUpperCase() === 'L' && v.availableStock > 0
        );
        expect(matchingLVariant).toBeDefined();
        expect(matchingLVariant.availableStock).toBeGreaterThan(0);
      });
    });

    it('should sort products by price ascending when sort=price_asc is passed', async () => {
      const response = await request(app).get('/api/v1/products?sort=price_asc&limit=5');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      const items = response.body.data.products;
      expect(items.length).toBeGreaterThan(1);

      for (let i = 0; i < items.length - 1; i += 1) {
        expect(items[i].base_price).toBeLessThanOrEqual(items[i + 1].base_price);
      }
    });

    it('should sort products by price descending when sort=price_desc is passed', async () => {
      const response = await request(app).get('/api/v1/products?sort=price_desc&limit=5');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      const items = response.body.data.products;
      expect(items.length).toBeGreaterThan(1);

      for (let i = 0; i < items.length - 1; i += 1) {
        expect(items[i].base_price).toBeGreaterThanOrEqual(items[i + 1].base_price);
      }
    });

    it('should support pagination metadata with hasNext and hasPrev flags', async () => {
      const page1Res = await request(app).get('/api/v1/products?page=1&limit=3');
      const page2Res = await request(app).get('/api/v1/products?page=2&limit=3');

      expect(page1Res.status).toBe(200);
      expect(page2Res.status).toBe(200);

      expect(page1Res.body.data.pagination.page).toBe(1);
      expect(page1Res.body.data.pagination.hasNext).toBe(true);
      expect(page1Res.body.data.pagination.hasPrev).toBe(false);

      expect(page2Res.body.data.pagination.page).toBe(2);
      expect(page2Res.body.data.pagination.hasPrev).toBe(true);
    });

    it('should filter products by color matching variant attributes', async () => {
      const response = await request(app).get('/api/v1/products?color=Navy');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.products.length).toBeGreaterThan(0);

      response.body.data.products.forEach((prod) => {
        const hasNavy = prod.variants.some((v) =>
          String(v.color).toLowerCase().includes('navy')
        );
        expect(hasNavy).toBe(true);
      });
    });
  });
});
