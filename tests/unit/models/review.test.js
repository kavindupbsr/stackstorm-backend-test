const { Review, Wishlist, User, Product } = require('../../../src/models');

describe('Review & Wishlist Models Unit Tests (Shift-Left Validation)', () => {
  describe('Review Model', () => {
    it('should instantiate a valid review instance with default values', () => {
      const review = Review.build({
        user_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        product_id: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
        rating: 5,
        title: 'Exquisite Silk Texture',
        comment: 'The craftsmanship on this saree exceeded my expectations.',
      });

      expect(review.rating).toBe(5);
      expect(review.title).toBe('Exquisite Silk Texture');
      expect(review.is_verified_purchase).toBe(false);
      expect(review.id).toBeDefined();
    });

    it('should accept valid rating values between 1 and 5', async () => {
      for (const rating of [1, 2, 3, 4, 5]) {
        const review = Review.build({
          user_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
          product_id: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
          rating,
        });

        // eslint-disable-next-line no-await-in-loop
        const validationError = await review.validate().catch((err) => err);
        expect(validationError).not.toBeInstanceOf(Error);
      }
    });

    it('should reject rating less than 1', async () => {
      const review = Review.build({
        user_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        product_id: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
        rating: 0,
      });

      await expect(review.validate()).rejects.toThrow();
    });

    it('should reject rating greater than 5', async () => {
      const review = Review.build({
        user_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        product_id: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
        rating: 6,
      });

      await expect(review.validate()).rejects.toThrow();
    });

    it('should reject missing user_id or product_id', async () => {
      const reviewMissingUser = Review.build({
        product_id: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
        rating: 4,
      });
      await expect(reviewMissingUser.validate()).rejects.toThrow();

      const reviewMissingProduct = Review.build({
        user_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        rating: 4,
      });
      await expect(reviewMissingProduct.validate()).rejects.toThrow();
    });

    it('should define belongsTo User and Product associations', () => {
      expect(Review.associations.user).toBeDefined();
      expect(Review.associations.user.target).toBe(User);
      expect(Review.associations.user.foreignKey).toBe('user_id');

      expect(Review.associations.product).toBeDefined();
      expect(Review.associations.product.target).toBe(Product);
      expect(Review.associations.product.foreignKey).toBe('product_id');
    });
  });

  describe('Wishlist Model', () => {
    it('should instantiate a valid wishlist item', () => {
      const wishlistItem = Wishlist.build({
        user_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        product_id: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
      });

      expect(wishlistItem.user_id).toBe('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');
      expect(wishlistItem.product_id).toBe('b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22');
      expect(wishlistItem.id).toBeDefined();
    });

    it('should reject missing user_id or product_id', async () => {
      const wishlistMissingUser = Wishlist.build({
        product_id: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
      });
      await expect(wishlistMissingUser.validate()).rejects.toThrow();

      const wishlistMissingProduct = Wishlist.build({
        user_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      });
      await expect(wishlistMissingProduct.validate()).rejects.toThrow();
    });

    it('should define belongsTo User and Product associations', () => {
      expect(Wishlist.associations.user).toBeDefined();
      expect(Wishlist.associations.user.target).toBe(User);
      expect(Wishlist.associations.user.foreignKey).toBe('user_id');

      expect(Wishlist.associations.product).toBeDefined();
      expect(Wishlist.associations.product.target).toBe(Product);
      expect(Wishlist.associations.product.foreignKey).toBe('product_id');
    });
  });
});
