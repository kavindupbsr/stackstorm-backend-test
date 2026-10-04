const rawProducts = [
  // 1-4: Men Batik Shirts
  {
    id: 'c0000000-0000-0000-0000-000000000001',
    category_id: 'a0000000-0000-0000-0000-000000000011',
    title: 'Classic Batik Short Sleeve Shirt',
    slug: 'classic-batik-short-sleeve-shirt',
    description: 'Authentic Sri Lankan wax-resist dyed batik shirt in breathable tropical cotton.',
    base_price: 4850.0,
    is_active: true,
    is_final_sale: false,
    variants: [
      { size: 'M', color: 'Ocean Blue', stock: 25, sku: 'MS-BAT-001-BLU-M', price_modifier: 0.0 },
      { size: 'L', color: 'Ocean Blue', stock: 30, sku: 'MS-BAT-001-BLU-L', price_modifier: 0.0 },
      {
        size: 'XL',
        color: 'Ocean Blue',
        stock: 15,
        sku: 'MS-BAT-001-BLU-XL',
        price_modifier: 250.0,
      },
    ],
  },
  {
    id: 'c0000000-0000-0000-0000-000000000002',
    category_id: 'a0000000-0000-0000-0000-000000000011',
    title: 'Heritage Indigo Handloom Batik Shirt',
    slug: 'heritage-indigo-handloom-batik-shirt',
    description: 'Deep indigo handloom cotton with traditional geometric batik motifs.',
    base_price: 6200.0,
    is_active: true,
    is_final_sale: false,
    variants: [
      { size: 'S', color: 'Indigo Navy', stock: 12, sku: 'MS-BAT-002-IND-S', price_modifier: 0.0 },
      { size: 'M', color: 'Indigo Navy', stock: 20, sku: 'MS-BAT-002-IND-M', price_modifier: 0.0 },
      { size: 'L', color: 'Indigo Navy', stock: 18, sku: 'MS-BAT-002-IND-L', price_modifier: 0.0 },
    ],
  },
  {
    id: 'c0000000-0000-0000-0000-000000000003',
    category_id: 'a0000000-0000-0000-0000-000000000011',
    title: 'Ceylon Ochre Casual Batik Shirt',
    slug: 'ceylon-ochre-casual-batik-shirt',
    description: 'Warm earth-toned casual shirt crafted with natural botanical dyes.',
    base_price: 5400.0,
    is_active: true,
    is_final_sale: false,
    variants: [
      { size: 'M', color: 'Earthy Ochre', stock: 16, sku: 'MS-BAT-003-OCH-M', price_modifier: 0.0 },
      { size: 'L', color: 'Earthy Ochre', stock: 22, sku: 'MS-BAT-003-OCH-L', price_modifier: 0.0 },
      {
        size: 'XL',
        color: 'Earthy Ochre',
        stock: 10,
        sku: 'MS-BAT-003-OCH-XL',
        price_modifier: 200.0,
      },
    ],
  },
  {
    id: 'c0000000-0000-0000-0000-000000000004',
    category_id: 'a0000000-0000-0000-0000-000000000011',
    title: 'Tropical Emerald Print Batik Shirt',
    slug: 'tropical-emerald-print-batik-shirt',
    description: 'Resort wear batik short sleeve shirt with palm foliage pattern.',
    base_price: 5900.0,
    is_active: true,
    is_final_sale: false,
    variants: [
      {
        size: 'S',
        color: 'Emerald Green',
        stock: 10,
        sku: 'MS-BAT-004-EME-S',
        price_modifier: 0.0,
      },
      {
        size: 'M',
        color: 'Emerald Green',
        stock: 25,
        sku: 'MS-BAT-004-EME-M',
        price_modifier: 0.0,
      },
      {
        size: 'L',
        color: 'Emerald Green',
        stock: 20,
        sku: 'MS-BAT-004-EME-L',
        price_modifier: 0.0,
      },
    ],
  },

  // 5-7: Men Formal Trousers
  {
    id: 'c0000000-0000-0000-0000-000000000005',
    category_id: 'a0000000-0000-0000-0000-000000000012',
    title: 'Tailored Charcoal Formal Trousers',
    slug: 'tailored-charcoal-formal-trousers',
    description:
      'Wrinkle-resistant poly-viscose formal trousers designed for boardrooms and galas.',
    base_price: 7400.0,
    is_active: true,
    is_final_sale: false,
    variants: [
      {
        size: 'M',
        color: 'Charcoal Grey',
        stock: 20,
        sku: 'MT-FRM-005-CHR-M',
        price_modifier: 0.0,
      },
      {
        size: 'L',
        color: 'Charcoal Grey',
        stock: 25,
        sku: 'MT-FRM-005-CHR-L',
        price_modifier: 0.0,
      },
      {
        size: 'XL',
        color: 'Charcoal Grey',
        stock: 15,
        sku: 'MT-FRM-005-CHR-XL',
        price_modifier: 0.0,
      },
    ],
  },
  {
    id: 'c0000000-0000-0000-0000-000000000006',
    category_id: 'a0000000-0000-0000-0000-000000000012',
    title: 'Slim Fit Navy Executive Trousers',
    slug: 'slim-fit-navy-executive-trousers',
    description: 'Modern tapered silhouette executive trousers with flexible waistband.',
    base_price: 7800.0,
    is_active: true,
    is_final_sale: false,
    variants: [
      {
        size: 'S',
        color: 'Midnight Navy',
        stock: 14,
        sku: 'MT-FRM-006-NAV-S',
        price_modifier: 0.0,
      },
      {
        size: 'M',
        color: 'Midnight Navy',
        stock: 28,
        sku: 'MT-FRM-006-NAV-M',
        price_modifier: 0.0,
      },
      {
        size: 'L',
        color: 'Midnight Navy',
        stock: 20,
        sku: 'MT-FRM-006-NAV-L',
        price_modifier: 0.0,
      },
    ],
  },
  {
    id: 'c0000000-0000-0000-0000-000000000007',
    category_id: 'a0000000-0000-0000-0000-000000000012',
    title: 'Classic Khaki Pleated Dress Pants',
    slug: 'classic-khaki-pleated-dress-pants',
    description: 'Timeless double-pleated chino dress pants with breathable cotton blend.',
    base_price: 6900.0,
    is_active: true,
    is_final_sale: false,
    variants: [
      { size: 'M', color: 'Khaki Sand', stock: 18, sku: 'MT-FRM-007-KHA-M', price_modifier: 0.0 },
      { size: 'L', color: 'Khaki Sand', stock: 22, sku: 'MT-FRM-007-KHA-L', price_modifier: 0.0 },
      { size: 'XL', color: 'Khaki Sand', stock: 12, sku: 'MT-FRM-007-KHA-XL', price_modifier: 0.0 },
    ],
  },

  // 8-10: Men Casual Tees & Polos
  {
    id: 'c0000000-0000-0000-0000-000000000008',
    category_id: 'a0000000-0000-0000-0000-000000000013',
    title: 'Dickwella Coastal Pique Polo',
    slug: 'dickwella-coastal-pique-polo',
    description: 'Heavyweight organic cotton pique polo with tipped collar and coconut buttons.',
    base_price: 3800.0,
    is_active: true,
    is_final_sale: false,
    variants: [
      { size: 'S', color: 'Sky Blue', stock: 30, sku: 'MP-POL-008-SKY-S', price_modifier: 0.0 },
      { size: 'M', color: 'Sky Blue', stock: 45, sku: 'MP-POL-008-SKY-M', price_modifier: 0.0 },
      { size: 'L', color: 'Sky Blue', stock: 35, sku: 'MP-POL-008-SKY-L', price_modifier: 0.0 },
    ],
  },
  {
    id: 'c0000000-0000-0000-0000-000000000009',
    category_id: 'a0000000-0000-0000-0000-000000000013',
    title: 'Premium Combed Cotton Crew Neck Tee',
    slug: 'premium-combed-cotton-crew-neck-tee',
    description: 'Ultra-soft 180 GSM bio-washed combed cotton t-shirt for daily comfort.',
    base_price: 2950.0,
    is_active: true,
    is_final_sale: false,
    variants: [
      { size: 'S', color: 'Pure Black', stock: 40, sku: 'MT-CAS-009-BLK-S', price_modifier: 0.0 },
      { size: 'M', color: 'Pure Black', stock: 60, sku: 'MT-CAS-009-BLK-M', price_modifier: 0.0 },
      { size: 'L', color: 'Pure Black', stock: 50, sku: 'MT-CAS-009-BLK-L', price_modifier: 0.0 },
      { size: 'XL', color: 'Pure Black', stock: 30, sku: 'MT-CAS-009-BLK-XL', price_modifier: 0.0 },
    ],
  },
  {
    id: 'c0000000-0000-0000-0000-000000000010',
    category_id: 'a0000000-0000-0000-0000-000000000013',
    title: 'Southern Breeze Slub Henley',
    slug: 'southern-breeze-slub-henley',
    description: 'Textured slub jersey knit 3-button henley shirt for weekend outings.',
    base_price: 4200.0,
    is_active: true,
    is_final_sale: false,
    variants: [
      { size: 'M', color: 'Heather Grey', stock: 24, sku: 'MT-CAS-010-HGY-M', price_modifier: 0.0 },
      { size: 'L', color: 'Heather Grey', stock: 30, sku: 'MT-CAS-010-HGY-L', price_modifier: 0.0 },
      {
        size: 'XL',
        color: 'Heather Grey',
        stock: 18,
        sku: 'MT-CAS-010-HGY-XL',
        price_modifier: 0.0,
      },
    ],
  },

  // 11-12: Men Linen Casual Shirts
  {
    id: 'c0000000-0000-0000-0000-000000000011',
    category_id: 'a0000000-0000-0000-0000-000000000014',
    title: 'Pure White Relaxed Linen Shirt',
    slug: 'pure-white-relaxed-linen-shirt',
    description: '100% French flax linen long-sleeve shirt with mother of pearl buttons.',
    base_price: 6500.0,
    is_active: true,
    is_final_sale: false,
    variants: [
      {
        size: 'M',
        color: 'Optical White',
        stock: 20,
        sku: 'ML-LIN-011-WHT-M',
        price_modifier: 0.0,
      },
      {
        size: 'L',
        color: 'Optical White',
        stock: 25,
        sku: 'ML-LIN-011-WHT-L',
        price_modifier: 0.0,
      },
      {
        size: 'XL',
        color: 'Optical White',
        stock: 15,
        sku: 'ML-LIN-011-WHT-XL',
        price_modifier: 300.0,
      },
    ],
  },
  {
    id: 'c0000000-0000-0000-0000-000000000012',
    category_id: 'a0000000-0000-0000-0000-000000000014',
    title: 'Olive Washed Linen Mandarin Collar Shirt',
    slug: 'olive-washed-linen-mandarin-collar-shirt',
    description: 'Garment-washed linen shirt featuring a relaxed grandad collar.',
    base_price: 6800.0,
    is_active: true,
    is_final_sale: false,
    variants: [
      { size: 'S', color: 'Earthy Olive', stock: 12, sku: 'ML-LIN-012-OLV-S', price_modifier: 0.0 },
      { size: 'M', color: 'Earthy Olive', stock: 22, sku: 'ML-LIN-012-OLV-M', price_modifier: 0.0 },
      { size: 'L', color: 'Earthy Olive', stock: 18, sku: 'ML-LIN-012-OLV-L', price_modifier: 0.0 },
    ],
  },

  // 13-15: Women Silk Saris
  {
    id: 'c0000000-0000-0000-0000-000000000013',
    category_id: 'a0000000-0000-0000-0000-000000000021',
    title: 'Royal Kandyan Embroidered Silk Sari',
    slug: 'royal-kandyan-embroidered-silk-sari',
    description: 'Heirloom quality pure silk Osariya with gold thread embroidery.',
    base_price: 18900.0,
    is_active: true,
    is_final_sale: false,
    variants: [
      {
        size: 'FREE_SIZE',
        color: 'Royal Maroon',
        stock: 8,
        sku: 'WS-SAR-013-MAR-FS',
        price_modifier: 0.0,
      },
      {
        size: 'FREE_SIZE',
        color: 'Deep Teal',
        stock: 6,
        sku: 'WS-SAR-013-TEA-FS',
        price_modifier: 0.0,
      },
    ],
  },
  {
    id: 'c0000000-0000-0000-0000-000000000014',
    category_id: 'a0000000-0000-0000-0000-000000000021',
    title: 'Dickwella Crimson Jacquard Silk Sari',
    slug: 'dickwella-crimson-jacquard-silk-sari',
    description: 'Lustrous jacquard weave festive sari with contrasting pallu design.',
    base_price: 16500.0,
    is_active: true,
    is_final_sale: false,
    variants: [
      {
        size: 'FREE_SIZE',
        color: 'Crimson Red',
        stock: 10,
        sku: 'WS-SAR-014-CRM-FS',
        price_modifier: 0.0,
      },
      {
        size: 'FREE_SIZE',
        color: 'Peacock Green',
        stock: 7,
        sku: 'WS-SAR-014-GRN-FS',
        price_modifier: 0.0,
      },
    ],
  },
  {
    id: 'c0000000-0000-0000-0000-000000000015',
    category_id: 'a0000000-0000-0000-0000-000000000021',
    title: 'Golden Zari Woven Temple Sari',
    slug: 'golden-zari-woven-temple-sari',
    description: 'Traditional temple border sari in metallic copper gold and cream silk.',
    base_price: 17200.0,
    is_active: true,
    is_final_sale: false,
    variants: [
      {
        size: 'FREE_SIZE',
        color: 'Cream Gold',
        stock: 9,
        sku: 'WS-SAR-015-GLD-FS',
        price_modifier: 0.0,
      },
    ],
  },

  // 16-18: Women Linen Dresses
  {
    id: 'c0000000-0000-0000-0000-000000000016',
    category_id: 'a0000000-0000-0000-0000-000000000022',
    title: 'Coastal Breeze Tiered Linen Midi Dress',
    slug: 'coastal-breeze-tiered-linen-midi-dress',
    description: 'Tiered silhouette linen dress with adjustable straps and side pockets.',
    base_price: 8400.0,
    is_active: true,
    is_final_sale: false,
    variants: [
      { size: 'S', color: 'Powder Blue', stock: 15, sku: 'WD-LIN-016-PBL-S', price_modifier: 0.0 },
      { size: 'M', color: 'Powder Blue', stock: 22, sku: 'WD-LIN-016-PBL-M', price_modifier: 0.0 },
      { size: 'L', color: 'Powder Blue', stock: 18, sku: 'WD-LIN-016-PBL-L', price_modifier: 0.0 },
    ],
  },
  {
    id: 'c0000000-0000-0000-0000-000000000017',
    category_id: 'a0000000-0000-0000-0000-000000000022',
    title: 'Sunburst Yellow Wrap Linen Dress',
    slug: 'sunburst-yellow-wrap-linen-dress',
    description: 'Vibrant yellow wrap dress with tie sash and flattering A-line skirt.',
    base_price: 7900.0,
    is_active: true,
    is_final_sale: false,
    variants: [
      {
        size: 'S',
        color: 'Sunburst Yellow',
        stock: 12,
        sku: 'WD-LIN-017-YEL-S',
        price_modifier: 0.0,
      },
      {
        size: 'M',
        color: 'Sunburst Yellow',
        stock: 20,
        sku: 'WD-LIN-017-YEL-M',
        price_modifier: 0.0,
      },
      {
        size: 'L',
        color: 'Sunburst Yellow',
        stock: 14,
        sku: 'WD-LIN-017-YEL-L',
        price_modifier: 0.0,
      },
    ],
  },
  {
    id: 'c0000000-0000-0000-0000-000000000018',
    category_id: 'a0000000-0000-0000-0000-000000000022',
    title: 'Earthy Sage Linen Shirt Dress',
    slug: 'earthy-sage-linen-shirt-dress',
    description: 'Utilitarian shirt dress with self-belt and rolled sleeves in washed sage.',
    base_price: 8200.0,
    is_active: true,
    is_final_sale: false,
    variants: [
      { size: 'S', color: 'Sage Green', stock: 14, sku: 'WD-LIN-018-SAG-S', price_modifier: 0.0 },
      { size: 'M', color: 'Sage Green', stock: 24, sku: 'WD-LIN-018-SAG-M', price_modifier: 0.0 },
      { size: 'L', color: 'Sage Green', stock: 16, sku: 'WD-LIN-018-SAG-L', price_modifier: 0.0 },
    ],
  },

  // 19-20: Women Blouses & Tops
  {
    id: 'c0000000-0000-0000-0000-000000000019',
    category_id: 'a0000000-0000-0000-0000-000000000023',
    title: 'Hand-Block Printed Silk Blend Blouse',
    slug: 'hand-block-printed-silk-blend-blouse',
    description: 'Intricately patterned artisan blouse pairing seamlessly with sarees or skirts.',
    base_price: 4600.0,
    is_active: true,
    is_final_sale: false,
    variants: [
      { size: 'S', color: 'Terracotta', stock: 16, sku: 'WB-TOP-019-TER-S', price_modifier: 0.0 },
      { size: 'M', color: 'Terracotta', stock: 25, sku: 'WB-TOP-019-TER-M', price_modifier: 0.0 },
      { size: 'L', color: 'Terracotta', stock: 20, sku: 'WB-TOP-019-TER-L', price_modifier: 0.0 },
    ],
  },
  {
    id: 'c0000000-0000-0000-0000-000000000020',
    category_id: 'a0000000-0000-0000-0000-000000000023',
    title: 'Bohemian Ruffle Sleeveless Top',
    slug: 'bohemian-ruffle-sleeveless-top',
    description: 'Flirty layered sleeveless top cut from airy lightweight cotton voile.',
    base_price: 3600.0,
    is_active: true,
    is_final_sale: false,
    variants: [
      { size: 'S', color: 'Ivory White', stock: 20, sku: 'WB-TOP-020-IVO-S', price_modifier: 0.0 },
      { size: 'M', color: 'Ivory White', stock: 30, sku: 'WB-TOP-020-IVO-M', price_modifier: 0.0 },
      { size: 'L', color: 'Ivory White', stock: 25, sku: 'WB-TOP-020-IVO-L', price_modifier: 0.0 },
    ],
  },

  // 21: Women Traditional Kurtis
  {
    id: 'c0000000-0000-0000-0000-000000000021',
    category_id: 'a0000000-0000-0000-0000-000000000024',
    title: 'Traditional Embroidered Festive Kurti',
    slug: 'traditional-embroidered-festive-kurti',
    description: 'Straight-cut long kurti adorned with mirror work and zari embroidery.',
    base_price: 5200.0,
    is_active: true,
    is_final_sale: false,
    variants: [
      { size: 'M', color: 'Ruby Pink', stock: 18, sku: 'WK-KUR-021-RUB-M', price_modifier: 0.0 },
      { size: 'L', color: 'Ruby Pink', stock: 22, sku: 'WK-KUR-021-RUB-L', price_modifier: 0.0 },
      {
        size: 'XL',
        color: 'Ruby Pink',
        stock: 12,
        sku: 'WK-KUR-021-RUB-XL',
        price_modifier: 200.0,
      },
    ],
  },

  // 22-23: Kids
  {
    id: 'c0000000-0000-0000-0000-000000000022',
    category_id: 'a0000000-0000-0000-0000-000000000031',
    title: 'Little Lion Handloom Sarong & Shirt Set',
    slug: 'little-lion-handloom-sarong-shirt-set',
    description: 'Traditional Sri Lankan two-piece boys festival outfit in pure cotton handloom.',
    base_price: 4100.0,
    is_active: true,
    is_final_sale: false,
    variants: [
      {
        size: 'S',
        color: 'Maroon Stripe',
        stock: 20,
        sku: 'KS-SAR-022-MAR-S',
        price_modifier: 0.0,
      },
      {
        size: 'M',
        color: 'Maroon Stripe',
        stock: 25,
        sku: 'KS-SAR-022-MAR-M',
        price_modifier: 0.0,
      },
      {
        size: 'L',
        color: 'Maroon Stripe',
        stock: 15,
        sku: 'KS-SAR-022-MAR-L',
        price_modifier: 0.0,
      },
    ],
  },
  {
    id: 'c0000000-0000-0000-0000-000000000023',
    category_id: 'a0000000-0000-0000-0000-000000000032',
    title: 'Kids Floral Organza Princess Dress',
    slug: 'kids-floral-organza-princess-dress',
    description: 'Delicate pastel organza dress with cotton lining for birthday celebrations.',
    base_price: 4900.0,
    is_active: true,
    is_final_sale: false,
    variants: [
      { size: 'S', color: 'Pastel Blush', stock: 18, sku: 'KD-DRS-023-BLU-S', price_modifier: 0.0 },
      { size: 'M', color: 'Pastel Blush', stock: 22, sku: 'KD-DRS-023-BLU-M', price_modifier: 0.0 },
    ],
  },

  // 24-25: Accessories
  {
    id: 'c0000000-0000-0000-0000-000000000024',
    category_id: 'a0000000-0000-0000-0000-000000000041',
    title: 'Handcrafted Full-Grain Leather Belt',
    slug: 'handcrafted-full-grain-leather-belt',
    description: 'Full-grain vegetable-tanned leather belt with solid brushed brass hardware.',
    base_price: 3500.0,
    is_active: true,
    is_final_sale: false,
    variants: [
      { size: 'M', color: 'Cognac Brown', stock: 30, sku: 'AC-BLT-024-COG-M', price_modifier: 0.0 },
      { size: 'L', color: 'Cognac Brown', stock: 35, sku: 'AC-BLT-024-COG-L', price_modifier: 0.0 },
      { size: 'M', color: 'Jet Black', stock: 25, sku: 'AC-BLT-024-BLK-M', price_modifier: 0.0 },
    ],
  },
  {
    id: 'c0000000-0000-0000-0000-000000000025',
    category_id: 'a0000000-0000-0000-0000-000000000042',
    title: 'Dumbara Handloom Artisan Tote Bag',
    slug: 'dumbara-handloom-artisan-tote-bag',
    description:
      'Heritage UNESCO Dumbara weave tote bag with reinforced handles and interior zip pocket.',
    base_price: 4300.0,
    is_active: true,
    is_final_sale: false,
    variants: [
      {
        size: 'FREE_SIZE',
        color: 'Heritage Multi',
        stock: 20,
        sku: 'AC-BAG-025-MUL-FS',
        price_modifier: 0.0,
      },
    ],
  },
];

// Split into products and variants tables
const products = rawProducts.map((p) => ({
  id: p.id,
  category_id: p.category_id,
  title: p.title,
  slug: p.slug,
  description: p.description,
  base_price: p.base_price,
  is_active: p.is_active,
  is_final_sale: p.is_final_sale,
  created_at: new Date(),
  updated_at: new Date(),
}));

let variantCounter = 1;
const productVariants = [];

rawProducts.forEach((p) => {
  p.variants.forEach((v) => {
    const idHex = variantCounter.toString(16).padStart(12, '0');
    productVariants.push({
      id: `d0000000-0000-0000-0000-${idHex}`,
      product_id: p.id,
      sku: v.sku,
      size: v.size,
      color: v.color,
      stock_quantity: v.stock,
      reserved_quantity: 0,
      price_modifier: v.price_modifier,
      created_at: new Date(),
      updated_at: new Date(),
    });
    variantCounter += 1;
  });
});

module.exports = {
  up: async (queryInterface) => {
    const dbProducts = products.map((p) => ({
      id: p.id,
      category_id: p.category_id,
      title: p.title,
      slug: p.slug,
      description: p.description,
      base_price: p.base_price,
      is_active: p.is_active,
      created_at: p.created_at || new Date(),
      updated_at: p.updated_at || new Date(),
    }));

    const validSizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'FREE'];
    const dbVariants = productVariants.map((v) => {
      let normalizedSize = v.size;
      if (normalizedSize === 'FREE_SIZE' || !validSizes.includes(normalizedSize)) {
        normalizedSize = 'FREE';
      }
      return {
        id: v.id,
        product_id: v.product_id,
        sku: v.sku,
        size: normalizedSize,
        color: v.color,
        stock_quantity: v.stock_quantity,
        reserved_quantity: v.reserved_quantity || 0,
        price_override: v.price_override || null,
        created_at: v.created_at || new Date(),
        updated_at: v.updated_at || new Date(),
      };
    });

    await queryInterface.bulkInsert('products', dbProducts, {});
    await queryInterface.bulkInsert('product_variants', dbVariants, {});
  },

  down: async (queryInterface) => {
    const productIds = products.map((p) => p.id);
    await queryInterface.bulkDelete('product_variants', { product_id: productIds }, {});
    await queryInterface.bulkDelete('products', { id: productIds }, {});
  },

  products,
  productVariants,
};
