const {
  LoyaltyAccount,
  Return,
  User,
  Order,
  OrderItem,
  ProductVariant,
} = require('../../../src/models');

describe('LoyaltyAccount & Return Models Unit Tests (Shift-Left Validation)', () => {
  describe('LoyaltyAccount Model (Issue #6 Fix)', () => {
    it('should have customer_id as its sole primary key', () => {
      const primaryKeys = LoyaltyAccount.primaryKeyAttributes;
      expect(primaryKeys).toContain('customer_id');
      expect(primaryKeys).toHaveLength(1);
    });

    it('should instantiate a valid loyalty account with default values', () => {
      const account = LoyaltyAccount.build({
        customer_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      });

      expect(account.customer_id).toBe('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');
      expect(account.points_balance).toBe(0);
      expect(account.tier).toBe('silver');
      expect(account.lifetime_points).toBe(0);
    });

    it('should reject negative points_balance', async () => {
      const account = LoyaltyAccount.build({
        customer_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        points_balance: -50,
      });

      await expect(account.validate()).rejects.toThrow();
    });

    it('should accept valid loyalty tiers', async () => {
      for (const tier of ['silver', 'gold', 'platinum']) {
        const account = LoyaltyAccount.build({
          customer_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
          tier,
        });

        // eslint-disable-next-line no-await-in-loop
        const validationError = await account.validate().catch((err) => err);
        expect(validationError).not.toBeInstanceOf(Error);
      }
    });

    it('should define belongsTo User association', () => {
      expect(LoyaltyAccount.associations.customer).toBeDefined();
      expect(LoyaltyAccount.associations.customer.target).toBe(User);
      expect(LoyaltyAccount.associations.customer.foreignKey).toBe('customer_id');
    });
  });

  describe('Return Model (Issue #8 Fix)', () => {
    it('should allow type return without exchange_variant_id', async () => {
      const returnRecord = Return.build({
        order_id: 'd1eebc99-9c0b-4ef8-bb6d-6bb9bd380a44',
        order_item_id: 'e1eebc99-9c0b-4ef8-bb6d-6bb9bd380a55',
        user_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        type: 'return',
        reason: 'Size did not fit comfortably',
      });

      await expect(returnRecord.validate()).resolves.toBeDefined();
      expect(returnRecord.type).toBe('return');
      expect(returnRecord.exchange_variant_id).toBeUndefined();
    });

    it('should allow type exchange when exchange_variant_id is specified', async () => {
      const exchangeRecord = Return.build({
        order_id: 'd1eebc99-9c0b-4ef8-bb6d-6bb9bd380a44',
        order_item_id: 'e1eebc99-9c0b-4ef8-bb6d-6bb9bd380a55',
        user_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        type: 'exchange',
        reason: 'Exchange for Size L',
        exchange_variant_id: 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
      });

      await expect(exchangeRecord.validate()).resolves.toBeDefined();
      expect(exchangeRecord.type).toBe('exchange');
      expect(exchangeRecord.exchange_variant_id).toBe('c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a33');
    });

    it('should reject type exchange when exchange_variant_id is missing', async () => {
      const invalidExchange = Return.build({
        order_id: 'd1eebc99-9c0b-4ef8-bb6d-6bb9bd380a44',
        order_item_id: 'e1eebc99-9c0b-4ef8-bb6d-6bb9bd380a55',
        user_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        type: 'exchange',
        reason: 'Exchange requested without target variant',
      });

      await expect(invalidExchange.validate()).rejects.toThrow();
    });

    it('should define associations with Order, OrderItem, User, and ProductVariant', () => {
      expect(Return.associations.order).toBeDefined();
      expect(Return.associations.order.target).toBe(Order);
      expect(Return.associations.order.foreignKey).toBe('order_id');

      expect(Return.associations.orderItem).toBeDefined();
      expect(Return.associations.orderItem.target).toBe(OrderItem);
      expect(Return.associations.orderItem.foreignKey).toBe('order_item_id');

      expect(Return.associations.user).toBeDefined();
      expect(Return.associations.user.target).toBe(User);
      expect(Return.associations.user.foreignKey).toBe('user_id');

      expect(Return.associations.exchangeVariant).toBeDefined();
      expect(Return.associations.exchangeVariant.target).toBe(ProductVariant);
      expect(Return.associations.exchangeVariant.foreignKey).toBe('exchange_variant_id');
    });
  });
});
