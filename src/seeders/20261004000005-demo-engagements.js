const reviews = [
  {
    id: 'f0000000-0000-0000-0000-000000000001',
    user_id: 'b0000000-0000-0000-0000-000000000003', // Pabasara
    product_id: 'c0000000-0000-0000-0000-000000000001', // Classic Batik Shirt
    rating: 5,
    review_text:
      'Superb quality batik shirt! The ocean blue dye pattern is distinct and the breathable cotton is ideal for coastal weather in Matara.',
    is_verified_purchase: true,
    created_at: new Date(),
    updated_at: new Date(),
  },
  {
    id: 'f0000000-0000-0000-0000-000000000002',
    user_id: 'b0000000-0000-0000-0000-000000000004', // Thanoogithan
    product_id: 'c0000000-0000-0000-0000-000000000005', // Tailored Charcoal Trousers
    rating: 5,
    review_text:
      'Impeccable executive fit. Clean drape, premium waist lining, and very comfortable for long office hours in Colombo.',
    is_verified_purchase: true,
    created_at: new Date(),
    updated_at: new Date(),
  },
  {
    id: 'f0000000-0000-0000-0000-000000000003',
    user_id: 'b0000000-0000-0000-0000-000000000005', // Lakshani
    product_id: 'c0000000-0000-0000-0000-000000000013', // Royal Kandyan Sari
    rating: 5,
    review_text:
      'Breathtaking heirloom Osariya! The gold embroidery and silk weight are authentic Kandyan tradition. Received so many compliments.',
    is_verified_purchase: true,
    created_at: new Date(),
    updated_at: new Date(),
  },
  {
    id: 'f0000000-0000-0000-0000-000000000004',
    user_id: 'b0000000-0000-0000-0000-000000000006', // Ruwan
    product_id: 'c0000000-0000-0000-0000-000000000011', // Pure White Linen Shirt
    rating: 4,
    review_text:
      'Crisp, breezy French flax linen. Mother of pearl buttons look very high end. Fit is relaxed and true to size.',
    is_verified_purchase: true,
    created_at: new Date(),
    updated_at: new Date(),
  },
  {
    id: 'f0000000-0000-0000-0000-000000000005',
    user_id: 'b0000000-0000-0000-0000-000000000007', // Kamal
    product_id: 'c0000000-0000-0000-0000-000000000008', // Dickwella Coastal Polo
    rating: 5,
    review_text:
      'Heavyweight cotton polo that holds its structure after washing. Local Dickwella styling at its best.',
    is_verified_purchase: true,
    created_at: new Date(),
    updated_at: new Date(),
  },
  {
    id: 'f0000000-0000-0000-0000-000000000006',
    user_id: 'b0000000-0000-0000-0000-000000000005', // Lakshani
    product_id: 'c0000000-0000-0000-0000-000000000016', // Coastal Breeze Linen Midi Dress
    rating: 5,
    review_text:
      'The tiered skirt moves gracefully and the powder blue color is stunning. Pockets are a huge bonus!',
    is_verified_purchase: true,
    created_at: new Date(),
    updated_at: new Date(),
  },
  {
    id: 'f0000000-0000-0000-0000-000000000007',
    user_id: 'b0000000-0000-0000-0000-000000000003', // Pabasara
    product_id: 'c0000000-0000-0000-0000-000000000025', // Dumbara Tote Bag
    rating: 5,
    review_text:
      'Authentic Dumbara craft weaving. Sturdy straps and plenty of room. Very proud to wear Sri Lankan artisan craft.',
    is_verified_purchase: true,
    created_at: new Date(),
    updated_at: new Date(),
  },
];

module.exports = {
  up: async (queryInterface) => {
    const dbReviews = reviews.map((r) => ({
      id: r.id,
      user_id: r.user_id,
      product_id: r.product_id,
      rating: r.rating,
      title: r.title || 'Verified Customer Review',
      comment: r.comment || r.review_text,
      is_verified_purchase: r.is_verified_purchase ?? true,
      created_at: r.created_at || new Date(),
      updated_at: r.updated_at || new Date(),
    }));

    await queryInterface.bulkInsert('reviews', dbReviews, {});
  },

  down: async (queryInterface) => {
    const ids = reviews.map((r) => r.id);
    await queryInterface.bulkDelete('reviews', { id: ids }, {});
  },

  reviews,
};
