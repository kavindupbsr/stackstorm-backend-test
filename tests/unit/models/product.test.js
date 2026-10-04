const { Product, Category, ProductVariant, ProductImage } = require('../../../src/models');

describe('Product, Category & ProductImage Models Unit Tests (Shift-Left Validation)', () => {
  describe('Product Model', () => {
    it('should generate slug from title if slug is not provided', async () => {
      const product = Product.build({
        title: 'Traditional Handloom Cotton Saree',
        base_price: 8500.0,
      });

      await product.validate();
      expect(product.slug).toBe('traditional-handloom-cotton-saree');
    });

    it('should normalize custom slug to lowercase with dashes', async () => {
      const product = Product.build({
        title: 'Silk Kurti',
        slug: '  Silk-Kurti Special Edition!  ',
        base_price: 4500.0,
      });

      await product.validate();
      expect(product.slug).toBe('silk-kurti-special-edition');
    });

    it('should reject negative base_price', async () => {
      const product = Product.build({
        title: 'Discounted Shirt',
        base_price: -100.0,
      });

      await expect(product.validate()).rejects.toThrow();
    });

    it('should reject missing title', async () => {
      const product = Product.build({
        base_price: 2500.0,
      });

      await expect(product.validate()).rejects.toThrow();
    });

    it('should calculate availableStock across eager-loaded variants', () => {
      const product = Product.build({
        title: 'Linen Casual Shirt',
        base_price: 3200.0,
      });

      const variant1 = ProductVariant.build({
        sku: 'LINEN-M',
        size: 'M',
        color: 'White',
        stock_quantity: 20,
        reserved_quantity: 5,
      });

      const variant2 = ProductVariant.build({
        sku: 'LINEN-L',
        size: 'L',
        color: 'White',
        stock_quantity: 15,
        reserved_quantity: 2,
      });

      product.variants = [variant1, variant2];
      expect(product.availableStock).toBe(28); // (20-5) + (15-2) = 15 + 13 = 28
    });

    it('should define correct associations with Category, ProductVariant, and ProductImage', () => {
      expect(Product.associations.category).toBeDefined();
      expect(Product.associations.category.target).toBe(Category);
      expect(Product.associations.category.foreignKey).toBe('category_id');

      expect(Product.associations.variants).toBeDefined();
      expect(Product.associations.variants.target).toBe(ProductVariant);
      expect(Product.associations.variants.foreignKey).toBe('product_id');

      expect(Product.associations.images).toBeDefined();
      expect(Product.associations.images.target).toBe(ProductImage);
      expect(Product.associations.images.foreignKey).toBe('product_id');
    });
  });

  describe('Category Model', () => {
    it('should generate slug from category name', async () => {
      const category = Category.build({
        name: "Women's Ethnic Wear",
      });

      await category.validate();
      expect(category.slug).toBe('women-s-ethnic-wear');
    });

    it('should define self-referencing parent and children associations', () => {
      expect(Category.associations.parent).toBeDefined();
      expect(Category.associations.parent.target).toBe(Category);
      expect(Category.associations.parent.foreignKey).toBe('parent_id');

      expect(Category.associations.children).toBeDefined();
      expect(Category.associations.children.target).toBe(Category);
      expect(Category.associations.children.foreignKey).toBe('parent_id');

      expect(Category.associations.products).toBeDefined();
      expect(Category.associations.products.target).toBe(Product);
      expect(Category.associations.products.foreignKey).toBe('category_id');
    });
  });

  describe('ProductImage Model (Appendix E.4 Fix)', () => {
    it('should instantiate a valid product image instance', () => {
      const image = ProductImage.build({
        product_id: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
        image_url: 'https://images.dickwella-fashion.lk/products/saree-01.jpg',
        alt_text: 'Front view of cotton saree',
        is_primary: true,
        display_order: 1,
      });

      expect(image.image_url).toBe('https://images.dickwella-fashion.lk/products/saree-01.jpg');
      expect(image.is_primary).toBe(true);
      expect(image.display_order).toBe(1);
    });

    it('should reject missing image_url', async () => {
      const image = ProductImage.build({
        product_id: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
      });

      await expect(image.validate()).rejects.toThrow();
    });

    it('should define belongsTo Product association', () => {
      expect(ProductImage.associations.product).toBeDefined();
      expect(ProductImage.associations.product.target).toBe(Product);
      expect(ProductImage.associations.product.foreignKey).toBe('product_id');
    });
  });
});
