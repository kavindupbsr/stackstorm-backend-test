const orderService = require('../../../src/services/order.service');
const emailService = require('../../../src/services/email.service');
const ApiError = require('../../../src/utils/ApiError');

describe('Unit: OrderService & Line Item Finalization (STORM-029)', () => {
  beforeEach(() => {
    emailService.clearDispatchedLogs();
  });

  describe('generateInvoiceNumber', () => {
    it('should generate an invoice number formatted with current year and order suffix', () => {
      const year = new Date().getFullYear();
      const mockOrder = { order_number: 'DFC-TEST-8899', id: 'ord-123' };
      const invoiceNo = orderService.generateInvoiceNumber(mockOrder);

      expect(invoiceNo).toBe(`DFC-${year}-TEST-8899`);
    });

    it('should fallback to order ID slice if order_number has no standard format', () => {
      const year = new Date().getFullYear();
      const mockOrder = { id: 'c0000000-0000-0000-0000-000000000001' };
      const invoiceNo = orderService.generateInvoiceNumber(mockOrder);

      expect(invoiceNo).toBe(`DFC-${year}-C0000000`);
    });
  });

  describe('finalizeOrder validation and edge cases', () => {
    it('should throw badRequest ApiError if orderId is missing', async () => {
      await expect(orderService.finalizeOrder(null)).rejects.toThrow(ApiError);
      await expect(orderService.finalizeOrder('')).rejects.toThrow(/order_id is required/i);
    });

    it('should throw notFound ApiError if order does not exist in database', async () => {
      await expect(
        orderService.finalizeOrder('00000000-0000-0000-0000-000000000099')
      ).rejects.toThrow(/not found/i);
    });
  });

  describe('emailService invoice generation & dispatch', () => {
    it('should generate valid invoice HTML with store branding and itemized table', () => {
      const mockOrder = {
        order_number: 'DFC-TEST-001',
        total_amount: 5200.0,
        shipping_amount: 350.0,
        discount_amount: 0.0,
        shipping_address_snapshot: {
          line1: '124 Beach Road',
          city: 'Dickwella',
          postal_code: '81100',
          country: 'Sri Lanka',
        },
      };

      const mockItems = [
        {
          product_title_snapshot: 'Handcrafted Batik Shirt',
          variant_sku_snapshot: 'BATIK-L-BLU',
          quantity: 1,
          unit_price_at_purchase: 4850.0,
          total_price: 4850.0,
        },
      ];

      const html = emailService.generateInvoiceHtml(mockOrder, mockItems, 'DFC-2026-TEST-001');

      expect(html).toContain('Dickwella Fashion Corner');
      expect(html).toContain('DFC-2026-TEST-001');
      expect(html).toContain('Handcrafted Batik Shirt');
      expect(html).toContain('BATIK-L-BLU');
      expect(html).toContain('LKR 5,200.00');
    });

    it('should record confirmation email dispatch in log when executed', async () => {
      const mockOrder = {
        id: 'ord-test-email',
        order_number: 'DFC-TEST-EMAIL',
        guest_email: 'customer@dickwella.lk',
        total_amount: 4850.0,
        shipping_address_snapshot: {},
      };

      const result = await emailService.sendOrderConfirmation({
        order: mockOrder,
        items: [],
        invoiceNumber: 'DFC-2026-EMAIL',
      });

      expect(result.success).toBe(true);
      expect(result.recipient).toBe('customer@dickwella.lk');

      const latest = emailService.getLatestDispatchedEmail();
      expect(latest).toBeDefined();
      expect(latest.to).toBe('customer@dickwella.lk');
      expect(latest.invoiceNumber).toBe('DFC-2026-EMAIL');
    });
  });

  describe('getOrderById authorization', () => {
    it('should throw badRequest if order_id is missing', async () => {
      await expect(orderService.getOrderById(null)).rejects.toThrow(/order_id is required/i);
    });

    it('should throw forbidden if user attempts to access another customer order', async () => {
      orderService.fallbackOrdersStore.set('ord-cust-1', {
        id: 'ord-cust-1',
        customer_id: 'user-aaa',
        total_amount: 1000,
      });

      await expect(orderService.getOrderById('ord-cust-1', 'user-bbb')).rejects.toThrow(ApiError);
    });
  });

  describe('getCustomerOrders (STORM-033)', () => {
    it('should throw unauthorized error if userId is missing', async () => {
      await expect(orderService.getCustomerOrders(null)).rejects.toThrow(/user identity is required/i);
    });

    it('should return only orders belonging to requesting user', async () => {
      const user1 = 'usr-test-101';
      const user2 = 'usr-test-102';

      orderService.fallbackOrdersStore.set('ord-u1', {
        id: 'ord-u1',
        order_number: 'DFC-TEST-U1',
        customer_id: user1,
        total_amount: 5000,
        items: [],
      });
      orderService.fallbackOrdersStore.set('ord-u2', {
        id: 'ord-u2',
        order_number: 'DFC-TEST-U2',
        customer_id: user2,
        total_amount: 8000,
        items: [],
      });

      const result = await orderService.getCustomerOrders(user1);
      expect(result.orders).toBeDefined();
      expect(result.pagination).toBeDefined();
      expect(result.orders.every((o) => o.customer_id === user1)).toBe(true);
    });
  });

  describe('getOrderTracking (STORM-033)', () => {
    it('should throw badRequest if orderId is missing', async () => {
      await expect(orderService.getOrderTracking(null, 'user-123')).rejects.toThrow(/order_id is required/i);
    });

    it('should throw unauthorized if userId is missing', async () => {
      await expect(orderService.getOrderTracking('ord-123', null)).rejects.toThrow(/user identity is required/i);
    });

    it('should throw forbidden when user attempts to track another customer order', async () => {
      orderService.fallbackOrdersStore.set('ord-track-secret', {
        id: 'ord-track-secret',
        customer_id: 'user-owner',
        order_status: 'processing',
        total_amount: 4500,
      });

      await expect(
        orderService.getOrderTracking('ord-track-secret', 'user-intruder')
      ).rejects.toThrow(/permission/i);
    });

    it('should construct sequential delivery milestone steps', async () => {
      orderService.fallbackOrdersStore.set('ord-track-valid', {
        id: 'ord-track-valid',
        order_number: 'DFC-TEST-TRACK',
        customer_id: 'user-owner',
        order_status: 'processing',
        payment_status: 'paid',
        total_amount: 6000,
      });

      const tracking = await orderService.getOrderTracking('ord-track-valid', 'user-owner');
      expect(tracking.order_id).toBe('ord-track-valid');
      expect(tracking.current_status).toBe('processing');
      expect(Array.isArray(tracking.milestones)).toBe(true);
      expect(tracking.milestones.length).toBe(4);

      const placed = tracking.milestones.find((m) => m.key === 'placed');
      const processing = tracking.milestones.find((m) => m.key === 'processing');
      expect(placed.status).toBe('completed');
      expect(processing.status).toBe('current');
    });
  });
});

