const request = require('supertest');
const app = require('../../src/app');
const { generateAccessToken } = require('../../src/services/token.service');
const {
  Address,
  Order,
  OrderItem,
  ProductVariant,
  Product,
  Category,
  Review,
  sequelize,
} = require('../../src/models');
const redisClient = require('../../src/config/redis');

describe('Customer Profile & Reviews Lifecycle', () => {
  const customerA = {
    id: 'b0000000-0000-0000-0000-000000000003', // pabasara@example.lk
    email: 'pabasara@example.lk',
    role: 'customer',
  };

  const customerB = {
    id: 'b0000000-0000-0000-0000-000000000004', // thanoo@example.lk
    email: 'thanoo@example.lk',
    role: 'customer',
  };

  const tokenA = generateAccessToken(customerA);
  const tokenB = generateAccessToken(customerB);

  let category;
  let product;
  let variant;
  let shippedOrder;
  let deliveredOrderA;
  let deliveredOrderB;
  let address1Id;
  let address2Id;

  beforeAll(async () => {
    try {
      // 1. Clean previous test artifacts for deterministic runs
      await Review.destroy({ where: { user_id: [customerA.id, customerB.id] } });
      await Address.destroy({ where: { user_id: [customerA.id, customerB.id] } });

      // 2. Setup product catalog fixtures
      category = await Category.create({
        name: `Integrated Cat ${Date.now()}`,
        slug: `integrated-cat-${Date.now()}`,
        description: 'Customer lifecycle integration testing',
      });

      product = await Product.create({
        category_id: category.id,
        title: `Linen Safari Shirt ${Date.now()}`,
        slug: `linen-safari-shirt-${Date.now()}`,
        base_price: 6200.0,
        is_active: true,
      });

      variant = await ProductVariant.create({
        product_id: product.id,
        sku: `SAFARI-${Date.now()}`,
        size: 'L',
        color: 'Olive Green',
        stock_quantity: 40,
        reserved_quantity: 0,
        price_override: null,
      });

      // 3. Shipped order fixture for Customer A
      shippedOrder = await Order.create({
        order_number: `DFC-SHIP-${Date.now()}`,
        customer_id: customerA.id,
        order_status: 'shipped',
        payment_status: 'paid',
        total_amount: 6200.0,
        shipping_amount: 0.0,
        discount_amount: 0.0,
        shipping_address_snapshot: { city: 'Dickwella' },
        notes: 'In-transit order',
      });

      await OrderItem.create({
        order_id: shippedOrder.id,
        product_variant_id: variant.id,
        quantity: 1,
        unit_price_at_purchase: 6200.0,
        total_price: 6200.0,
        product_title_snapshot: product.title,
        variant_sku_snapshot: variant.sku,
      });
    } catch (err) {
      // Allow fallback if running in disconnected offline mode
      console.warn('Database fixture setup note:', err.message);
    }
  });

  afterAll(async () => {
    try {
      await Review.destroy({ where: { user_id: [customerA.id, customerB.id] } });
      await Address.destroy({ where: { user_id: [customerA.id, customerB.id] } });
      if (shippedOrder) {
        await OrderItem.destroy({ where: { order_id: shippedOrder.id } });
        await Order.destroy({ where: { id: shippedOrder.id } });
      }
      if (deliveredOrderA) {
        await OrderItem.destroy({ where: { order_id: deliveredOrderA.id } });
        await Order.destroy({ where: { id: deliveredOrderA.id } });
      }
      if (deliveredOrderB) {
        await OrderItem.destroy({ where: { order_id: deliveredOrderB.id } });
        await Order.destroy({ where: { id: deliveredOrderB.id } });
      }
      if (variant) await ProductVariant.destroy({ where: { id: variant.id } });
      if (product) await Product.destroy({ where: { id: product.id } });
      if (category) await Category.destroy({ where: { id: category.id } });

      await sequelize.close();
      await redisClient.quit();
    } catch {
      // Ignore teardown disconnect errors
    }
  });

  it('Update customer profile', async () => {
    const res = await request(app)
      .put('/api/v1/users/me')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        phone_number: '+94770001122',
        first_name: 'Pabasara',
        last_name: 'Bandara',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('id', customerA.id);
    expect(res.body.data.phone_number).toBe('+94770001122');
  });

  it('Add shipping address and toggle default', async () => {
    // 1. Create first address as default
    const res1 = await request(app)
      .post('/api/v1/users/addresses')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        address_line1: 'No 45 Tangalle Road',
        city: 'Dickwella',
        state: 'Southern',
        postal_code: '81100',
        country: 'LK',
        is_default: true,
      });

    expect(res1.status).toBe(201);
    expect(res1.body.success).toBe(true);
    expect(res1.body.data.is_default).toBe(true);
    address1Id = res1.body.data.id;

    // 2. Create second address also marked as default
    const res2 = await request(app)
      .post('/api/v1/users/addresses')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        address_line1: 'No 88 Beach Front Villa',
        city: 'Matara',
        state: 'Southern',
        postal_code: '81000',
        country: 'LK',
        is_default: true,
      });

    expect(res2.status).toBe(201);
    expect(res2.body.success).toBe(true);
    expect(res2.body.data.is_default).toBe(true);
    address2Id = res2.body.data.id;

    // 3. Verify that address1 was automatically downgraded to is_default: false
    const listRes = await request(app)
      .get('/api/v1/users/addresses')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.success).toBe(true);
    expect(Array.isArray(listRes.body.data)).toBe(true);

    const addr1 = listRes.body.data.find((a) => a.id === address1Id);
    const addr2 = listRes.body.data.find((a) => a.id === address2Id);

    expect(addr1.is_default).toBe(false);
    expect(addr2.is_default).toBe(true);
  });

  it('Block review when order is only in shipped status', async () => {
    const res = await request(app)
      .post(`/api/v1/products/${product.id}/reviews`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        rating: 5,
        title: 'Premature Review',
        comment: 'I have not received the package yet.',
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/verified buyers with delivered orders/i);
  });

  it('Allow review when order is delivered', async () => {
    // Transition or create a delivered order for Customer A
    deliveredOrderA = await Order.create({
      order_number: `DFC-DELIV-A-${Date.now()}`,
      customer_id: customerA.id,
      order_status: 'delivered',
      payment_status: 'paid',
      total_amount: 6200.0,
      shipping_amount: 0.0,
      discount_amount: 0.0,
      shipping_address_snapshot: { city: 'Dickwella' },
      notes: 'Delivered Order A',
    });

    await OrderItem.create({
      order_id: deliveredOrderA.id,
      product_variant_id: variant.id,
      quantity: 1,
      unit_price_at_purchase: 6200.0,
      total_price: 6200.0,
      product_title_snapshot: product.title,
      variant_sku_snapshot: variant.sku,
    });

    const res = await request(app)
      .post(`/api/v1/products/${product.id}/reviews`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        rating: 5,
        title: 'Outstanding Safari Shirt',
        comment: 'Comfortable linen and precise stitching. Perfect for southern coastal weather.',
        photos: ['https://storage.dickwellafashion.lk/reviews/shirt_front.jpg'],
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.is_verified_purchase).toBe(true);
    expect(res.body.data.rating).toBe(5);
    expect(res.body.data.photos).toHaveLength(1);
    expect(res.body.data.average_rating).toBe(5);
    expect(res.body.data.review_count).toBe(1);
  });

  it('Recalculate product average rating', async () => {
    // Deliver an order for Customer B to submit a 4-star review
    deliveredOrderB = await Order.create({
      order_number: `DFC-DELIV-B-${Date.now()}`,
      customer_id: customerB.id,
      order_status: 'delivered',
      payment_status: 'paid',
      total_amount: 6200.0,
      shipping_amount: 0.0,
      discount_amount: 0.0,
      shipping_address_snapshot: { city: 'Matara' },
      notes: 'Delivered Order B',
    });

    await OrderItem.create({
      order_id: deliveredOrderB.id,
      product_variant_id: variant.id,
      quantity: 1,
      unit_price_at_purchase: 6200.0,
      total_price: 6200.0,
      product_title_snapshot: product.title,
      variant_sku_snapshot: variant.sku,
    });

    const reviewRes = await request(app)
      .post(`/api/v1/products/${product.id}/reviews`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({
        rating: 4,
        title: 'Great fit and fabric',
        comment: 'Color is slightly darker than the studio picture, but quality is top tier.',
      });

    expect(reviewRes.status).toBe(201);
    expect(reviewRes.body.success).toBe(true);
    expect(reviewRes.body.data.rating).toBe(4);
    // (5 + 4) / 2 = 4.5
    expect(reviewRes.body.data.average_rating).toBe(4.5);
    expect(reviewRes.body.data.review_count).toBe(2);

    // Verify public review listing and rating summary aggregation
    const publicListRes = await request(app).get(`/api/v1/products/${product.id}/reviews`);

    expect(publicListRes.status).toBe(200);
    expect(publicListRes.body.success).toBe(true);
    expect(publicListRes.body.data.summary.average_rating).toBe(4.5);
    expect(publicListRes.body.data.summary.review_count).toBe(2);
    expect(publicListRes.body.data.reviews).toHaveLength(2);
  });
});
