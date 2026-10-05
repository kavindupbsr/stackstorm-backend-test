const request = require('supertest');
const app = require('../../src/app');
const { generateAccessToken } = require('../../src/services/token.service');
const {
  User,
  Category,
  Product,
  ProductVariant,
  Order,
  OrderItem,
  Return,
  sequelize,
} = require('../../src/models');
const redisClient = require('../../src/config/redis');

describe('Integration: Return & Exchange Policy Workflow (STORM-038 / FR-021 / Issue #8)', () => {
  let customerUser;
  let otherCustomerUser;
  let adminUser;

  let customerToken;
  let otherCustomerToken;
  let adminToken;

  let category;
  let product;
  let finalSaleProduct;
  let variantM;
  let variantL;
  let outOfStockVariant;
  let finalSaleVariant;

  let deliveredOrder;
  let expiredOrder;
  let validOrderItem;
  let exchangeOrderItem;
  let expiredOrderItem;
  let finalSaleOrderItem;

  beforeAll(async () => {
    try {
      const ts = Date.now();

      // Create users
      customerUser = await User.create({
        email: `thanoo-cust-${ts}@example.lk`,
        password_hash: '$2b$10$hashedpassforintegrationtest000000000001',
        first_name: 'Thanoo',
        last_name: 'Githan',
        role: 'customer',
      });

      otherCustomerUser = await User.create({
        email: `other-cust-${ts}@example.lk`,
        password_hash: '$2b$10$hashedpassforintegrationtest000000000002',
        first_name: 'Other',
        last_name: 'User',
        role: 'customer',
      });

      adminUser = await User.create({
        email: `admin-return-${ts}@dickwellafashion.lk`,
        password_hash: '$2b$10$hashedpassforintegrationtest000000000003',
        first_name: 'Admin',
        last_name: 'Returns',
        role: 'admin',
      });

      customerToken = generateAccessToken(customerUser);
      otherCustomerToken = generateAccessToken(otherCustomerUser);
      adminToken = generateAccessToken(adminUser);

      // Create Catalog
      category = await Category.create({
        name: `Returns Integration Cat ${ts}`,
        slug: `returns-int-cat-${ts}`,
      });

      product = await Product.create({
        category_id: category.id,
        title: `Casual Linen Shirt ${ts}`,
        slug: `casual-linen-shirt-${ts}`,
        base_price: 5500.0,
        is_active: true,
        is_final_sale: false,
      });

      finalSaleProduct = await Product.create({
        category_id: category.id,
        title: `Clearance Batik Sarong ${ts}`,
        slug: `clearance-batik-sarong-${ts}`,
        base_price: 3500.0,
        is_active: true,
        is_final_sale: true,
      });

      variantM = await ProductVariant.create({
        product_id: product.id,
        sku: `SHIRT-M-${ts}`,
        size: 'M',
        color: 'Ivory',
        stock_quantity: 25,
        reserved_quantity: 0,
      });

      variantL = await ProductVariant.create({
        product_id: product.id,
        sku: `SHIRT-L-${ts}`,
        size: 'L',
        color: 'Ivory',
        stock_quantity: 15,
        reserved_quantity: 0,
      });

      outOfStockVariant = await ProductVariant.create({
        product_id: product.id,
        sku: `SHIRT-XXL-${ts}`,
        size: 'XXL',
        color: 'Ivory',
        stock_quantity: 1,
        reserved_quantity: 1, // availableStock = 0
      });

      finalSaleVariant = await ProductVariant.create({
        product_id: finalSaleProduct.id,
        sku: `SARONG-CLR-${ts}`,
        size: 'FREE',
        color: 'Maroon',
        stock_quantity: 10,
        reserved_quantity: 0,
      });

      const now = new Date();
      const date20DaysAgo = new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000);
      const date32DaysAgo = new Date(now.getTime() - 32 * 24 * 60 * 60 * 1000);

      // Order 1: Delivered 20 days ago (within 30-day window)
      deliveredOrder = await Order.create({
        order_number: `ORD-DEL-${ts}`,
        customer_id: customerUser.id,
        order_status: 'delivered',
        delivered_at: date20DaysAgo,
        total_amount: 14500.0,
        shipping_address_snapshot: { city: 'Dickwella', address_line1: 'Beach Road' },
      });

      // Order 2: Delivered 32 days ago (expired window)
      expiredOrder = await Order.create({
        order_number: `ORD-EXP-${ts}`,
        customer_id: customerUser.id,
        order_status: 'delivered',
        delivered_at: date32DaysAgo,
        total_amount: 5500.0,
        shipping_address_snapshot: { city: 'Galle', address_line1: 'Fort' },
      });

      // Order items
      validOrderItem = await OrderItem.create({
        order_id: deliveredOrder.id,
        product_variant_id: variantM.id,
        quantity: 1,
        unit_price_at_purchase: 5500.0,
        total_price: 5500.0,
        product_title_snapshot: product.title,
        variant_sku_snapshot: variantM.sku,
        is_final_sale: false,
      });

      exchangeOrderItem = await OrderItem.create({
        order_id: deliveredOrder.id,
        product_variant_id: variantM.id,
        quantity: 1,
        unit_price_at_purchase: 5500.0,
        total_price: 5500.0,
        product_title_snapshot: product.title,
        variant_sku_snapshot: variantM.sku,
        is_final_sale: false,
      });

      finalSaleOrderItem = await OrderItem.create({
        order_id: deliveredOrder.id,
        product_variant_id: finalSaleVariant.id,
        quantity: 1,
        unit_price_at_purchase: 3500.0,
        total_price: 3500.0,
        product_title_snapshot: finalSaleProduct.title,
        variant_sku_snapshot: finalSaleVariant.sku,
        is_final_sale: true,
      });

      expiredOrderItem = await OrderItem.create({
        order_id: expiredOrder.id,
        product_variant_id: variantM.id,
        quantity: 1,
        unit_price_at_purchase: 5500.0,
        total_price: 5500.0,
        product_title_snapshot: product.title,
        variant_sku_snapshot: variantM.sku,
        is_final_sale: false,
      });
    } catch (err) {
      console.warn('Returns integration setup warning:', err.message);
    }
  });

  afterAll(async () => {
    try {
      if (deliveredOrder) {
        await Return.destroy({ where: { order_id: deliveredOrder.id } });
      }
      if (expiredOrder) {
        await Return.destroy({ where: { order_id: expiredOrder.id } });
      }

      await OrderItem.destroy({
        where: {
          order_id: [deliveredOrder?.id, expiredOrder?.id].filter(Boolean),
        },
      });
      await Order.destroy({
        where: {
          customer_id: [customerUser?.id, otherCustomerUser?.id].filter(Boolean),
        },
      });
      await ProductVariant.destroy({
        where: {
          product_id: [product?.id, finalSaleProduct?.id].filter(Boolean),
        },
      });
      await Product.destroy({
        where: { id: [product?.id, finalSaleProduct?.id].filter(Boolean) },
      });
      if (category) await Category.destroy({ where: { id: category.id } });
      if (customerUser) await User.destroy({ where: { id: customerUser.id } });
      if (otherCustomerUser) await User.destroy({ where: { id: otherCustomerUser.id } });
      if (adminUser) await User.destroy({ where: { id: adminUser.id } });

      await sequelize.close();
      await redisClient.quit();
    } catch {
      // Ignore cleanup error
    }
  });

  describe('POST /api/v1/returns - Customer Return & Exchange Creation', () => {
    it('should reject unauthenticated return requests with 401', async () => {
      const res = await request(app)
        .post('/api/v1/returns')
        .send({
          order_item_id: validOrderItem.id,
          type: 'return',
          reason: 'Too large',
        });

      expect(res.status).toBe(401);
    });

    it('should reject return if order was delivered 31+ days ago with 400 (AC2)', async () => {
      const res = await request(app)
        .post('/api/v1/returns')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          order_item_id: expiredOrderItem.id,
          type: 'return',
          reason: 'Fabric did not suit me',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Return window has expired (30 days from delivery date)');
    });

    it('should reject return if item is marked final sale with 400 (AC1)', async () => {
      const res = await request(app)
        .post('/api/v1/returns')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          order_item_id: finalSaleOrderItem.id,
          type: 'return',
          reason: 'Do not like the color',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Final sale items cannot be returned or exchanged');
    });

    it('should reject return if customer does not own the order with 403', async () => {
      const res = await request(app)
        .post('/api/v1/returns')
        .set('Authorization', `Bearer ${otherCustomerToken}`)
        .send({
          order_item_id: validOrderItem.id,
          type: 'return',
          reason: 'Not my order',
        });

      expect(res.status).toBe(403);
    });

    it('should successfully create return for refund within 30-day window with 201 (AC1)', async () => {
      const res = await request(app)
        .post('/api/v1/returns')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          order_item_id: validOrderItem.id,
          type: 'return',
          reason: 'Color did not match expectations',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.return_id).toBeDefined();
      expect(res.body.data.status).toBe('requested');
      expect(res.body.data.type).toBe('return');
    });

    it('should reject exchange if target variant is out of stock with 400 (AC3)', async () => {
      const res = await request(app)
        .post('/api/v1/returns')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          order_item_id: exchangeOrderItem.id,
          type: 'exchange',
          exchange_variant_id: outOfStockVariant.id,
          reason: 'Need size XXL',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Target exchange variant has insufficient stock');
    });

    it('should successfully create size exchange request with 201 (AC3)', async () => {
      const res = await request(app)
        .post('/api/v1/returns')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          order_item_id: exchangeOrderItem.id,
          type: 'exchange',
          exchange_variant_id: variantL.id,
          reason: 'Size M was too tight, exchanging for L',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.return_id).toBeDefined();
      expect(res.body.data.status).toBe('requested');
      expect(res.body.data.type).toBe('exchange');
      expect(res.body.data.exchange_variant_id).toBe(variantL.id);
    });
  });

  describe('GET /api/v1/returns/my-returns & GET /api/v1/returns/:id', () => {
    it('should return paginated return requests for authenticated customer', async () => {
      const res = await request(app)
        .get('/api/v1/returns/my-returns')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.returns)).toBe(true);
      expect(res.body.data.total).toBeGreaterThanOrEqual(2);
    });

    it('should retrieve individual return details by ID for the owner', async () => {
      const customerReturns = await Return.findAll({
        where: { user_id: customerUser.id },
      });
      const returnId = customerReturns[0].id;

      const res = await request(app)
        .get(`/api/v1/returns/${returnId}`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(returnId);
    });

    it('should block another customer from viewing foreign return details with 403', async () => {
      const customerReturns = await Return.findAll({
        where: { user_id: customerUser.id },
      });
      const returnId = customerReturns[0].id;

      const res = await request(app)
        .get(`/api/v1/returns/${returnId}`)
        .set('Authorization', `Bearer ${otherCustomerToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('Admin Review & Approval/Rejection Workflow (AC4)', () => {
    it('should block non-admin customer from listing all platform returns with 403', async () => {
      const res = await request(app)
        .get('/api/v1/returns')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(403);
    });

    it('should allow admin to list all platform return requests', async () => {
      const res = await request(app)
        .get('/api/v1/returns')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.returns)).toBe(true);
    });

    it('should allow admin to approve exchange, issuing label & reserving stock (AC4)', async () => {
      const exchangeReturn = await Return.findOne({
        where: { order_item_id: exchangeOrderItem.id },
      });

      const initialReserved = variantL.reserved_quantity;

      const res = await request(app)
        .patch(`/api/v1/returns/${exchangeReturn.id}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send();

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('approved');
      expect(res.body.data.return_label_url).toBeDefined();

      // Check stock reservation in DB
      const updatedVariant = await ProductVariant.findByPk(variantL.id);
      expect(updatedVariant.reserved_quantity).toBe(initialReserved + 1);
    });

    it('should allow admin to reject a return request with reason', async () => {
      const refundReturn = await Return.findOne({
        where: { order_item_id: validOrderItem.id },
      });

      const res = await request(app)
        .patch(`/api/v1/returns/${refundReturn.id}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Item was worn with missing original tags' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('rejected');
    });
  });
});
