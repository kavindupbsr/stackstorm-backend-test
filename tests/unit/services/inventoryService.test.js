const inventoryService = require('../../../src/services/inventory.service');
const {
  ProductVariant,
  Product,
  Category,
  InventoryLog,
  sequelize,
} = require('../../../src/models');
const redisClient = require('../../../src/config/redis');

describe('Unit: InventoryService & Audit Logging (STORM-037)', () => {
  let category;
  let product;
  let variant;
  const staffUserId = 'b0000000-0000-0000-0000-000000000002'; // inventory@dickwellafashion.lk

  beforeAll(async () => {
    try {
      category = await Category.create({
        name: `Unit Inv Cat ${Date.now()}`,
        slug: `unit-inv-cat-${Date.now()}`,
      });

      product = await Product.create({
        category_id: category.id,
        title: `Linen Sarong ${Date.now()}`,
        slug: `linen-sarong-${Date.now()}`,
        base_price: 4500.0,
      });

      variant = await ProductVariant.create({
        product_id: product.id,
        sku: `SARONG-RESTOCK-${Date.now()}`,
        size: 'FREE',
        color: 'Teal Blue',
        stock_quantity: 15,
        reserved_quantity: 0,
        price_override: null,
      });
    } catch (err) {
      console.warn('Unit inventory fixture notice:', err.message);
    }
  });

  afterAll(async () => {
    try {
      if (variant) {
        await InventoryLog.destroy({ where: { sku: variant.sku } });
        await ProductVariant.destroy({ where: { id: variant.id } });
      }
      if (product) await Product.destroy({ where: { id: product.id } });
      if (category) await Category.destroy({ where: { id: category.id } });

      await sequelize.close();
      await redisClient.quit();
    } catch {
      // Ignore disconnect error
    }
  });

  describe('Validation & Edge Cases', () => {
    it('should throw 400 badRequest if SKU is missing or empty', async () => {
      await expect(inventoryService.adjustStock('', 10, 'Restock')).rejects.toThrow(
        /SKU identifier is required/i
      );
      await expect(inventoryService.adjustStock(null, 10, 'Restock')).rejects.toThrow(
        /SKU identifier is required/i
      );
    });

    it('should throw 400 badRequest if adjustment is 0 or NaN', async () => {
      await expect(
        inventoryService.adjustStock(variant.sku, 0, 'Zero adjustment')
      ).rejects.toThrow(/Adjustment must be a non-zero integer/i);
      await expect(
        inventoryService.adjustStock(variant.sku, 'invalid', 'NaN adjustment')
      ).rejects.toThrow(/Adjustment must be a non-zero integer/i);
    });

    it('should throw 404 notFound if SKU does not exist', async () => {
      await expect(
        inventoryService.adjustStock('NONEXISTENT-SKU-999', 10, 'Restock')
      ).rejects.toThrow(/Product variant not found/i);
    });

    it('should throw 400 if adjustment would cause negative stock balance', async () => {
      // Current stock is 15. Attempting to subtract 20 would lead to -5
      await expect(
        inventoryService.adjustStock(variant.sku, -20, 'Over-reduction')
      ).rejects.toThrow(/Negative stock violation: stock_quantity cannot be negative/i);
    });
  });

  describe('Positive Restock & Negative Corrections', () => {
    it('should atomically increment stock quantity on positive restock and write audit log', async () => {
      const result = await inventoryService.adjustStock(
        variant.sku,
        25,
        'Shipment batch #104 arrived',
        staffUserId
      );

      expect(result.previous_stock).toBe(15);
      expect(result.new_stock).toBe(40);
      expect(result.adjustment).toBe(25);
      expect(result.is_low_stock).toBe(false);

      // Verify variant updated in database
      const reloaded = await ProductVariant.findByPk(variant.id);
      expect(reloaded.stock_quantity).toBe(40);

      // Verify audit log written in database
      const audit = await InventoryLog.findOne({
        where: { sku: variant.sku, quantity_change: 25 },
      });
      expect(audit).not.toBeNull();
      expect(audit.previous_stock).toBe(15);
      expect(audit.new_stock).toBe(40);
      expect(audit.reason).toBe('Shipment batch #104 arrived');
    });

    it('should decrement stock quantity and flag low-stock warning when balance drops <= threshold', async () => {
      // Balance is 40. Deduct 36 -> new balance is 4 (<= 5)
      const result = await inventoryService.adjustStock(
        variant.sku,
        -36,
        'Damaged water leakage in warehouse',
        staffUserId,
        5
      );

      expect(result.previous_stock).toBe(40);
      expect(result.new_stock).toBe(4);
      expect(result.adjustment).toBe(-36);
      expect(result.is_low_stock).toBe(true);

      const reloaded = await ProductVariant.findByPk(variant.id);
      expect(reloaded.stock_quantity).toBe(4);
    });
  });

  describe('Audit Trail Retrieval (getAuditLogs)', () => {
    it('should retrieve paginated audit logs for a specific SKU', async () => {
      const result = await inventoryService.getAuditLogs(variant.sku, { page: 1, limit: 10 });
      expect(result).toHaveProperty('logs');
      expect(result).toHaveProperty('pagination');
      expect(Array.isArray(result.logs)).toBe(true);
      expect(result.pagination.total).toBeGreaterThanOrEqual(2);
    });

    it('should retrieve global audit logs when SKU is null', async () => {
      const result = await inventoryService.getAuditLogs(null, { page: 1, limit: 5 });
      expect(result).toHaveProperty('logs');
      expect(Array.isArray(result.logs)).toBe(true);
    });
  });
});
