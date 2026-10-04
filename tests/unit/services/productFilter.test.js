const productService = require('../../../src/services/product.service');

describe('Unit: Product Filter & Query Engine (STORM-019)', () => {
  describe('In-Memory & Query Filter Specification Logic', () => {
    it('should filter products within specified LKR price range', async () => {
      const result = await productService.listProducts({
        min_price: 4000,
        max_price: 6000,
        limit: 50,
      });

      expect(result.products.length).toBeGreaterThan(0);
      result.products.forEach((prod) => {
        expect(prod.base_price).toBeGreaterThanOrEqual(4000);
        expect(prod.base_price).toBeLessThanOrEqual(6000);
      });
    });

    it('should filter products strictly by minimum price', async () => {
      const result = await productService.listProducts({
        min_price: 15000,
        limit: 50,
      });

      expect(result.products.length).toBeGreaterThan(0);
      result.products.forEach((prod) => {
        expect(prod.base_price).toBeGreaterThanOrEqual(15000);
      });
    });

    it('should filter products strictly by maximum price', async () => {
      const result = await productService.listProducts({
        max_price: 3500,
        limit: 50,
      });

      expect(result.products.length).toBeGreaterThan(0);
      result.products.forEach((prod) => {
        expect(prod.base_price).toBeLessThanOrEqual(3500);
      });
    });

    it('should filter products by size and ensure returned products have in-stock variants for that size', async () => {
      const result = await productService.listProducts({
        size: 'XL',
        limit: 50,
      });

      expect(result.products.length).toBeGreaterThan(0);
      result.products.forEach((prod) => {
        const matchingVariant = prod.variants.find(
          (v) => String(v.size).toUpperCase() === 'XL' && v.availableStock > 0
        );
        expect(matchingVariant).toBeDefined();
        expect(matchingVariant.availableStock).toBeGreaterThan(0);
      });
    });

    it('should filter products by color matching variant attributes', async () => {
      const result = await productService.listProducts({
        color: 'Ocean Blue',
        limit: 50,
      });

      expect(result.products.length).toBeGreaterThan(0);
      result.products.forEach((prod) => {
        const matchingVariant = prod.variants.find((v) =>
          String(v.color).toLowerCase().includes('blue')
        );
        expect(matchingVariant).toBeDefined();
      });
    });

    it('should filter products by category_id', async () => {
      const targetCategoryId = 'a0000000-0000-0000-0000-000000000011';
      const result = await productService.listProducts({
        category_id: targetCategoryId,
        limit: 50,
      });

      expect(result.products.length).toBeGreaterThan(0);
      result.products.forEach((prod) => {
        expect(prod.category_id).toBe(targetCategoryId);
      });
    });
  });

  describe('Sorting and Pagination Logic', () => {
    it('should sort products by price ascending', async () => {
      const result = await productService.listProducts({
        sort: 'price_asc',
        limit: 10,
      });

      expect(result.products.length).toBeGreaterThan(1);
      for (let i = 0; i < result.products.length - 1; i += 1) {
        expect(result.products[i].base_price).toBeLessThanOrEqual(
          result.products[i + 1].base_price
        );
      }
    });

    it('should sort products by price descending', async () => {
      const result = await productService.listProducts({
        sort: 'price_desc',
        limit: 10,
      });

      expect(result.products.length).toBeGreaterThan(1);
      for (let i = 0; i < result.products.length - 1; i += 1) {
        expect(result.products[i].base_price).toBeGreaterThanOrEqual(
          result.products[i + 1].base_price
        );
      }
    });

    it('should paginate items correctly with page, limit, and totalPages metadata', async () => {
      const page1 = await productService.listProducts({
        page: 1,
        limit: 3,
      });

      const page2 = await productService.listProducts({
        page: 2,
        limit: 3,
      });

      expect(page1.products).toHaveLength(3);
      expect(page2.products).toHaveLength(3);
      expect(page1.pagination.page).toBe(1);
      expect(page2.pagination.page).toBe(2);
      expect(page1.pagination.totalPages).toBeGreaterThanOrEqual(8);
      expect(page1.pagination.hasNext).toBe(true);
      expect(page1.pagination.hasPrev).toBe(false);
      expect(page2.pagination.hasPrev).toBe(true);
      expect(page1.products[0].id).not.toBe(page2.products[0].id);
    });

    it('should attach primary_image URL to each returned product', async () => {
      const result = await productService.listProducts({ limit: 5 });

      expect(result.products.length).toBeGreaterThan(0);
      result.products.forEach((prod) => {
        expect(typeof prod.primary_image === 'string' || prod.primary_image === null).toBe(true);
      });
    });
  });
});
