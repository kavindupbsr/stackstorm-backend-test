const fashionImages = [
  // 1. Classic Batik Short Sleeve Shirt
  {
    product_id: 'c0000000-0000-0000-0000-000000000001',
    image_url:
      'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&w=800&q=80',
    alt_text: 'Classic Batik Short Sleeve Shirt - Front View',
    display_order: 1,
    is_primary: true,
  },
  {
    product_id: 'c0000000-0000-0000-0000-000000000001',
    image_url:
      'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&w=800&q=80',
    alt_text: 'Classic Batik Short Sleeve Shirt - Detail View',
    display_order: 2,
    is_primary: false,
  },

  // 2. Heritage Indigo Handloom Batik Shirt
  {
    product_id: 'c0000000-0000-0000-0000-000000000002',
    image_url:
      'https://images.unsplash.com/photo-1620012253295-c15c429f66bf?auto=format&fit=crop&w=800&q=80',
    alt_text: 'Heritage Indigo Handloom Batik Shirt - Studio Pose',
    display_order: 1,
    is_primary: true,
  },

  // 3. Ceylon Ochre Casual Batik Shirt
  {
    product_id: 'c0000000-0000-0000-0000-000000000003',
    image_url:
      'https://images.unsplash.com/photo-1598033129183-c4f50c736f10?auto=format&fit=crop&w=800&q=80',
    alt_text: 'Ceylon Ochre Casual Batik Shirt - Front View',
    display_order: 1,
    is_primary: true,
  },

  // 4. Tropical Emerald Print Batik Shirt
  {
    product_id: 'c0000000-0000-0000-0000-000000000004',
    image_url:
      'https://images.unsplash.com/photo-1576995853123-5a10305d93c0?auto=format&fit=crop&w=800&q=80',
    alt_text: 'Tropical Emerald Print Batik Shirt - Vacation Look',
    display_order: 1,
    is_primary: true,
  },

  // 5. Tailored Charcoal Formal Trousers
  {
    product_id: 'c0000000-0000-0000-0000-000000000005',
    image_url:
      'https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?auto=format&fit=crop&w=800&q=80',
    alt_text: 'Tailored Charcoal Formal Trousers - Standing Fit',
    display_order: 1,
    is_primary: true,
  },

  // 6. Slim Fit Navy Executive Trousers
  {
    product_id: 'c0000000-0000-0000-0000-000000000006',
    image_url:
      'https://images.unsplash.com/photo-1473966968600-fa801b869a1a?auto=format&fit=crop&w=800&q=80',
    alt_text: 'Slim Fit Navy Executive Trousers - Side View',
    display_order: 1,
    is_primary: true,
  },

  // 7. Classic Khaki Pleated Dress Pants
  {
    product_id: 'c0000000-0000-0000-0000-000000000007',
    image_url:
      'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&w=800&q=80',
    alt_text: 'Classic Khaki Pleated Dress Pants - Neutral Fit',
    display_order: 1,
    is_primary: true,
  },

  // 8. Dickwella Coastal Pique Polo
  {
    product_id: 'c0000000-0000-0000-0000-000000000008',
    image_url:
      'https://images.unsplash.com/photo-1581655353564-df123a1eb820?auto=format&fit=crop&w=800&q=80',
    alt_text: 'Dickwella Coastal Pique Polo - Ocean Blue',
    display_order: 1,
    is_primary: true,
  },

  // 9. Premium Combed Cotton Crew Neck Tee
  {
    product_id: 'c0000000-0000-0000-0000-000000000009',
    image_url:
      'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=800&q=80',
    alt_text: 'Premium Combed Cotton Crew Neck Tee - Black Minimal',
    display_order: 1,
    is_primary: true,
  },

  // 10. Southern Breeze Slub Henley
  {
    product_id: 'c0000000-0000-0000-0000-000000000010',
    image_url:
      'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?auto=format&fit=crop&w=800&q=80',
    alt_text: 'Southern Breeze Slub Henley - Heather Texture',
    display_order: 1,
    is_primary: true,
  },

  // 11. Pure White Relaxed Linen Shirt
  {
    product_id: 'c0000000-0000-0000-0000-000000000011',
    image_url:
      'https://images.unsplash.com/photo-1603252109303-2751441dd157?auto=format&fit=crop&w=800&q=80',
    alt_text: 'Pure White Relaxed Linen Shirt - Lifestyle Shoot',
    display_order: 1,
    is_primary: true,
  },

  // 12. Olive Washed Linen Mandarin Collar Shirt
  {
    product_id: 'c0000000-0000-0000-0000-000000000012',
    image_url:
      'https://images.unsplash.com/photo-1607345366928-199ea26cfe3e?auto=format&fit=crop&w=800&q=80',
    alt_text: 'Olive Washed Linen Mandarin Collar Shirt - Casual Stand',
    display_order: 1,
    is_primary: true,
  },

  // 13. Royal Kandyan Embroidered Silk Sari
  {
    product_id: 'c0000000-0000-0000-0000-000000000013',
    image_url:
      'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=800&q=80',
    alt_text: 'Royal Kandyan Embroidered Silk Sari - Bridal Drape',
    display_order: 1,
    is_primary: true,
  },

  // 14. Dickwella Crimson Jacquard Silk Sari
  {
    product_id: 'c0000000-0000-0000-0000-000000000014',
    image_url:
      'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?auto=format&fit=crop&w=800&q=80',
    alt_text: 'Dickwella Crimson Jacquard Silk Sari - Traditional Style',
    display_order: 1,
    is_primary: true,
  },

  // 15. Golden Zari Woven Temple Sari
  {
    product_id: 'c0000000-0000-0000-0000-000000000015',
    image_url:
      'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=800&q=80',
    alt_text: 'Golden Zari Woven Temple Sari - Festive Elegance',
    display_order: 1,
    is_primary: true,
  },

  // 16. Coastal Breeze Tiered Linen Midi Dress
  {
    product_id: 'c0000000-0000-0000-0000-000000000016',
    image_url:
      'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?auto=format&fit=crop&w=800&q=80',
    alt_text: 'Coastal Breeze Tiered Linen Midi Dress - Summer Day',
    display_order: 1,
    is_primary: true,
  },

  // 17. Sunburst Yellow Wrap Linen Dress
  {
    product_id: 'c0000000-0000-0000-0000-000000000017',
    image_url:
      'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?auto=format&fit=crop&w=800&q=80',
    alt_text: 'Sunburst Yellow Wrap Linen Dress - Chic Model',
    display_order: 1,
    is_primary: true,
  },

  // 18. Earthy Sage Linen Shirt Dress
  {
    product_id: 'c0000000-0000-0000-0000-000000000018',
    image_url:
      'https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=800&q=80',
    alt_text: 'Earthy Sage Linen Shirt Dress - Elegant Streetwear',
    display_order: 1,
    is_primary: true,
  },

  // 19. Hand-Block Printed Silk Blend Blouse
  {
    product_id: 'c0000000-0000-0000-0000-000000000019',
    image_url:
      'https://images.unsplash.com/photo-1551803091-e20673f15770?auto=format&fit=crop&w=800&q=80',
    alt_text: 'Hand-Block Printed Silk Blend Blouse - Close Detail',
    display_order: 1,
    is_primary: true,
  },

  // 20. Bohemian Ruffle Sleeveless Top
  {
    product_id: 'c0000000-0000-0000-0000-000000000020',
    image_url:
      'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=800&q=80',
    alt_text: 'Bohemian Ruffle Sleeveless Top - Sunlit Portrait',
    display_order: 1,
    is_primary: true,
  },

  // 21. Traditional Embroidered Festive Kurti
  {
    product_id: 'c0000000-0000-0000-0000-000000000021',
    image_url:
      'https://images.unsplash.com/photo-1610030469668-93510cb67655?auto=format&fit=crop&w=800&q=80',
    alt_text: 'Traditional Embroidered Festive Kurti - Rich Magenta',
    display_order: 1,
    is_primary: true,
  },

  // 22. Little Lion Handloom Sarong & Shirt Set
  {
    product_id: 'c0000000-0000-0000-0000-000000000022',
    image_url:
      'https://images.unsplash.com/photo-1519238263530-99bdd11df2ea?auto=format&fit=crop&w=800&q=80',
    alt_text: 'Little Lion Handloom Sarong & Shirt Set - Festive Boy',
    display_order: 1,
    is_primary: true,
  },

  // 23. Kids Floral Organza Princess Dress
  {
    product_id: 'c0000000-0000-0000-0000-000000000023',
    image_url:
      'https://images.unsplash.com/photo-1518831959646-742c3a14ebf7?auto=format&fit=crop&w=800&q=80',
    alt_text: 'Kids Floral Organza Princess Dress - Birthday Portrait',
    display_order: 1,
    is_primary: true,
  },

  // 24. Handcrafted Full-Grain Leather Belt
  {
    product_id: 'c0000000-0000-0000-0000-000000000024',
    image_url:
      'https://images.unsplash.com/photo-1624222247344-550fb60583dc?auto=format&fit=crop&w=800&q=80',
    alt_text: 'Handcrafted Full-Grain Leather Belt - Brown & Brass',
    display_order: 1,
    is_primary: true,
  },

  // 25. Dumbara Handloom Artisan Tote Bag
  {
    product_id: 'c0000000-0000-0000-0000-000000000025',
    image_url:
      'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=800&q=80',
    alt_text: 'Dumbara Handloom Artisan Tote Bag - Woven Geometric',
    display_order: 1,
    is_primary: true,
  },
];

let imageCounter = 1;
const productImages = fashionImages.map((img) => {
  const idHex = imageCounter.toString(16).padStart(12, '0');
  imageCounter += 1;
  return {
    id: `e0000000-0000-0000-0000-${idHex}`,
    product_id: img.product_id,
    image_url: img.image_url,
    alt_text: img.alt_text,
    display_order: img.display_order,
    is_primary: img.is_primary,
    created_at: new Date(),
    updated_at: new Date(),
  };
});

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.bulkInsert('product_images', productImages, {});
  },

  down: async (queryInterface) => {
    const ids = productImages.map((img) => img.id);
    await queryInterface.bulkDelete('product_images', { id: ids }, {});
  },

  productImages,
};
