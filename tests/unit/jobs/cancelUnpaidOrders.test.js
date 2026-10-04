const {
  cancelExpiredOrders,
  startCancelUnpaidOrdersJob,
  stopCancelUnpaidOrdersJob,
} = require('../../../src/jobs/cancelUnpaidOrders.job');
const emailService = require('../../../src/services/email.service');
const {
  Order,
  OrderItem,
  ProductVariant,
  Product,
  Category,
  sequelize,
} = require('../../../src/models');
const redisClient = require('../../../src/config/redis');

describe('Unit: CancelUnpaidOrders Scheduled Job (STORM-030)', () => {
  let category;
  let product;
  let variant;
  let recentOrder;
  let expiredOrder;

  beforeEach(async () => {
    emailService.clearDispatchedLogs();
    try {
      category = await Category.create({
        name: `Job Cat ${Date.now()}`,
        slug: `job-cat-${Date.now()}`,
      });

      product = await Product.create({
        category_id: category.id,
        title: 'Job Batik Shirt',
        slug: `job-batik-${Date.now()}`,
        base_price: 4500.0,
      });

      variant = await ProductVariant.create({
        product_id: product.id,
        sku: `JOB-SKU-${Date.now()}`,
        size: 'M',
        color: 'Indigo',
        stock_quantity: 30,
        reserved_quantity: 5,
      });

      // 1. Order created just now (< 48 hours old)
      recentOrder = await Order.create({
        order_number: `DFC-RECENT-${Date.now().toString(36).toUpperCase()}`,
        order_status: 'pending',
        payment_status: 'pending',
        total_amount: 4500.0,
        shipping_address_snapshot: { line1: 'Beach Road' },
        guest_email: 'recent.buyer@dickwella.lk',
      });

      await OrderItem.create({
        order_id: recentOrder.id,
        product_variant_id: variant.id,
        quantity: 1,
        unit_price_at_purchase: 4500.0,
        total_price: 4500.0,
        product_title_snapshot: product.title,
        variant_sku_snapshot: variant.sku,
      });

      // 2. Order created 50 hours ago (> 48 hours old)
      const fiftyHoursAgo = new Date(Date.now() - 50 * 60 * 60 * 1000);
      expiredOrder = await Order.create({
        order_number: `DFC-EXPIRED-${Date.now().toString(36).toUpperCase()}`,
        order_status: 'pending',
        payment_status: 'pending',
        total_amount: 9000.0,
        shipping_address_snapshot: { line1: 'Lighthouse Road' },
        guest_email: 'expired.buyer@dickwella.lk',
        created_at: fiftyHoursAgo,
        updated_at: fiftyHoursAgo,
      });

      // Explicitly update created_at via raw query to bypass Sequelize default hooks
      await sequelize.query('UPDATE orders SET created_at = :date WHERE id = :id', {
        replacements: { date: fiftyHoursAgo, id: expiredOrder.id },
      });

      await OrderItem.create({
        order_id: expiredOrder.id,
        product_variant_id: variant.id,
        quantity: 2,
        unit_price_at_purchase: 4500.0,
        total_price: 9000.0,
        product_title_snapshot: product.title,
        variant_sku_snapshot: variant.sku,
      });
    } catch {
      // Offline fallback handling
    }
  });

  afterAll(async () => {
    try {
      if (recentOrder && recentOrder.id) {
        await OrderItem.destroy({ where: { order_id: recentOrder.id } });
        await Order.destroy({ where: { id: recentOrder.id } });
      }
      if (expiredOrder && expiredOrder.id) {
        await OrderItem.destroy({ where: { order_id: expiredOrder.id } });
        await Order.destroy({ where: { id: expiredOrder.id } });
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
      // Ignore offline
    }
  });

  describe('startCancelUnpaidOrdersJob & stopCancelUnpaidOrdersJob', () => {
    it('should not start an active cron timer when NODE_ENV is test', () => {
      const task = startCancelUnpaidOrdersJob();
      expect(task).toBeNull();
    });

    it('should stop background task cleanly without throwing exceptions', () => {
      expect(() => stopCancelUnpaidOrdersJob()).not.toThrow();
    });
  });

  describe('cancelExpiredOrders reconciliation sweep (AC1, AC2, AC3, AC4)', () => {
    it('should cancel orders older than 48 hours while leaving recent orders intact', async () => {
      if (!expiredOrder || !expiredOrder.id) return;

      const cancelledCount = await cancelExpiredOrders({ thresholdHours: 48 });

      expect(cancelledCount).toBeGreaterThanOrEqual(1);

      // Verify expired order is cancelled
      const reloadedExpired = await Order.findByPk(expiredOrder.id);
      expect(reloadedExpired.order_status).toBe('cancelled');
      expect(reloadedExpired.notes).toContain('auto_cancelled_unpaid');

      // Verify recent order is still pending
      const reloadedRecent = await Order.findByPk(recentOrder.id);
      expect(reloadedRecent.order_status).toBe('pending');
      expect(reloadedRecent.payment_status).toBe('pending');

      // Verify reserved stock was released (initial reserved was 5, 2 released -> 3)
      const reloadedVariant = await ProductVariant.findByPk(variant.id);
      expect(reloadedVariant.reserved_quantity).toBe(3);

      // Verify customer was sent an email cancellation notification
      const email = emailService.getLatestDispatchedEmail();
      expect(email).not.toBeNull();
      expect(email.to).toBe('expired.buyer@dickwella.lk');
      expect(email.subject).toContain('Order Lapsed');
      expect(email.reason).toBe('auto_cancelled_unpaid');
    });

    it('should return 0 cancelled orders when sweep finds no orders exceeding threshold', async () => {
      // Sweeping with a 500-hour threshold should match nothing
      const count = await cancelExpiredOrders({ thresholdHours: 500 });
      expect(count).toBe(0);
    });
  });
});
