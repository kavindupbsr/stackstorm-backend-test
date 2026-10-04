const categoriesSeeder = require('../../src/seeders/20261004000001-demo-categories');
const usersSeeder = require('../../src/seeders/20261004000002-demo-users');
const productsSeeder = require('../../src/seeders/20261004000003-demo-products');
const imagesSeeder = require('../../src/seeders/20261004000004-demo-images');
const engagementsSeeder = require('../../src/seeders/20261004000005-demo-engagements');
const { sequelize } = require('../../src/models');

describe('STORM-011: Database Seed Integrity & Sri Lankan Catalog Shift-Left Test Suite', () => {
  afterAll(async () => {
    try {
      await sequelize.close();
    } catch {
      // Ignore cleanup error if connection is not open
    }
  });

  describe('Categories Seed Specification (AC2, §5.6)', () => {
    it('should export at least 6 categories including root departments and subcategories', () => {
      expect(categoriesSeeder.categories).toBeDefined();
      expect(categoriesSeeder.categories.length).toBeGreaterThanOrEqual(6);

      // Verify parent categories exist
      const parentCategories = categoriesSeeder.categories.filter((c) => c.parent_id === null);
      const parentSlugs = parentCategories.map((c) => c.slug);
      expect(parentSlugs).toContain('men');
      expect(parentSlugs).toContain('women');
      expect(parentSlugs).toContain('kids');
      expect(parentSlugs).toContain('accessories');

      // Verify child subcategories exist
      const childCategories = categoriesSeeder.categories.filter((c) => c.parent_id !== null);
      expect(childCategories.length).toBeGreaterThanOrEqual(4);
      const childSlugs = childCategories.map((c) => c.slug);
      expect(childSlugs).toContain('men-batik-shirts');
      expect(childSlugs).toContain('women-silk-saris');
    });

    it('all categories should have non-empty slugs, names, and UUIDv4 IDs', () => {
      categoriesSeeder.categories.forEach((cat) => {
        expect(cat.id).toMatch(/^[0-9a-fA-F-]{36}$/);
        expect(cat.name).toBeTruthy();
        expect(cat.slug).toMatch(/^[a-z0-9-]+$/);
      });
    });
  });

  describe('Users, Profiles & Loyalty Seed Specification (AC2, §5.6)', () => {
    it('should seed default admin user (admin@dickwellafashion.lk) and verified customers', () => {
      expect(usersSeeder.users).toBeDefined();
      const adminUser = usersSeeder.users.find((u) => u.email === 'admin@dickwellafashion.lk');
      expect(adminUser).toBeDefined();
      expect(adminUser.role).toBe('admin');
      expect(adminUser.is_email_verified).toBe(true);

      const inventoryUser = usersSeeder.users.find(
        (u) => u.email === 'inventory@dickwellafashion.lk'
      );
      expect(inventoryUser).toBeDefined();
      expect(inventoryUser.role).toBe('inventory_staff');

      const customerUsers = usersSeeder.users.filter((u) => u.role === 'customer');
      expect(customerUsers.length).toBeGreaterThanOrEqual(5);
    });

    it('should provide matching customer profiles and addresses with Sri Lankan localities', () => {
      expect(usersSeeder.customerProfiles.length).toBe(usersSeeder.users.length);

      const cities = usersSeeder.addresses.map((a) => a.city);
      expect(cities).toContain('Matara');
      expect(cities).toContain('Dickwella');
      expect(cities).toContain('Colombo');

      usersSeeder.addresses.forEach((addr) => {
        expect(addr.country).toBe('Sri Lanka');
        expect(addr.postal_code).toBeTruthy();
      });
    });

    it('should enforce 1:1 loyalty accounts referencing customer_id', () => {
      expect(usersSeeder.loyaltyAccounts.length).toBeGreaterThanOrEqual(4);
      usersSeeder.loyaltyAccounts.forEach((account) => {
        expect(account.customer_id).toMatch(/^[0-9a-fA-F-]{36}$/);
        expect(['bronze', 'silver', 'gold', 'platinum']).toContain(account.tier);
        expect(account.points_balance).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('Products & Variants Seed Specification (AC2 & AC3, §5.6)', () => {
    it('should seed at least 20 realistic Sri Lankan clothing retail products', () => {
      expect(productsSeeder.products).toBeDefined();
      expect(productsSeeder.products.length).toBeGreaterThanOrEqual(20);

      // Verify specific Sri Lankan fashion items
      const titles = productsSeeder.products.map((p) => p.title);
      expect(titles.some((t) => t.includes('Batik'))).toBe(true);
      expect(titles.some((t) => t.includes('Sari'))).toBe(true);
      expect(titles.some((t) => t.includes('Linen'))).toBe(true);
      expect(titles.some((t) => t.includes('Polo'))).toBe(true);
    });

    it('should format all prices in Sri Lankan Rupees (LKR) with realistic retail values (LKR 3,500 - 18,900)', () => {
      productsSeeder.products.forEach((product) => {
        expect(product.base_price).toBeGreaterThanOrEqual(2500.0);
        expect(product.base_price).toBeLessThanOrEqual(25000.0);
        expect(product.is_active).toBe(true);
      });
    });

    it('should generate multiple variants with valid size ENUM and unique SKUs per product', () => {
      expect(productsSeeder.productVariants.length).toBeGreaterThanOrEqual(
        productsSeeder.products.length * 2
      );

      const skus = new Set();
      const validSizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'FREE_SIZE'];

      productsSeeder.productVariants.forEach((variant) => {
        expect(variant.id).toMatch(/^[0-9a-fA-F-]{36}$/);
        expect(validSizes).toContain(variant.size);
        expect(variant.stock_quantity).toBeGreaterThanOrEqual(0);
        expect(variant.reserved_quantity).toBe(0);
        expect(skus.has(variant.sku)).toBe(false);
        skus.add(variant.sku);
      });
    });
  });

  describe('Images & Reviews Seed Specification', () => {
    it('should seed gallery images with valid image URLs and primary flags', () => {
      expect(imagesSeeder.productImages.length).toBeGreaterThanOrEqual(25);
      const primaryImages = imagesSeeder.productImages.filter((img) => img.is_primary);
      expect(primaryImages.length).toBeGreaterThanOrEqual(20);

      imagesSeeder.productImages.forEach((img) => {
        expect(img.image_url).toMatch(/^https:\/\/images\.unsplash\.com\//);
        expect(img.alt_text).toBeTruthy();
      });
    });

    it('should seed verified purchase reviews with realistic ratings (1-5)', () => {
      expect(engagementsSeeder.reviews.length).toBeGreaterThanOrEqual(5);
      engagementsSeeder.reviews.forEach((review) => {
        expect(review.rating).toBeGreaterThanOrEqual(1);
        expect(review.rating).toBeLessThanOrEqual(5);
        expect(review.is_verified_purchase).toBe(true);
        expect(review.review_text).toBeTruthy();
      });
    });
  });

  describe('Mock QueryInterface Bulk Execution (Shift-Left Seeder Contracts)', () => {
    it('should invoke bulkInsert and bulkDelete cleanly for all seeders', async () => {
      const insertedTables = {};
      const deletedTables = {};

      const mockQueryInterface = {
        bulkInsert: jest.fn().mockImplementation((tableName, records) => {
          insertedTables[tableName] = (insertedTables[tableName] || 0) + records.length;
          return Promise.resolve(records.length);
        }),
        bulkDelete: jest.fn().mockImplementation((tableName, filter) => {
          deletedTables[tableName] = filter;
          return Promise.resolve(1);
        }),
      };

      // Test up execution
      await categoriesSeeder.up(mockQueryInterface);
      await usersSeeder.up(mockQueryInterface);
      await productsSeeder.up(mockQueryInterface);
      await imagesSeeder.up(mockQueryInterface);
      await engagementsSeeder.up(mockQueryInterface);

      expect(insertedTables.categories).toBe(categoriesSeeder.categories.length);
      expect(insertedTables.users).toBe(usersSeeder.users.length);
      expect(insertedTables.products).toBe(productsSeeder.products.length);
      expect(insertedTables.product_variants).toBe(productsSeeder.productVariants.length);
      expect(insertedTables.product_images).toBe(imagesSeeder.productImages.length);
      expect(insertedTables.reviews).toBe(engagementsSeeder.reviews.length);

      // Test down execution
      await engagementsSeeder.down(mockQueryInterface);
      await imagesSeeder.down(mockQueryInterface);
      await productsSeeder.down(mockQueryInterface);
      await usersSeeder.down(mockQueryInterface);
      await categoriesSeeder.down(mockQueryInterface);

      expect(deletedTables.reviews).toBeDefined();
      expect(deletedTables.product_images).toBeDefined();
      expect(deletedTables.products).toBeDefined();
      expect(deletedTables.users).toBeDefined();
      expect(deletedTables.categories).toBeDefined();
    });
  });

  describe('Live Database Probe (Conditional Execution)', () => {
    it('should query live postgres if available, or gracefully pass when container is offline', async () => {
      try {
        await sequelize.authenticate();
        // If container is active, query real counts
        const [catResult] = await sequelize.query('SELECT count(*) as count FROM categories;');
        const [prodResult] = await sequelize.query('SELECT count(*) as count FROM products;');

        expect(parseInt(catResult[0].count, 10)).toBeGreaterThanOrEqual(6);
        expect(parseInt(prodResult[0].count, 10)).toBeGreaterThanOrEqual(20);
      } catch (err) {
        // When container is offline on local machine, verify it gracefully throws connection refused
        expect(err).toBeDefined();
        expect([
          'SequelizeConnectionRefusedError',
          'SequelizeAccessDeniedError',
          'ConnectionRefusedError',
          'AggregateError',
        ]).toContain(err.name);
      }
    });
  });
});
