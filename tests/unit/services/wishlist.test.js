const wishlistService = require('../../../src/services/wishlist.service');

describe('Unit: Wishlist Service & Shift-Left Logic (STORM-025)', () => {
  const mockUserId = 'b0000000-0000-0000-0000-000000000001';
  const mockProductId = 'c0000000-0000-0000-0000-000000000001';
  const secondMockProductId = 'c0000000-0000-0000-0000-000000000002';

  beforeEach(() => {
    wishlistService.resetFallbackStore();
  });

  afterEach(() => {
    wishlistService.resetFallbackStore();
  });

  describe('formatWishlistItem', () => {
    it('should format product with primary image, LKR price, and availableStock calculation', () => {
      const rawItem = {
        id: 'wishlist-uuid-1',
        user_id: mockUserId,
        product_id: mockProductId,
        created_at: new Date('2026-10-01T00:00:00Z'),
        product: {
          id: mockProductId,
          title: 'Classic Batik Shirt',
          slug: 'classic-batik-shirt',
          base_price: '4850.00',
          images: [
            { id: 'img-1', image_url: 'https://cdn.dickwella.lk/img1.webp', is_primary: true },
          ],
          variants: [
            {
              id: 'var-1',
              sku: 'BATIK-M',
              stock_quantity: 10,
              reserved_quantity: 2,
            },
            {
              id: 'var-2',
              sku: 'BATIK-L',
              stock_quantity: 5,
              reserved_quantity: 0,
            },
          ],
        },
      };

      const formatted = wishlistService.formatWishlistItem(rawItem);

      expect(formatted.id).toBe('wishlist-uuid-1');
      expect(formatted.product.title).toBe('Classic Batik Shirt');
      expect(formatted.product.base_price).toBe(4850);
      expect(formatted.product.formatted_price).toBe('LKR 4,850.00');
      expect(formatted.product.primary_image).toBe('https://cdn.dickwella.lk/img1.webp');
      expect(formatted.product.available_stock).toBe(13); // (10-2) + (5-0)
      expect(formatted.product.in_stock).toBe(true);
    });

    it('should handle product with 0 available stock and mark in_stock as false', () => {
      const rawItem = {
        id: 'wishlist-uuid-2',
        user_id: mockUserId,
        product_id: mockProductId,
        product: {
          id: mockProductId,
          title: 'Sold Out Item',
          base_price: 1500,
          variants: [
            {
              id: 'var-1',
              stock_quantity: 5,
              reserved_quantity: 5,
            },
          ],
        },
      };

      const formatted = wishlistService.formatWishlistItem(rawItem);

      expect(formatted.product.available_stock).toBe(0);
      expect(formatted.product.in_stock).toBe(false);
    });
  });

  describe('toggleWishlist Unit Behavior', () => {
    it('should toggle item: add when absent, remove when present', async () => {
      // 1. Initial toggle should add
      const addResult = await wishlistService.toggleWishlist(mockUserId, mockProductId);
      expect(addResult.wishlisted).toBe(true);
      expect(addResult.message).toMatch(/added to wishlist/i);

      // 2. Second toggle should remove
      const removeResult = await wishlistService.toggleWishlist(mockUserId, mockProductId);
      expect(removeResult.wishlisted).toBe(false);
      expect(removeResult.message).toMatch(/removed from wishlist/i);

      // 3. Third toggle should add again
      const reAddResult = await wishlistService.toggleWishlist(mockUserId, mockProductId);
      expect(reAddResult.wishlisted).toBe(true);
    });

    it('should throw unauthorized ApiError if userId is missing', async () => {
      await expect(wishlistService.toggleWishlist(null, mockProductId)).rejects.toThrow(
        /User ID is required/i
      );
    });

    it('should throw badRequest ApiError if productId is missing', async () => {
      await expect(wishlistService.toggleWishlist(mockUserId, null)).rejects.toThrow(
        /Product ID is required/i
      );
    });
  });

  describe('triggerRestockAlerts Unit Behavior', () => {
    it('should return dispatch payload with notified count and product title', async () => {
      const summary = await wishlistService.triggerRestockAlerts(secondMockProductId, {
        restocked_qty: 25,
      });

      expect(summary.product_id).toBe(secondMockProductId);
      expect(typeof summary.notified_count).toBe('number');
      expect(Array.isArray(summary.subscribers)).toBe(true);
    });
  });
});
