const returnService = require('../../../src/services/return.service');
const {
  User,
  Category,
  Product,
  ProductVariant,
  Order,
  OrderItem,
  Return,
  sequelize,
} = require('../../../src/models');
const redisClient = require('../../../src/config/redis');

describe('Unit: ReturnService 30-Day Delivery & Final-Sale Rules (STORM-038 / Issue #8)', () => {
  let customerUser;
  let category;
  let normalProduct;
  let finalSaleProduct;
  let sourceVariant;
  let exchangeVariant;
  let outOfStockVariant;
  let deliveredRecentOrder;
  let deliveredExpiredOrder;
  let undeliveredOrder;

  let validOrderItem;
  let expiredOrderItem;
  let finalSaleOrderItem;
  let undeliveredOrderItem;
  let itemForExchange;

  beforeAll(async () => {
    try {
      const ts = Date.now();

      // Create test user
      customerUser = await User.create({
        email: `return-customer-${ts}@example.lk`,
        password_hash: '$2b$10$hashedpasswordstringforunittests001',
        first_name: 'Pabasara',
        last_name: 'Bandara',
        role: 'customer',
      });

      // Create category
      category = await Category.create({
        name: `Return Policy Cat ${ts}`,
        slug: `return-policy-cat-${ts}`,
      });

      // Create normal product
      normalProduct = await Product.create({
        category_id: category.id,
        title: `Linen Shirt ${ts}`,
        slug: `linen-shirt-${ts}`,
        base_price: 5200.0,
        is_active: true,
        is_final_sale: false,
      });

      // Create final-sale product
      finalSaleProduct = await Product.create({
        category_id: category.id,
        title: `Clearance Silk Scarf ${ts}`,
        slug: `clearance-silk-scarf-${ts}`,
        base_price: 3200.0,
        is_active: true,
        is_final_sale: true,
      });

      // Create product variants
      sourceVariant = await ProductVariant.create({
        product_id: normalProduct.id,
        sku: `RET-SRC-M-${ts}`,
        size: 'M',
        color: 'Navy',
        stock_quantity: 20,
        reserved_quantity: 0,
      });

      exchangeVariant = await ProductVariant.create({
        product_id: normalProduct.id,
        sku: `RET-EXC-L-${ts}`,
        size: 'L',
        color: 'Navy',
        stock_quantity: 15,
        reserved_quantity: 0,
      });

      outOfStockVariant = await ProductVariant.create({
        product_id: normalProduct.id,
        sku: `RET-OOS-XL-${ts}`,
        size: 'XL',
        color: 'Navy',
        stock_quantity: 2,
        reserved_quantity: 2, // available = 0
      });

      const finalSaleVariant = await ProductVariant.create({
        product_id: finalSaleProduct.id,
        sku: `RET-FIN-FREE-${ts}`,
        size: 'FREE',
        color: 'Ruby',
        stock_quantity: 10,
        reserved_quantity: 0,
      });

      const now = new Date();
      // 29 days ago (eligible)
      const date29DaysAgo = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);
      // 31 days ago (expired)
      const date31DaysAgo = new Date(now.getTime() - 31 * 24 * 60 * 60 * 1000);

      // Delivered Order - 29 days ago
      deliveredRecentOrder = await Order.create({
        order_number: `ORD-REC-${ts}`,
        customer_id: customerUser.id,
        order_status: 'delivered',
        delivered_at: date29DaysAgo,
        total_amount: 10400.0,
        shipping_address_snapshot: { city: 'Matara', address_line1: 'Beach Rd' },
      });

      // Delivered Order - 31 days ago (expired)
      deliveredExpiredOrder = await Order.create({
        order_number: `ORD-EXP-${ts}`,
        customer_id: customerUser.id,
        order_status: 'delivered',
        delivered_at: date31DaysAgo,
        total_amount: 5200.0,
        shipping_address_snapshot: { city: 'Dickwella', address_line1: 'Main St' },
      });

      // Undelivered Order - processing status
      undeliveredOrder = await Order.create({
        order_number: `ORD-PRC-${ts}`,
        customer_id: customerUser.id,
        order_status: 'processing',
        total_amount: 5200.0,
        shipping_address_snapshot: { city: 'Colombo', address_line1: 'Galle Rd' },
      });

      // Order items
      validOrderItem = await OrderItem.create({
        order_id: deliveredRecentOrder.id,
        product_variant_id: sourceVariant.id,
        quantity: 1,
        unit_price_at_purchase: 5200.0,
        total_price: 5200.0,
        product_title_snapshot: normalProduct.title,
        variant_sku_snapshot: sourceVariant.sku,
        is_final_sale: false,
      });

      itemForExchange = await OrderItem.create({
        order_id: deliveredRecentOrder.id,
        product_variant_id: sourceVariant.id,
        quantity: 1,
        unit_price_at_purchase: 5200.0,
        total_price: 5200.0,
        product_title_snapshot: normalProduct.title,
        variant_sku_snapshot: sourceVariant.sku,
        is_final_sale: false,
      });

      expiredOrderItem = await OrderItem.create({
        order_id: deliveredExpiredOrder.id,
        product_variant_id: sourceVariant.id,
        quantity: 1,
        unit_price_at_purchase: 5200.0,
        total_price: 5200.0,
        product_title_snapshot: normalProduct.title,
        variant_sku_snapshot: sourceVariant.sku,
        is_final_sale: false,
      });

      finalSaleOrderItem = await OrderItem.create({
        order_id: deliveredRecentOrder.id,
        product_variant_id: finalSaleVariant.id,
        quantity: 1,
        unit_price_at_purchase: 3200.0,
        total_price: 3200.0,
        product_title_snapshot: finalSaleProduct.title,
        variant_sku_snapshot: finalSaleVariant.sku,
        is_final_sale: true,
      });

      undeliveredOrderItem = await OrderItem.create({
        order_id: undeliveredOrder.id,
        product_variant_id: sourceVariant.id,
        quantity: 1,
        unit_price_at_purchase: 5200.0,
        total_price: 5200.0,
        product_title_snapshot: normalProduct.title,
        variant_sku_snapshot: sourceVariant.sku,
        is_final_sale: false,
      });
    } catch (err) {
      console.warn('Unit Return setup notice:', err.message);
    }
  });

  afterAll(async () => {
    try {
      if (deliveredRecentOrder) {
        await Return.destroy({ where: { order_id: deliveredRecentOrder.id } });
      }
      if (deliveredExpiredOrder) {
        await Return.destroy({ where: { order_id: deliveredExpiredOrder.id } });
      }
      if (undeliveredOrder) {
        await Return.destroy({ where: { order_id: undeliveredOrder.id } });
      }

      await OrderItem.destroy({ where: { order_id: [deliveredRecentOrder?.id, deliveredExpiredOrder?.id, undeliveredOrder?.id].filter(Boolean) } });
      await Order.destroy({ where: { customer_id: customerUser?.id } });
      await ProductVariant.destroy({ where: { product_id: [normalProduct?.id, finalSaleProduct?.id].filter(Boolean) } });
      await Product.destroy({ where: { id: [normalProduct?.id, finalSaleProduct?.id].filter(Boolean) } });
      if (category) await Category.destroy({ where: { id: category.id } });
      if (customerUser) await User.destroy({ where: { id: customerUser.id } });

      await sequelize.close();
      await redisClient.quit();
    } catch {
      // Ignore cleanup error
    }
  });

  describe('30-Day Delivery Return Window & Temporal Gatekeeping', () => {
    it('blocks return if delivered_at was 31 days ago (AC2 & Shift-Left)', async () => {
      await expect(
        returnService.requestReturn({
          userId: customerUser.id,
          order_item_id: expiredOrderItem.id,
          type: 'return',
          reason: 'Too loose on waist',
        })
      ).rejects.toThrow('Return window has expired (30 days from delivery date)');
    });

    it('allows return if delivered_at was 29 days ago (AC1 & Shift-Left)', async () => {
      const result = await returnService.requestReturn({
        userId: customerUser.id,
        order_item_id: validOrderItem.id,
        type: 'return',
        reason: 'Sleeve length was longer than expected',
      });

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.status).toBe('requested');
      expect(result.type).toBe('return');
      expect(result.order_item_id).toBe(validOrderItem.id);
    });

    it('blocks return if order status is not delivered (e.g., processing)', async () => {
      await expect(
        returnService.requestReturn({
          userId: customerUser.id,
          order_item_id: undeliveredOrderItem.id,
          type: 'return',
          reason: 'Changed my mind',
        })
      ).rejects.toThrow('Order must be delivered to request a return or exchange');
    });

    it('blocks duplicate return requests for the same order item', async () => {
      await expect(
        returnService.requestReturn({
          userId: customerUser.id,
          order_item_id: validOrderItem.id,
          type: 'return',
          reason: 'Submitting again',
        })
      ).rejects.toThrow('A return or exchange request already exists for this order item');
    });
  });

  describe('Final Sale Exclusion Rule', () => {
    it('blocks return if order item was marked is_final_sale=true (AC1 & Shift-Left)', async () => {
      await expect(
        returnService.requestReturn({
          userId: customerUser.id,
          order_item_id: finalSaleOrderItem.id,
          type: 'return',
          reason: 'Want a refund on final sale',
        })
      ).rejects.toThrow('Final sale items cannot be returned or exchanged');
    });
  });

  describe('Exchange Workflow & Inventory Stock Reservation (AC3 & AC4)', () => {
    it('blocks exchange if exchange_variant_id is omitted', async () => {
      await expect(
        returnService.requestReturn({
          userId: customerUser.id,
          order_item_id: itemForExchange.id,
          type: 'exchange',
          reason: 'Need another size',
        })
      ).rejects.toThrow('exchange_variant_id is required when return type is exchange');
    });

    it('blocks exchange if target variant is out of stock', async () => {
      await expect(
        returnService.requestReturn({
          userId: customerUser.id,
          order_item_id: itemForExchange.id,
          type: 'exchange',
          exchange_variant_id: outOfStockVariant.id,
          reason: 'Exchange for out of stock size',
        })
      ).rejects.toThrow('Target exchange variant has insufficient stock');
    });

    it('allows exchange request when target variant has available stock', async () => {
      const result = await returnService.requestReturn({
        userId: customerUser.id,
        order_item_id: itemForExchange.id,
        type: 'exchange',
        exchange_variant_id: exchangeVariant.id,
        reason: 'Size M was too tight, exchanging for L',
      });

      expect(result).toBeDefined();
      expect(result.type).toBe('exchange');
      expect(result.exchange_variant_id).toBe(exchangeVariant.id);
      expect(result.status).toBe('requested');
    });

    it('approves return, issues shipping label, and reserves exchange stock (AC4)', async () => {
      const exchangeReturn = await Return.findOne({
        where: { order_item_id: itemForExchange.id },
      });

      const initialReserved = exchangeVariant.reserved_quantity;

      const approved = await returnService.approveReturn(
        exchangeReturn.id,
        'b0000000-0000-0000-0000-000000000001'
      );

      expect(approved.status).toBe('approved');
      expect(approved.return_label_url).toBeDefined();
      expect(approved.return_label_url).toContain('https://shipping.stackstorm.internal/labels/');

      // Check that stock was atomically reserved
      const updatedVariant = await ProductVariant.findByPk(exchangeVariant.id);
      expect(updatedVariant.reserved_quantity).toBe(initialReserved + 1);
    });
  });
});
