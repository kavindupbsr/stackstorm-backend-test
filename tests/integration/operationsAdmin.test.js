const request = require('supertest');
const app = require('../../src/app');
const { generateAccessToken } = require('../../src/services/token.service');
const loyaltyService = require('../../src/services/loyalty.service');
const {
  CustomerProfile,
  Category,
  Product,
  ProductVariant,
  Order,
  OrderItem,
  InventoryLog,
  LoyaltyAccount,
  Return,
  sequelize,
} = require('../../src/models');
const redisClient = require('../../src/config/redis');

describe('Operations & Admin Domain', () => {
  const adminUser = {
    id: 'b0000000-0000-0000-0000-000000000001',
    email: 'admin@dickwellafashion.lk',
    role: 'admin',
  };

  const inventoryStaff = {
    id: 'b0000000-0000-0000-0000-000000000002',
    email: 'inventory@dickwellafashion.lk',
    role: 'inventory_staff',
  };

  const customerUser = {
    id: 'b0000000-0000-0000-0000-000000000003',
    email: 'pabasara@example.lk',
    role: 'customer',
  };

  const adminToken = generateAccessToken(adminUser);
  const inventoryToken = generateAccessToken(inventoryStaff);
  const customerToken = generateAccessToken(customerUser);

  let category;
  let product;
  let variant;
  let deliveredOrder;
  let expiredOrder;
  let eligibleOrderItem;
  let expiredOrderItem;

  beforeAll(async () => {
    try {
      const ts = Date.now();

      // Ensure customer profile and loyalty account exist
      await CustomerProfile.findOrCreate({
        where: { user_id: customerUser.id },
        defaults: {
          user_id: customerUser.id,
          loyalty_tier: 'gold',
        },
      });

      const loyaltyAcc = await loyaltyService.getOrCreateAccount(customerUser.id);
      loyaltyAcc.tier = 'gold';
      loyaltyAcc.annual_spend = 15000.0; // sub-threshold (< 25k) to test grace period
      loyaltyAcc.consecutive_below_threshold_quarters = 0;
      await loyaltyAcc.save();

      // Create product catalog
      category = await Category.create({
        name: `Ops Cat ${ts}`,
        slug: `ops-cat-${ts}`,
      });

      product = await Product.create({
        category_id: category.id,
        title: `Ops Linen Kurta ${ts}`,
        slug: `ops-linen-kurta-${ts}`,
        base_price: 6500.0,
        is_active: true,
      });

      variant = await ProductVariant.create({
        product_id: product.id,
        sku: `OPS-KURTA-${ts}`,
        size: 'L',
        color: 'Ivory',
        stock_quantity: 30,
        reserved_quantity: 0,
      });

      const now = new Date();
      const date15DaysAgo = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);
      const date35DaysAgo = new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000);

      // Delivered Order within 30-day window
      deliveredOrder = await Order.create({
        order_number: `ORD-OPS-DEL-${ts}`,
        customer_id: customerUser.id,
        order_status: 'delivered',
        payment_status: 'paid',
        delivered_at: date15DaysAgo,
        total_amount: 13000.0,
        shipping_address_snapshot: { city: 'Dickwella', address_line1: 'Main Street' },
      });

      // Delivered Order expired (35 days ago)
      expiredOrder = await Order.create({
        order_number: `ORD-OPS-EXP-${ts}`,
        customer_id: customerUser.id,
        order_status: 'delivered',
        payment_status: 'paid',
        delivered_at: date35DaysAgo,
        total_amount: 6500.0,
        shipping_address_snapshot: { city: 'Matara', address_line1: 'Beach Road' },
      });

      eligibleOrderItem = await OrderItem.create({
        order_id: deliveredOrder.id,
        product_variant_id: variant.id,
        quantity: 2,
        unit_price_at_purchase: 6500.0,
        total_price: 13000.0,
        product_title_snapshot: product.title,
        variant_sku_snapshot: variant.sku,
        is_final_sale: false,
      });

      expiredOrderItem = await OrderItem.create({
        order_id: expiredOrder.id,
        product_variant_id: variant.id,
        quantity: 1,
        unit_price_at_purchase: 6500.0,
        total_price: 6500.0,
        product_title_snapshot: product.title,
        variant_sku_snapshot: variant.sku,
        is_final_sale: false,
      });
    } catch (err) {
      console.warn('Operations test setup warning:', err.message);
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
      if (variant) {
        await InventoryLog.destroy({ where: { sku: variant.sku } });
      }

      await OrderItem.destroy({
        where: {
          order_id: [deliveredOrder?.id, expiredOrder?.id].filter(Boolean),
        },
      });
      await Order.destroy({
        where: {
          id: [deliveredOrder?.id, expiredOrder?.id].filter(Boolean),
        },
      });
      if (variant) await ProductVariant.destroy({ where: { id: variant.id } });
      if (product) await Product.destroy({ where: { id: product.id } });
      if (category) await Category.destroy({ where: { id: category.id } });

      await sequelize.close();
      await redisClient.quit();
    } catch {
      // Ignore cleanup error
    }
  });

  it('Retrieve dashboard analytics', async () => {
    const res = await request(app)
      .get('/api/v1/admin/analytics/overview')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('totalRevenue');
    expect(res.body.data).toHaveProperty('totalRevenueRaw');
    expect(res.body.data).toHaveProperty('totalOrders');
    expect(res.body.data).toHaveProperty('lowStockItems');
    expect(res.body.data.currency).toBe('LKR');
  });

  it('Restock variant SKU with audit log', async () => {
    const previousStock = variant.stock_quantity;
    const adjustmentQty = 20;

    const res = await request(app)
      .patch(`/api/v1/inventory/variants/${variant.sku}/stock`)
      .set('Authorization', `Bearer ${inventoryToken}`)
      .send({
        adjustment: adjustmentQty,
        reason: 'Restocking shipment received from Southern Mills',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.sku).toBe(variant.sku);
    expect(res.body.data.adjustment).toBe(adjustmentQty);
    expect(res.body.data.previous_stock).toBe(previousStock);
    expect(res.body.data.new_stock).toBe(previousStock + adjustmentQty);

    // Verify audit log creation
    const logs = await InventoryLog.findAll({ where: { sku: variant.sku } });
    expect(logs.length).toBeGreaterThanOrEqual(1);
    expect(logs[0].quantity_change).toBe(adjustmentQty);
  });

  it('Enforce 30-day delivery return window', async () => {
    // 1. Expired order (>30 days) must be rejected with 400
    const expiredRes = await request(app)
      .post('/api/v1/returns')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        order_item_id: expiredOrderItem.id,
        type: 'return',
        reason: 'Item does not fit',
      });

    expect(expiredRes.status).toBe(400);
    expect(expiredRes.body.message).toContain('Return window has expired (30 days from delivery date)');

    // 2. Eligible order (<=30 days) must be accepted with 201
    const validRes = await request(app)
      .post('/api/v1/returns')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        order_item_id: eligibleOrderItem.id,
        type: 'return',
        reason: 'Color was not as expected',
      });

    expect(validRes.status).toBe(201);
    expect(validRes.body.success).toBe(true);
    expect(validRes.body.data.return_id).toBeDefined();
    expect(validRes.body.data.status).toBe('requested');
  });

  it('Enforce 2-quarter grace period for loyalty downgrade', async () => {
    // Customer has annual_spend = 15,000 (below Gold 25k threshold) and consecutive = 0
    // Trigger Quarter 1 audit: tier should be retained under grace period (consecutive = 1)
    const auditRes1 = await request(app)
      .post('/api/v1/loyalty/audit')
      .set('Authorization', `Bearer ${adminToken}`)
      .send();

    expect(auditRes1.status).toBe(200);
    expect(auditRes1.body.success).toBe(true);

    const accountQ1 = await LoyaltyAccount.findByPk(customerUser.id);
    expect(accountQ1.tier).toBe('gold'); // Retained under grace period!
    expect(accountQ1.consecutive_below_threshold_quarters).toBe(1);

    // Trigger Quarter 2 audit: consecutive strikes reached 2 -> Downgraded to Silver
    const auditRes2 = await request(app)
      .post('/api/v1/loyalty/audit')
      .set('Authorization', `Bearer ${adminToken}`)
      .send();

    expect(auditRes2.status).toBe(200);

    const accountQ2 = await LoyaltyAccount.findByPk(customerUser.id);
    expect(accountQ2.tier).toBe('silver'); // Downgraded on second consecutive quarter!
    expect(accountQ2.consecutive_below_threshold_quarters).toBe(0);
  });

  it('Block non-admin from operational endpoints', async () => {
    // 1. Customer blocked from Analytics
    const analyticsRes = await request(app)
      .get('/api/v1/admin/analytics/overview')
      .set('Authorization', `Bearer ${customerToken}`);
    expect(analyticsRes.status).toBe(403);

    // 2. Customer blocked from Inventory Restock
    const restockRes = await request(app)
      .patch(`/api/v1/inventory/variants/${variant.sku}/stock`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ adjustment: 10 });
    expect(restockRes.status).toBe(403);

    // 3. Customer blocked from Loyalty Audit
    const auditRes = await request(app)
      .post('/api/v1/loyalty/audit')
      .set('Authorization', `Bearer ${customerToken}`);
    expect(auditRes.status).toBe(403);

    // 4. Unauthenticated blocked
    const unauthRes = await request(app).get('/api/v1/admin/analytics/overview');
    expect(unauthRes.status).toBe(401);
  });
});
