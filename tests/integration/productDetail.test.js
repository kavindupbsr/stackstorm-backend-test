const request = require('supertest');
const app = require('../../src/app');
const redisClient = require('../../src/config/redis');
const { sequelize } = require('../../src/models');

describe('Integration: Product Detail API with Variant Matrix & Gallery (STORM-020)', () => {
  afterAll(async () => {
    try {
      await sequelize.close();
      await redisClient.quit();
    } catch {
      // Ignore cleanup error if already closed
    }
  });

  describe('GET /api/v1/products/:slug', () => {
    it('should return 200 with complete product details, variants matrix, and images', async () => {
      const response = await request(app).get(
        '/api/v1/products/classic-linen-batik-shirt'
      );

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Product details retrieved successfully');

      const product = response.body.data;
      expect(product).toHaveProperty('id');
      expect(product).toHaveProperty('title');
      expect(product).toHaveProperty('slug', 'classic-linen-batik-shirt');
      expect(product).toHaveProperty('base_price');
      expect(product).toHaveProperty('description');
      expect(product).toHaveProperty('category');
      expect(product).toHaveProperty('primary_image');
      expect(product).toHaveProperty('availableStock');

      // Assert gallery images ordered by display_order ASC
      expect(Array.isArray(product.images)).toBe(true);
      expect(product.images.length).toBeGreaterThan(0);
      for (let i = 0; i < product.images.length - 1; i += 1) {
        expect(product.images[i].display_order).toBeLessThanOrEqual(
          product.images[i + 1].display_order
        );
      }

      // Assert variant matrix and available_stock calculation
      expect(Array.isArray(product.variants)).toBe(true);
      expect(product.variants.length).toBeGreaterThan(0);
      product.variants.forEach((v) => {
        expect(v).toHaveProperty('sku');
        expect(v).toHaveProperty('size');
        expect(v).toHaveProperty('color');
        expect(v).toHaveProperty('stock_quantity');
        expect(v).toHaveProperty('reserved_quantity');
        expect(v).toHaveProperty('available_stock');
        expect(v.available_stock).toBe(
          Math.max(0, v.stock_quantity - v.reserved_quantity)
        );
      });

      // Assert review statistics
      expect(product).toHaveProperty('reviews');
      expect(product).toHaveProperty('review_count');
      expect(product).toHaveProperty('average_rating');
      expect(typeof product.average_rating).toBe('number');
    });

    it('should retrieve existing product using standard slug from seeders', async () => {
      const response = await request(app).get(
        '/api/v1/products/tailored-charcoal-formal-trousers'
      );

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.slug).toBe('tailored-charcoal-formal-trousers');
      expect(response.body.data.variants.length).toBeGreaterThan(0);
    });

    it('should return HTTP 404 when querying a non-existent product slug', async () => {
      const nonExistentSlug = 'completely-unknown-fashion-item-999';
      const response = await request(app).get(
        `/api/v1/products/${nonExistentSlug}`
      );

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.data).toBeNull();
      expect(response.body.message).toContain(nonExistentSlug);
    });
  });
});
