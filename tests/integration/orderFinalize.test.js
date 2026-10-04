const request = require('supertest');
const app = require('../../src/app');
const orderService = require('../../src/services/order.service');
const emailService = require('../../src/services/email.service');
const {
  Order,
  OrderItem,
  ProductVariant,
  Product,
  Category,
  Payment,
  sequelize,
} = require('../../src/models');
const redisClient = require('../../src/config/redis');

describe('Integration: Order Finalization, Line Items & Stock Deduction (STORM-029)', () => {
  let testCategory;
  let testProduct;
  let testVariant;
  let testOrder;
  let testOrderItem;

  beforeEach(async () => {
    emailService.clearDispatchedLogs();
    try {
      // 1. Setup Category, Product & Variant in DB
      testCategory = await Category.create({
        name: `Test Cat ${Date.now()}`,
        slug: `test-cat-${Date.now()}`,
        description: 'Category for Order Finalize Test',
      });

      testProduct = await Product.create({
        category_id: testCategory.id,
        title: `Silk Batik Shirt ${Date.now()}`,
        slug: `silk-batik-shirt-${Date.now()}`,
        description: 'Premium silk shirt for testing',
        base_price: 5500.0,
        is_active: true,
      });

      testVariant = await ProductVariant.create({
        product_id: testProduct.id,
        sku: `BATIK-FINAL-${Date.now()}`,
        size: 'L',
        color: 'Navy',
        stock_quantity: 40,
        reserved_quantity: 6,
        price_override: null,
      });

      // 2. Setup Pending Order & OrderItem
      testOrder = await Order.create({
        order_number: `DFC-FIN-${Date.now().toString(36).toUpperCase()}`,
        customer_id: null,
        order_status: 'pending',
        payment_status: 'pending',
        total_amount: 11350.0,
        shipping_amount: 350.0,
        discount_amount: 0.0,
        shipping_address_snapshot: {
          line1: '100 Main Street',
          city: 'Dickwella',
          postal_code: '81100',
          country: 'Sri Lanka',
        },
        guest_email: 'finalize.tester@dickwella.lk',
      });

      testOrderItem = await OrderItem.create({
        order_id: testOrder.id,
        product_variant_id: testVariant.id,
        quantity: 2,
        unit_price_at_purchase: 5500.0,
        total_price: 11000.0,
        product_title_snapshot: testProduct.title,
        variant_sku_snapshot: testVariant.sku,
      });
    } catch {
      // Offline fallback
      testOrder = {
        id: `ord-mock-${Date.now()}`,
        order_number: 'DFC-TEST-FALLBACK',
        total_amount: 11350.0,
      };
    }
  });

  afterAll(async () => {
    try {
      if (testOrder && testOrder.id) {
        await Payment.destroy({ where: { order_id: testOrder.id } });
        await OrderItem.destroy({ where: { order_id: testOrder.id } });
        await Order.destroy({ where: { id: testOrder.id } });
      }
      if (testVariant && testVariant.id) {
        await ProductVariant.destroy({ where: { id: testVariant.id } });
      }
      if (testProduct && testProduct.id) {
        await Product.destroy({ where: { id: testProduct.id } });
      }
      if (testCategory && testCategory.id) {
        await Category.destroy({ where: { id: testCategory.id } });
      }
      await sequelize.close();
      await redisClient.quit();
    } catch {
      // Offline cleanup ignore
    }
  });

  describe('POST /api/v1/orders/:id/finalize (AC1 & AC2 - Atomic Stock Deduction & Line Items)', () => {
    it('should permanently deduct stock_quantity and reserved_quantity inside managed transaction', async () => {
      const res = await request(app)
        .post(`/api/v1/orders/${testOrder.id}/finalize`)
        .send({
          payment_details: {
            payment_intent_id: `pi_test_final_${Date.now()}`,
            payment_method: 'stripe',
            amount: 1135000,
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.order_status).toBe('processing');
      expect(res.body.data.payment_status).toBe('paid');
      expect(res.body.data.invoice_number).toMatch(/^DFC-\d{4}-/);

      // Verify permanent stock decrement in PostgreSQL
      if (testVariant && testVariant.id) {
        const reloadedVariant = await ProductVariant.findByPk(testVariant.id);
        expect(reloadedVariant).not.toBeNull();
        // Initial stock was 40, purchased 2 -> expected 38
        expect(reloadedVariant.stock_quantity).toBe(38);
        // Initial reserved was 6, purchased 2 -> expected 4
        expect(reloadedVariant.reserved_quantity).toBe(4);
      }

      // Verify order status in DB
      if (testOrder && testOrder.id) {
        const reloadedOrder = await Order.findByPk(testOrder.id);
        expect(reloadedOrder.payment_status).toBe('paid');
        expect(reloadedOrder.order_status).toBe('processing');
        expect(reloadedOrder.notes).toContain(res.body.data.invoice_number);

        const payment = await Payment.findOne({ where: { order_id: testOrder.id } });
        expect(payment).not.toBeNull();
        expect(payment.status).toBe('succeeded');
        expect(Number(payment.amount)).toBe(11350);
      }
    });

    it('should preserve immutable purchase price snapshot even if product base price changes later', async () => {
      // 1. Finalize the order
      await orderService.finalizeOrder(testOrder.id, {
        payment_intent_id: `pi_test_snapshot_${Date.now()}`,
        payment_method: 'stripe',
        amount: 1135000,
      });

      // 2. Modify base product price in catalog
      if (testProduct && testProduct.id) {
        await testProduct.update({ base_price: 9999.0 });
      }

      // 3. Confirm historical OrderItem retains exact unit_price_at_purchase
      if (testOrderItem && testOrderItem.id) {
        const reloadedItem = await OrderItem.findByPk(testOrderItem.id);
        expect(Number(reloadedItem.unit_price_at_purchase)).toBe(5500.0);
        expect(Number(reloadedItem.total_price)).toBe(11000.0);
      }
    });

    it('should be idempotent and not double-deduct inventory if finalized again', async () => {
      // First finalization
      await orderService.finalizeOrder(testOrder.id, {
        payment_intent_id: `pi_test_idem_${Date.now()}`,
        payment_method: 'stripe',
        amount: 1135000,
      });

      // Second finalization call
      const res2 = await request(app)
        .post(`/api/v1/orders/${testOrder.id}/finalize`)
        .send({
          payment_details: {
            payment_intent_id: `pi_test_idem_${Date.now()}`,
            payment_method: 'stripe',
          },
        });

      expect(res2.status).toBe(200);

      // Verify variant stock was NOT decremented again
      if (testVariant && testVariant.id) {
        const variantAfterSecond = await ProductVariant.findByPk(testVariant.id);
        expect(variantAfterSecond.stock_quantity).toBe(38);
        expect(variantAfterSecond.reserved_quantity).toBe(4);
      }
    });
  });

  describe('Automated SendGrid Email & Invoice Trigger (AC3)', () => {
    it('should dispatch order confirmation email with generated invoice on finalization', async () => {
      await orderService.finalizeOrder(testOrder.id, {
        payment_intent_id: `pi_email_test_${Date.now()}`,
        payment_method: 'stripe',
      });

      const latestEmail = emailService.getLatestDispatchedEmail();
      expect(latestEmail).not.toBeNull();
      expect(latestEmail.to).toBe('finalize.tester@dickwella.lk');
      expect(latestEmail.subject).toContain('Order Confirmation & Invoice');
      expect(latestEmail.html).toContain('Dickwella Fashion Corner');
      expect(latestEmail.html).toContain('Purchased Items');
    });
  });

  describe('GET /api/v1/orders/:id (Order Inspection)', () => {
    it('should return complete order details, line items, and invoice status', async () => {
      const res = await request(app).get(`/api/v1/orders/${testOrder.id}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(testOrder.id);
      expect(res.body.data.order_number).toBe(testOrder.order_number);
      expect(Array.isArray(res.body.data.items)).toBe(true);
      expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
    });

    it('should return 404 for non-existent order UUID', async () => {
      const res = await request(app).get('/api/v1/orders/00000000-0000-0000-0000-000000000099');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });
});
