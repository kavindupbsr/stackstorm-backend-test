const { Order, OrderItem, Payment, Return, User, ProductVariant } = require('../../../src/models');

describe('Order & OrderItem Models Unit Tests (Shift-Left Validation)', () => {
  describe('Order Model', () => {
    it('should instantiate a valid registered customer order', () => {
      const order = Order.build({
        order_number: 'ORD-20261004-0001',
        customer_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        total_amount: 15900.0,
        shipping_amount: 500.0,
        shipping_address_snapshot: {
          address_line1: '45 Galle Road',
          city: 'Dickwella',
          postal_code: '82400',
        },
      });

      expect(order.order_number).toBe('ORD-20261004-0001');
      expect(order.customer_id).toBe('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');
      expect(order.order_status).toBe('pending');
      expect(order.payment_status).toBe('pending');
      expect(order.total_amount).toBe(15900.0);
    });

    it('should allow customer_id to be null for guest checkout (SRS FR-013)', async () => {
      const guestOrder = Order.build({
        order_number: 'ORD-20261004-0002',
        customer_id: null,
        guest_email: 'guest.shopper@gmail.com',
        guest_phone: '+94719876543',
        total_amount: 8500.0,
        shipping_address_snapshot: {
          address_line1: '12 Beach Road',
          city: 'Dickwella',
          postal_code: '82400',
        },
      });

      await expect(guestOrder.validate()).resolves.toBeDefined();
      expect(guestOrder.customer_id).toBeNull();
      expect(guestOrder.guest_email).toBe('guest.shopper@gmail.com');
    });

    it('should reject invalid order_status ENUM values', async () => {
      const order = Order.build({
        order_number: 'ORD-20261004-0003',
        order_status: 'dispatched_invalid_status',
        total_amount: 5000.0,
        shipping_address_snapshot: { city: 'Dickwella' },
      });

      await expect(order.validate()).rejects.toThrow();
    });

    it('should reject negative total_amount', async () => {
      const order = Order.build({
        order_number: 'ORD-20261004-0004',
        total_amount: -250.0,
        shipping_address_snapshot: { city: 'Dickwella' },
      });

      await expect(order.validate()).rejects.toThrow();
    });

    it('should define associations with User, OrderItem, Payment, and Return', () => {
      expect(Order.associations.customer).toBeDefined();
      expect(Order.associations.customer.target).toBe(User);
      expect(Order.associations.customer.foreignKey).toBe('customer_id');

      expect(Order.associations.items).toBeDefined();
      expect(Order.associations.items.target).toBe(OrderItem);
      expect(Order.associations.items.foreignKey).toBe('order_id');

      expect(Order.associations.payments).toBeDefined();
      expect(Order.associations.payments.target).toBe(Payment);
      expect(Order.associations.payments.foreignKey).toBe('order_id');

      expect(Order.associations.returns).toBeDefined();
      expect(Order.associations.returns.target).toBe(Return);
      expect(Order.associations.returns.foreignKey).toBe('order_id');
    });
  });

  describe('OrderItem Model (Price Snapshotting)', () => {
    it('should instantiate an order item with immutable price snapshot', () => {
      const item = OrderItem.build({
        order_id: 'd1eebc99-9c0b-4ef8-bb6d-6bb9bd380a44',
        product_variant_id: 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
        quantity: 2,
        unit_price_at_purchase: 4500.0,
        total_price: 9000.0,
        product_title_snapshot: 'Handloom Cotton Batik Shirt',
        variant_sku_snapshot: 'BATIK-SRT-BLU-L',
      });

      expect(item.unit_price_at_purchase).toBe(4500.0);
      expect(item.product_title_snapshot).toBe('Handloom Cotton Batik Shirt');
      expect(item.variant_sku_snapshot).toBe('BATIK-SRT-BLU-L');
      expect(item.quantity).toBe(2);
    });

    it('should reject quantity less than 1', async () => {
      const item = OrderItem.build({
        order_id: 'd1eebc99-9c0b-4ef8-bb6d-6bb9bd380a44',
        product_variant_id: 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
        quantity: 0,
        unit_price_at_purchase: 4500.0,
        total_price: 0.0,
        product_title_snapshot: 'Shirt',
        variant_sku_snapshot: 'SKU-001',
      });

      await expect(item.validate()).rejects.toThrow();
    });

    it('should reject negative unit_price_at_purchase', async () => {
      const item = OrderItem.build({
        order_id: 'd1eebc99-9c0b-4ef8-bb6d-6bb9bd380a44',
        product_variant_id: 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
        quantity: 1,
        unit_price_at_purchase: -100.0,
        total_price: -100.0,
        product_title_snapshot: 'Shirt',
        variant_sku_snapshot: 'SKU-001',
      });

      await expect(item.validate()).rejects.toThrow();
    });

    it('should define associations with Order and ProductVariant', () => {
      expect(OrderItem.associations.order).toBeDefined();
      expect(OrderItem.associations.order.target).toBe(Order);
      expect(OrderItem.associations.order.foreignKey).toBe('order_id');

      expect(OrderItem.associations.variant).toBeDefined();
      expect(OrderItem.associations.variant.target).toBe(ProductVariant);
      expect(OrderItem.associations.variant.foreignKey).toBe('product_variant_id');
    });
  });
});
