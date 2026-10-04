const cartService = require('../../../src/services/cart.service');
const cacheService = require('../../../src/services/cache.service');
const { CartItem, sequelize } = require('../../../src/models');

describe('Unit: Shopping Cart Merge & Subtotal Calculations (STORM-023)', () => {
  const userId = 'usr-test-merge-001';
  const guestSessionId = 'guest_sess_merge_test_999';

  beforeEach(async () => {
    cartService.fallbackUserCarts.clear();
    await cacheService.del(`cart:guest:${guestSessionId}`);
  });

  afterAll(async () => {
    try {
      cartService.fallbackUserCarts.clear();
      await cacheService.del(`cart:guest:${guestSessionId}`);
      await sequelize.close();
    } catch {
      // Ignore cleanup error if already closed
    }
  });

  describe('calculateSubtotal & formatLkr', () => {
    it('should calculate subtotal correctly and match autonomous probe format', () => {
      const items = [{ unit_price: 3500.0, quantity: 2 }];
      const total = cartService.calculateSubtotal(items);

      expect(total).toBe('7000.00');
    });

    it('should calculate zero subtotal for empty cart', () => {
      const total = cartService.calculateSubtotal([]);
      expect(total).toBe('0.00');
    });

    it('should format numbers into Sri Lankan Rupees (LKR)', () => {
      const formatted = cartService.formatLkr(7000);
      expect(formatted).toBe('LKR 7,000.00');
    });
  });

  describe('cartService.mergeCart Atomic Merge Logic', () => {
    it('should return existing user cart if guest cart is empty or absent', async () => {
      // Seed user cart with 1 item
      cartService.fallbackUserCarts.set(userId, [
        {
          id: 'item-u1',
          product_variant_id: 'v-001',
          variant_id: 'v-001',
          quantity: 2,
          unit_price: 3000,
        },
      ]);

      const merged = await cartService.mergeCart({
        userId,
        guestSessionId: 'non_existent_guest',
      });

      expect(merged.items.length).toBe(1);
      expect(merged.items[0].quantity).toBe(2);
    });

    it('should combine guest and customer cart items without duplicate entries when variants collide', async () => {
      const variantId = 'd0000000-0000-0000-0000-000000000001'; // Batik Shirt M (Stock: 25)

      // 1. Seed user cart with 2 units
      cartService.fallbackUserCarts.set(userId, [
        {
          id: 'item-user-batik',
          product_variant_id: variantId,
          variant_id: variantId,
          quantity: 2,
          unit_price: 5500,
        },
      ]);

      // 2. Seed guest cart in Redis with 3 units of the SAME variant
      await cacheService.set(
        `cart:guest:${guestSessionId}`,
        [
          {
            id: 'item-guest-batik',
            product_variant_id: variantId,
            variant_id: variantId,
            quantity: 3,
            unit_price: 5500,
          },
        ],
        3600
      );

      // Mock database findOne to fallback cleanly if running without active migrations
      jest.spyOn(CartItem, 'findOne').mockRejectedValue(new Error('DB Offline'));

      // 3. Merge guest cart into user account
      const merged = await cartService.mergeCart({ userId, guestSessionId });

      // Assert exactly 1 line item exists (no duplicate entries)
      expect(merged.items.length).toBe(1);
      // Assert combined quantity is 2 + 3 = 5
      expect(merged.items[0].quantity).toBe(5);
      expect(merged.items[0].product_variant_id).toBe(variantId);

      // Assert Redis guest cart was evicted after merge
      const guestAfter = await cacheService.get(`cart:guest:${guestSessionId}`);
      expect(guestAfter).toBeNull();
    });

    it('should cap merged quantity at available stock when collision exceeds inventory limit', async () => {
      const limitedVariantId = 'v-limited-stock-999';

      // Mock getVariantDetails to report limited available stock of 5
      jest.spyOn(cartService, 'getVariantDetails').mockResolvedValue({
        id: limitedVariantId,
        availableStock: 5,
        stock_quantity: 5,
        reserved_quantity: 0,
        unit_price: 4000,
        product: { id: 'p-1', title: 'Limited Edition Shirt' },
      });

      // User already has 3 units
      cartService.fallbackUserCarts.set(userId, [
        {
          id: 'item-user-limited',
          product_variant_id: limitedVariantId,
          variant_id: limitedVariantId,
          quantity: 3,
          unit_price: 4000,
        },
      ]);

      // Guest adds 4 units (3 + 4 = 7, but available is 5)
      await cacheService.set(
        `cart:guest:${guestSessionId}`,
        [
          {
            id: 'item-guest-limited',
            product_variant_id: limitedVariantId,
            variant_id: limitedVariantId,
            quantity: 4,
            unit_price: 4000,
          },
        ],
        3600
      );

      const merged = await cartService.mergeCart({ userId, guestSessionId });

      expect(merged.items.length).toBe(1);
      // Merged quantity must be capped at availableStock (5)
      expect(merged.items[0].quantity).toBe(5);
    });
  });
});
