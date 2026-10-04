const { ProductVariant, Product } = require('../../../src/models');

describe('ProductVariant Model Unit Tests (Shift-Left Validation)', () => {
  it('should instantiate a valid variant instance with default values', () => {
    const variant = ProductVariant.build({
      product_id: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
      sku: 'BATIK-SRT-BLU-M',
      color: 'Ocean Blue',
      stock_quantity: 50,
      reserved_quantity: 5,
    });

    expect(variant.sku).toBe('BATIK-SRT-BLU-M');
    expect(variant.size).toBe('FREE');
    expect(variant.color).toBe('Ocean Blue');
    expect(variant.stock_quantity).toBe(50);
    expect(variant.reserved_quantity).toBe(5);
    expect(variant.id).toBeDefined();
  });

  it('should accurately calculate availableStock getter as (stock_quantity - reserved_quantity)', () => {
    const variant = ProductVariant.build({
      product_id: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
      sku: 'BATIK-SRT-BLU-L',
      size: 'L',
      color: 'Navy Blue',
      stock_quantity: 40,
      reserved_quantity: 12,
    });

    expect(variant.availableStock).toBe(28);
  });

  it('should return availableStock as 0 when reserved exceeds or equals stock', () => {
    const variant = ProductVariant.build({
      product_id: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
      sku: 'BATIK-SRT-RED-XL',
      size: 'XL',
      color: 'Ruby Red',
      stock_quantity: 10,
      reserved_quantity: 15,
    });

    expect(variant.availableStock).toBe(0);
  });

  it('should reject negative stock_quantity', async () => {
    const variant = ProductVariant.build({
      product_id: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
      sku: 'BATIK-SRT-RED-S',
      color: 'Red',
      stock_quantity: -5,
    });

    await expect(variant.validate()).rejects.toThrow();
  });

  it('should reject negative reserved_quantity', async () => {
    const variant = ProductVariant.build({
      product_id: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
      sku: 'BATIK-SRT-RED-M',
      color: 'Red',
      reserved_quantity: -2,
    });

    await expect(variant.validate()).rejects.toThrow();
  });

  it('should reject invalid size ENUM values', async () => {
    const variant = ProductVariant.build({
      product_id: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
      sku: 'BATIK-SRT-RED-INVALID',
      size: 'XXXXXL_INVALID',
      color: 'Red',
    });

    await expect(variant.validate()).rejects.toThrow();
  });

  it('should accept valid size ENUM values', async () => {
    const validSizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'FREE'];

    for (const size of validSizes) {
      const variant = ProductVariant.build({
        product_id: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
        sku: `BATIK-SRT-BLU-${size}`,
        size,
        color: 'Blue',
      });

      // eslint-disable-next-line no-await-in-loop
      const validationError = await variant.validate().catch((err) => err);
      expect(validationError).not.toBeInstanceOf(Error);
    }
  });

  it('should define belongsTo Product association', () => {
    expect(ProductVariant.associations.product).toBeDefined();
    expect(ProductVariant.associations.product.target).toBe(Product);
    expect(ProductVariant.associations.product.foreignKey).toBe('product_id');
  });
});
