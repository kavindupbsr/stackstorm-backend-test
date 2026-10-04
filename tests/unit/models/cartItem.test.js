const { CartItem, User, ProductVariant } = require('../../../src/models');

describe('CartItem Model Unit Tests (Shift-Left Validation)', () => {
  it('should instantiate a valid cart item with default quantity 1', () => {
    const item = CartItem.build({
      user_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      product_variant_id: 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
    });

    expect(item.quantity).toBe(1);
    expect(item.user_id).toBe('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');
    expect(item.product_variant_id).toBe('c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a33');
    expect(item.id).toBeDefined();
  });

  it('should allow null user_id when guest_session_id is provided', async () => {
    const guestItem = CartItem.build({
      guest_session_id: 'sess_abc123xyz_dickwella',
      product_variant_id: 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
      quantity: 2,
    });

    await expect(guestItem.validate()).resolves.toBeDefined();
    expect(guestItem.user_id).toBeUndefined();
    expect(guestItem.guest_session_id).toBe('sess_abc123xyz_dickwella');
  });

  it('should reject quantity of 0', async () => {
    const item = CartItem.build({
      user_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      product_variant_id: 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
      quantity: 0,
    });

    await expect(item.validate()).rejects.toThrow();
  });

  it('should reject negative quantity', async () => {
    const item = CartItem.build({
      user_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      product_variant_id: 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
      quantity: -3,
    });

    await expect(item.validate()).rejects.toThrow();
  });

  it('should reject missing product_variant_id', async () => {
    const item = CartItem.build({
      user_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      quantity: 1,
    });

    await expect(item.validate()).rejects.toThrow();
  });

  it('should define belongsTo User and ProductVariant associations', () => {
    expect(CartItem.associations.user).toBeDefined();
    expect(CartItem.associations.user.target).toBe(User);
    expect(CartItem.associations.user.foreignKey).toBe('user_id');

    expect(CartItem.associations.variant).toBeDefined();
    expect(CartItem.associations.variant.target).toBe(ProductVariant);
    expect(CartItem.associations.variant.foreignKey).toBe('product_variant_id');
  });
});
