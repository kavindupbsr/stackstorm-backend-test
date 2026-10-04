const categoryService = require('../../../src/services/category.service');
const redisClient = require('../../../src/config/redis');
const { Category } = require('../../../src/models');

describe('Unit: Category Service & Sub-Tree Caching (STORM-018)', () => {
  beforeEach(async () => {
    await redisClient.del(categoryService.CACHE_KEY);
    jest.clearAllMocks();
  });

  describe('buildCategoryTree recursive mapping', () => {
    it('should nest child categories under their parent and maintain root elements', () => {
      const flatCategories = [
        { id: '1', name: 'Men', slug: 'men', parent_id: null },
        { id: '11', name: 'Batik Shirts', slug: 'men-batik', parent_id: '1' },
        { id: '12', name: 'Casual Trousers', slug: 'men-trousers', parent_id: '1' },
        { id: '2', name: 'Women', slug: 'women', parent_id: null },
        { id: '21', name: 'Silk Saris', slug: 'women-saris', parent_id: '2' },
        { id: '211', name: 'Kandyan Saris', slug: 'women-kandyan', parent_id: '21' },
      ];

      const tree = categoryService.buildCategoryTree(flatCategories);

      expect(tree).toHaveLength(2);
      expect(tree[0].name).toBe('Men');
      expect(tree[0].children).toHaveLength(2);
      expect(tree[0].children[0].name).toBe('Batik Shirts');
      expect(tree[0].children[1].name).toBe('Casual Trousers');

      expect(tree[1].name).toBe('Women');
      expect(tree[1].children).toHaveLength(1);
      expect(tree[1].children[0].name).toBe('Silk Saris');
      expect(tree[1].children[0].children).toHaveLength(1);
      expect(tree[1].children[0].children[0].name).toBe('Kandyan Saris');
    });

    it('should handle circular references without stack overflow', () => {
      const circularCategories = [
        { id: 'a', name: 'Category A', slug: 'a', parent_id: 'b' },
        { id: 'b', name: 'Category B', slug: 'b', parent_id: 'a' },
      ];

      // Starting with null parent won't match either, but let's test direct parent 'a'
      const tree = categoryService.buildCategoryTree(circularCategories, 'a');
      expect(Array.isArray(tree)).toBe(true);
      expect(tree[0].id).toBe('b');
      // 'b' should not recursively contain 'a' again due to visited guard
      expect(tree[0].children).toHaveLength(0);
    });

    it('should return empty array if categories list is empty', () => {
      const tree = categoryService.buildCategoryTree([]);
      expect(tree).toEqual([]);
    });
  });

  describe('Cache-Aside with Redis', () => {
    it('should query database on cache miss and write to Redis with 24h TTL', async () => {
      const mockDbCategories = [
        { id: 'm1', name: 'Men', slug: 'men', parent_id: null, is_active: true },
        { id: 'w1', name: 'Women', slug: 'women', parent_id: null, is_active: true },
      ];

      jest.spyOn(Category, 'findAll').mockResolvedValue(mockDbCategories);
      const setSpy = jest.spyOn(redisClient, 'set');

      const tree = await categoryService.getCategoryTree();

      expect(tree).toHaveLength(2);
      expect(tree.fromCache).toBe(false);
      expect(setSpy).toHaveBeenCalledWith(
        categoryService.CACHE_KEY,
        expect.any(String),
        'EX',
        categoryService.CACHE_TTL_SECONDS
      );
    });

    it('should serve directly from Redis on cache hit without database query', async () => {
      const cachedTree = [{ id: 'c1', name: 'Cached Category', slug: 'cached', children: [] }];
      await redisClient.set(categoryService.CACHE_KEY, JSON.stringify(cachedTree));

      const dbSpy = jest.spyOn(Category, 'findAll');

      const tree = await categoryService.getCategoryTree();

      expect(tree).toHaveLength(1);
      expect(tree[0].name).toBe('Cached Category');
      expect(tree.fromCache).toBe(true);
      expect(dbSpy).not.toHaveBeenCalled();
    });

    it('should invalidate cache when invalidateCategoryCache is invoked', async () => {
      await redisClient.set(categoryService.CACHE_KEY, 'sample-data');
      const delSpy = jest.spyOn(redisClient, 'del');

      await categoryService.invalidateCategoryCache();

      expect(delSpy).toHaveBeenCalledWith(categoryService.CACHE_KEY);
      const remaining = await redisClient.get(categoryService.CACHE_KEY);
      expect(remaining).toBeNull();
    });
  });
});
