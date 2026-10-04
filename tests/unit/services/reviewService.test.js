const reviewService = require('../../../src/services/review.service');
const {
  Review,
  Order,
  OrderItem,
  ProductVariant,
  Product,
  Category,
  sequelize,
} = require('../../../src/models');
const redisClient = require('../../../src/config/redis');

describe('Unit: ReviewService & Delivered Buyer Gate (STORM-034)', () => {
  const buyerId = 'b0000000-0000-0000-0000-000000000003';
  let category;
  let product;
  let variant;
  let processingOrder;

  beforeAll(async () => {
    try {
      category = await Category.create({
        name: `Unit Review Cat ${Date.now()}`,
        slug: `unit-rev-cat-${Date.now()}`,
      });

      product = await Product.create({
        category_id: category.id,
        title: `Silk Batik Kaftan ${Date.now()}`,
        slug: `silk-batik-kaftan-${Date.now()}`,
        base_price: 9000.0,
      });

      variant = await ProductVariant.create({
        product_id: product.id,
        sku: `KAFTAN-${Date.now()}`,
        size: 'FREE',
        color: 'Ruby Red',
        stock_quantity: 30,
      });

      // Order with status 'processing' (NOT delivered)
      processingOrder = await Order.create({
        order_number: `ORD-UNIT-PROC-${Date.now()}`,
        customer_id: buyerId,
        order_status: 'processing',
        payment_status: 'paid',
        total_amount: 9000.0,
        shipping_amount: 0.0,
        discount_amount: 0.0,
        shipping_address_snapshot: { city: 'Galle' },
      });

      await OrderItem.create({
        order_id: processingOrder.id,
        product_variant_id: variant.id,
        quantity: 1,
        unit_price_at_purchase: 9000.0,
        total_price: 9000.0,
        product_title_snapshot: product.title,
        variant_sku_snapshot: variant.sku,
      });
    } catch {
      // Offline fallback
    }
  });

  afterAll(async () => {
    try {
      if (product && product.id) {
        await Review.destroy({ where: { product_id: product.id } });
      }
      if (processingOrder && processingOrder.id) {
        await OrderItem.destroy({ where: { order_id: processingOrder.id } });
        await Order.destroy({ where: { id: processingOrder.id } });
      }
      if (variant && variant.id) {
        await ProductVariant.destroy({ where: { id: variant.id } });
      }
      if (product && product.id) {
        await Product.destroy({ where: { id: product.id } });
      }
      if (category && category.id) {
        await Category.destroy({ where: { id: category.id } });
      }
      await sequelize.close();
      await redisClient.quit();
    } catch {
      // Offline fallback
    }
  });

  describe('Rating Validation', () => {
    it('should throw badRequest if rating is not between 1 and 5', async () => {
      await expect(
        reviewService.createReview(buyerId, product.id, { rating: 0 })
      ).rejects.toThrow(/rating must be an integer between 1 and 5/i);

      await expect(
        reviewService.createReview(buyerId, product.id, { rating: 6 })
      ).rejects.toThrow(/rating must be an integer between 1 and 5/i);

      await expect(
        reviewService.createReview(buyerId, product.id, { rating: 3.5 })
      ).rejects.toThrow(/rating must be an integer between 1 and 5/i);
    });
  });

  describe('Delivered Purchase Gate (SRS FR-018)', () => {
    it('should reject review when customer order status is processing or shipped', async () => {
      await expect(
        reviewService.createReview(buyerId, product.id, {
          rating: 5,
          comment: 'Processing order cannot be reviewed yet',
        })
      ).rejects.toThrow(/only verified buyers with delivered orders can review this product/i);
    });

    it('should allow review after order transitions to delivered', async () => {
      // Transition order status to delivered
      await processingOrder.update({ order_status: 'delivered' });

      const review = await reviewService.createReview(buyerId, product.id, {
        rating: 5,
        title: 'Delivered and verified!',
        comment: 'High quality silk garment.',
      });

      expect(review.id).toBeDefined();
      expect(review.is_verified_purchase).toBe(true);
      expect(review.rating).toBe(5);
    });
  });

  describe('Rating Stats Calculation', () => {
    it('should calculate accurate average rating and count', async () => {
      const stats = await reviewService.getProductRatingStats(product.id);
      expect(stats.review_count).toBe(1);
      expect(stats.average_rating).toBe(5.0);
    });
  });
});
