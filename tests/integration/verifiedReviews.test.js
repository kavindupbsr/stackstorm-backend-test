const request = require('supertest');
const app = require('../../src/app');
const { generateAccessToken } = require('../../src/services/token.service');
const {
  Order,
  OrderItem,
  ProductVariant,
  Product,
  Category,
  Review,
  sequelize,
} = require('../../src/models');
const redisClient = require('../../src/config/redis');

describe('Integration: Verified Purchase Reviews & Photo Upload (STORM-034)', () => {
  const verifiedBuyer = {
    id: 'b0000000-0000-0000-0000-000000000003', // pabasara@example.lk
    email: 'pabasara@example.lk',
    role: 'customer',
  };

  const unverifiedBuyer = {
    id: 'b0000000-0000-0000-0000-000000000004', // thanoo@example.lk
    email: 'thanoo@example.lk',
    role: 'customer',
  };

  const inTransitBuyer = {
    id: 'b0000000-0000-0000-0000-000000000005', // lakshani@example.lk
    email: 'lakshani@example.lk',
    role: 'customer',
  };

  const verifiedToken = generateAccessToken(verifiedBuyer);
  const unverifiedToken = generateAccessToken(unverifiedBuyer);
  const inTransitToken = generateAccessToken(inTransitBuyer);

  let category;
  let product;
  let variant;
  let deliveredOrder;
  let inTransitOrder;

  beforeAll(async () => {
    try {
      category = await Category.create({
        name: `Review Cat ${Date.now()}`,
        slug: `review-cat-${Date.now()}`,
        description: 'Review policy testing category',
      });

      product = await Product.create({
        category_id: category.id,
        title: `Handloom Casual Shirt ${Date.now()}`,
        slug: `handloom-casual-shirt-${Date.now()}`,
        base_price: 5500.0,
        is_active: true,
      });

      variant = await ProductVariant.create({
        product_id: product.id,
        sku: `SHIRT-REV-${Date.now()}`,
        size: 'M',
        color: 'Indigo',
        stock_quantity: 50,
        reserved_quantity: 0,
        price_override: null,
      });

      // 1. Delivered order for verifiedBuyer
      deliveredOrder = await Order.create({
        order_number: `DFC-DELIV-${Date.now()}`,
        customer_id: verifiedBuyer.id,
        order_status: 'delivered',
        payment_status: 'paid',
        total_amount: 5500.0,
        shipping_amount: 0.0,
        discount_amount: 0.0,
        shipping_address_snapshot: { city: 'Dickwella' },
        notes: 'Delivered Order Fixture',
      });

      await OrderItem.create({
        order_id: deliveredOrder.id,
        product_variant_id: variant.id,
        quantity: 1,
        unit_price_at_purchase: 5500.0,
        total_price: 5500.0,
        product_title_snapshot: product.title,
        variant_sku_snapshot: variant.sku,
      });

      // 2. In-transit (shipped) order for inTransitBuyer
      inTransitOrder = await Order.create({
        order_number: `DFC-TRANSIT-${Date.now()}`,
        customer_id: inTransitBuyer.id,
        order_status: 'shipped',
        payment_status: 'paid',
        total_amount: 5500.0,
        shipping_amount: 0.0,
        discount_amount: 0.0,
        shipping_address_snapshot: { city: 'Matara' },
        notes: 'In-Transit Order Fixture',
      });

      await OrderItem.create({
        order_id: inTransitOrder.id,
        product_variant_id: variant.id,
        quantity: 1,
        unit_price_at_purchase: 5500.0,
        total_price: 5500.0,
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
      const orderIds = [deliveredOrder && deliveredOrder.id, inTransitOrder && inTransitOrder.id].filter(
        Boolean
      );
      if (orderIds.length > 0) {
        await OrderItem.destroy({ where: { order_id: orderIds } });
        await Order.destroy({ where: { id: orderIds } });
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
      // Teardown fallback
    }
  });

  describe('Unauthenticated Protection', () => {
    it('should reject POST /api/v1/products/:id/reviews with 401 when token is missing', async () => {
      const res = await request(app)
        .post(`/api/v1/products/${product.id}/reviews`)
        .send({ rating: 5, comment: 'Nice shirt' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/authentication token is required/i);
    });
  });

  describe('AC1 & AC2: Verified Buyer Gatekeeper (SRS FR-018)', () => {
    it('should reject review with 403 Forbidden when customer has never purchased the product', async () => {
      const res = await request(app)
        .post(`/api/v1/products/${product.id}/reviews`)
        .set('Authorization', `Bearer ${unverifiedToken}`)
        .send({
          rating: 5,
          title: 'Fake Review',
          comment: 'I never bought this item',
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(
        /only verified buyers with delivered orders can review this product/i
      );
    });

    it('should reject review with 403 Forbidden when customer order is only in shipped status', async () => {
      const res = await request(app)
        .post(`/api/v1/products/${product.id}/reviews`)
        .set('Authorization', `Bearer ${inTransitToken}`)
        .send({
          rating: 4,
          title: 'Has not arrived yet',
          comment: 'Still waiting on courier delivery',
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(
        /only verified buyers with delivered orders can review this product/i
      );
    });

    it('should allow review submission when customer has a delivered order for the product', async () => {
      const res = await request(app)
        .post(`/api/v1/products/${product.id}/reviews`)
        .set('Authorization', `Bearer ${verifiedToken}`)
        .send({
          rating: 5,
          title: 'Superb quality!',
          comment: 'Fit is perfect, vibrant indigo dye. Delivered fast to Dickwella.',
          photos: ['https://cdn.dickwellafashion.lk/reviews/indigo-shirt-front.webp'],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.rating).toBe(5);
      expect(res.body.data.title).toBe('Superb quality!');
      expect(res.body.data.is_verified_purchase).toBe(true);
      expect(Array.isArray(res.body.data.photos)).toBe(true);
      expect(res.body.data.photos.length).toBe(1);
    });
  });

  describe('AC3: Composite Uniqueness Gate (1 Review per Product per Customer)', () => {
    it('should reject duplicate review with 409 Conflict when customer reviews same product again', async () => {
      const res = await request(app)
        .post(`/api/v1/products/${product.id}/reviews`)
        .set('Authorization', `Bearer ${verifiedToken}`)
        .send({
          rating: 4,
          title: 'Another review attempt',
          comment: 'Trying to review again',
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/already submitted a review/i);
    });
  });

  describe('AC4: Product Rating Recalculation & Reviews Retrieval', () => {
    it('should retrieve product reviews with rating breakdown and verified badge', async () => {
      const res = await request(app).get(`/api/v1/products/${product.id}/reviews`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.reviews)).toBe(true);
      expect(res.body.data.reviews.length).toBe(1);

      const review = res.body.data.reviews[0];
      expect(review.rating).toBe(5);
      expect(review.is_verified_purchase).toBe(true);
      expect(review.reviewer_name).toBeDefined();

      // Verify summary calculations
      expect(res.body.data.summary).toBeDefined();
      expect(res.body.data.summary.average_rating).toBe(5.0);
      expect(res.body.data.summary.review_count).toBe(1);
      expect(res.body.data.summary.rating_breakdown['5']).toBe(1);
    });

    it('should reject invalid rating values with 400 Bad Request', async () => {
      const res = await request(app)
        .post(`/api/v1/products/${product.id}/reviews`)
        .set('Authorization', `Bearer ${verifiedToken}`)
        .send({
          rating: 6, // Exceeds 5
          comment: 'Invalid rating',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/rating must be an integer between 1 and 5/i);
    });
  });
});
