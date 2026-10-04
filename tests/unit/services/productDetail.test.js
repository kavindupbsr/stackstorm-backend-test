const productService = require('../../../src/services/product.service');

describe('Unit: Product Detail & Variant Matrix Engine (STORM-020)', () => {
  describe('getProductBySlug logic', () => {
    it('should retrieve a product by slug with category, variants, and gallery images', async () => {
      const product = await productService.getProductBySlug('classic-linen-batik-shirt');

      expect(product).not.toBeNull();
      expect(product.slug).toBe('classic-linen-batik-shirt');
      expect(product.title).toBe('Classic Linen Batik Shirt');
      expect(product.variants.length).toBeGreaterThan(0);
      expect(product.images.length).toBeGreaterThan(0);
    });

    it('should calculate available_stock strictly as Math.max(0, stock_quantity - reserved_quantity)', async () => {
      const product = await productService.getProductBySlug('classic-linen-batik-shirt');

      expect(product).not.toBeNull();
      product.variants.forEach((v) => {
        const expected = Math.max(0, v.stock_quantity - v.reserved_quantity);
        expect(v.available_stock).toBe(expected);
        expect(v.availableStock).toBe(expected);
        expect(v.available_stock).toBeGreaterThanOrEqual(0);
      });
    });

    it('should sort images in ascending order of display_order', async () => {
      const product = await productService.getProductBySlug('classic-linen-batik-shirt');

      expect(product.images.length).toBeGreaterThan(1);
      for (let i = 0; i < product.images.length - 1; i += 1) {
        expect(product.images[i].display_order).toBeLessThanOrEqual(
          product.images[i + 1].display_order
        );
      }
    });

    it('should aggregate verified review summary statistics (average_rating and review_count)', async () => {
      const product = await productService.getProductBySlug('classic-linen-batik-shirt');

      expect(product).toHaveProperty('review_count');
      expect(product).toHaveProperty('average_rating');
      expect(typeof product.average_rating).toBe('number');
      expect(product.average_rating).toBeGreaterThanOrEqual(1);
      expect(product.average_rating).toBeLessThanOrEqual(5);
    });

    it('should return null when querying an unknown or non-existent slug', async () => {
      const product = await productService.getProductBySlug('non-existent-batik-outfit');

      expect(product).toBeNull();
    });

    it('should return null when slug is empty or undefined', async () => {
      const product = await productService.getProductBySlug('');
      expect(product).toBeNull();
    });
  });
});
