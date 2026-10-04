const categories = [
  // Parent Categories
  {
    id: 'a0000000-0000-0000-0000-000000000001',
    name: 'Men',
    slug: 'men',
    description: 'Men clothing, batik shirts, formal wear, and accessories tailored in Sri Lanka.',
    parent_id: null,
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
  },
  {
    id: 'a0000000-0000-0000-0000-000000000002',
    name: 'Women',
    slug: 'women',
    description: 'Women designer silk saris, linen dresses, kurtis, and modern everyday wear.',
    parent_id: null,
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
  },
  {
    id: 'a0000000-0000-0000-0000-000000000003',
    name: 'Kids',
    slug: 'kids',
    description:
      'Festive traditional sarong sets, party dresses, and comfortable cotton clothing for kids.',
    parent_id: null,
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
  },
  {
    id: 'a0000000-0000-0000-0000-000000000004',
    name: 'Accessories',
    slug: 'accessories',
    description:
      'Artisan handcrafted belts, Dumbara weave shawls, and premium genuine leather accessories.',
    parent_id: null,
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
  },

  // Men Subcategories
  {
    id: 'a0000000-0000-0000-0000-000000000011',
    name: 'Batik Shirts',
    slug: 'men-batik-shirts',
    description: 'Authentic Sri Lankan hand-crafted batik casual and formal shirts.',
    parent_id: 'a0000000-0000-0000-0000-000000000001',
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
  },
  {
    id: 'a0000000-0000-0000-0000-000000000012',
    name: 'Formal Trousers',
    slug: 'men-formal-trousers',
    description: 'Expertly tailored executive trousers and pleated dress pants.',
    parent_id: 'a0000000-0000-0000-0000-000000000001',
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
  },
  {
    id: 'a0000000-0000-0000-0000-000000000013',
    name: 'Casual Tees & Polos',
    slug: 'men-casual-tees-polos',
    description: '100% combed cotton crew necks, pique polos, and casual henleys.',
    parent_id: 'a0000000-0000-0000-0000-000000000001',
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
  },
  {
    id: 'a0000000-0000-0000-0000-000000000014',
    name: 'Linen Casual Shirts',
    slug: 'men-linen-casual-shirts',
    description: 'Lightweight, breathable pure linen shirts designed for tropical climates.',
    parent_id: 'a0000000-0000-0000-0000-000000000001',
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
  },

  // Women Subcategories
  {
    id: 'a0000000-0000-0000-0000-000000000021',
    name: 'Silk Saris',
    slug: 'women-silk-saris',
    description: 'Handwoven Kandyan silk saris, temple borders, and festive bridal drape wear.',
    parent_id: 'a0000000-0000-0000-0000-000000000002',
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
  },
  {
    id: 'a0000000-0000-0000-0000-000000000022',
    name: 'Linen Dresses',
    slug: 'women-linen-dresses',
    description: 'Flowy midi dresses, wrap dresses, and casual shirt dresses in washed pure linen.',
    parent_id: 'a0000000-0000-0000-0000-000000000002',
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
  },
  {
    id: 'a0000000-0000-0000-0000-000000000023',
    name: 'Blouses & Tops',
    slug: 'women-blouses-tops',
    description: 'Block-printed tops, sleeveless blouses, and modern casual shirts.',
    parent_id: 'a0000000-0000-0000-0000-000000000002',
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
  },
  {
    id: 'a0000000-0000-0000-0000-000000000024',
    name: 'Traditional Kurtis',
    slug: 'women-traditional-kurtis',
    description: 'Embroidered festive tunics and kurtis for cultural and family celebrations.',
    parent_id: 'a0000000-0000-0000-0000-000000000002',
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
  },

  // Kids Subcategories
  {
    id: 'a0000000-0000-0000-0000-000000000031',
    name: 'Traditional Sarongs & Kits',
    slug: 'kids-traditional-sarongs',
    description: 'Comfortable handloom sarong kits tailored for young boys and festival functions.',
    parent_id: 'a0000000-0000-0000-0000-000000000003',
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
  },
  {
    id: 'a0000000-0000-0000-0000-000000000032',
    name: 'Party Wear',
    slug: 'kids-party-wear',
    description: 'Kids festive gowns, organza dresses, and smart waistcoats.',
    parent_id: 'a0000000-0000-0000-0000-000000000003',
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
  },

  // Accessories Subcategories
  {
    id: 'a0000000-0000-0000-0000-000000000041',
    name: 'Belts & Wallets',
    slug: 'accessories-belts-wallets',
    description:
      'Handcrafted genuine leather belts, bifold wallets, and small leather accessories.',
    parent_id: 'a0000000-0000-0000-0000-000000000004',
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
  },
  {
    id: 'a0000000-0000-0000-0000-000000000042',
    name: 'Shawls & Bags',
    slug: 'accessories-shawls-bags',
    description: 'Dumbara handloom shawls and artisan cotton tote bags.',
    parent_id: 'a0000000-0000-0000-0000-000000000004',
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
  },
];

module.exports = {
  up: async (queryInterface) => {
    // Insert parent categories first (where parent_id is null)
    const parents = categories.filter((c) => c.parent_id === null);
    const children = categories.filter((c) => c.parent_id !== null);

    await queryInterface.bulkInsert('categories', parents, {});
    await queryInterface.bulkInsert('categories', children, {});
  },

  down: async (queryInterface) => {
    const ids = categories.map((c) => c.id);
    await queryInterface.bulkDelete('categories', { id: ids }, {});
  },

  categories,
};
