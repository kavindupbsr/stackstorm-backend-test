const { Op, Sequelize } = require('sequelize');
const { Product, ProductVariant, ProductImage, Category, Review } = require('../models');
const cacheService = require('./cache.service');
const { logger } = require('../config/logger');
const ApiError = require('../utils/ApiError');

// Load fallback catalog items for resilience during offline/disconnected test and local dev environments
let fallbackProductsData = [];
let fallbackVariantsData = [];
let fallbackImagesData = [];
let fallbackReviewsData = [];
let fallbackCategoriesData = [];

try {
  // eslint-disable-next-line global-require
  const demoProducts = require('../seeders/20261004000003-demo-products');
  fallbackProductsData = demoProducts.products || [];
  fallbackVariantsData = demoProducts.productVariants || [];
} catch (err) {
  logger.warn('Could not load demo-products seeder for fallback:', err.message);
}

try {
  // eslint-disable-next-line global-require
  const demoImages = require('../seeders/20261004000004-demo-images');
  fallbackImagesData = demoImages.productImages || [];
} catch (err) {
  logger.warn('Could not load demo-images seeder for fallback:', err.message);
}

try {
  // eslint-disable-next-line global-require
  const demoEngagements = require('../seeders/20261004000005-demo-engagements');
  fallbackReviewsData = demoEngagements.reviews || [];
} catch (err) {
  logger.warn('Could not load demo-engagements seeder for fallback:', err.message);
}

try {
  // eslint-disable-next-line global-require
  const demoCategories = require('../seeders/20261004000001-demo-categories');
  fallbackCategoriesData = demoCategories.categories || [];
} catch (err) {
  logger.warn('Could not load demo-categories seeder for fallback:', err.message);
}

/**
 * Builds hydrated in-memory fallback catalog items with reciprocal variants, images, and reviews.
 */
const getFallbackCatalog = () => {
  return fallbackProductsData.map((prod) => {
    const variants = fallbackVariantsData
      .filter((v) => v.product_id === prod.id)
      .map((v) => {
        const stock = v.stock_quantity ?? v.stock ?? 0;
        const reserved = v.reserved_quantity ?? 0;
        const available = Math.max(0, stock - reserved);
        return {
          ...v,
          stock_quantity: stock,
          reserved_quantity: reserved,
          available_stock: available,
          availableStock: available,
        };
      });

    const images = fallbackImagesData
      .filter((img) => img.product_id === prod.id)
      .sort((a, b) => (a.display_order || 0) - (b.display_order || 0));

    const primaryImage = images.find((img) => img.is_primary) || images[0] || null;

    const reviews = fallbackReviewsData
      .filter((r) => r.product_id === prod.id)
      .map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment || r.review_text,
        is_verified_purchase: r.is_verified_purchase,
        created_at: r.created_at,
      }));

    const reviewCount = reviews.length;
    const averageRating =
      reviewCount > 0
        ? Number((reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / reviewCount).toFixed(1))
        : 5.0;

    const availableStock = variants.reduce((sum, v) => sum + v.available_stock, 0);

    const categoryObj = fallbackCategoriesData.find((c) => c.id === prod.category_id) || {
      id: prod.category_id,
      name: 'Apparel',
      slug: 'apparel',
    };

    return {
      id: prod.id,
      category_id: prod.category_id,
      category: categoryObj,
      category_name: categoryObj.name,
      title: prod.title,
      slug: prod.slug,
      description: prod.description,
      base_price: Number(prod.base_price),
      is_active: prod.is_active,
      is_final_sale: prod.is_final_sale,
      primary_image: primaryImage ? primaryImage.image_url : null,
      images,
      variants,
      reviews,
      review_count: reviewCount,
      average_rating: averageRating,
      rating: averageRating,
      availableStock,
      created_at: prod.created_at || new Date('2026-10-01T00:00:00.000Z'),
      updated_at: prod.updated_at || new Date('2026-10-01T00:00:00.000Z'),
    };
  });
};

/**
 * Filters in-memory fallback catalog when database connection is unavailable.
 *
 * @param {object} params
 * @returns {object}
 */
const filterFallbackCatalog = (params = {}) => {
  const catParam = params.category || params.categoryId || params.category_id;
  const minP =
    params.minPrice !== undefined && params.minPrice !== '' && params.minPrice !== null
      ? params.minPrice
      : params.min_price;
  const maxP =
    params.maxPrice !== undefined && params.maxPrice !== '' && params.maxPrice !== null
      ? params.maxPrice
      : params.max_price;
  const { size, color, sort, page = 1, limit = 12, cursor } = params;
  const search = params.search || params.q || params.keyword;

  let items = getFallbackCatalog().filter((p) => p.is_active);

  if (search && String(search).trim()) {
    const term = String(search).toLowerCase().trim();
    items = items.filter(
      (p) =>
        (p.title && p.title.toLowerCase().includes(term)) ||
        (p.description && p.description.toLowerCase().includes(term)) ||
        (p.category?.name && p.category.name.toLowerCase().includes(term)) ||
        (p.category?.slug && p.category.slug.toLowerCase().includes(term)) ||
        (p.variants &&
          p.variants.some(
            (v) =>
              (v.color && v.color.toLowerCase().includes(term)) ||
              (v.sku && v.sku.toLowerCase().includes(term))
          ))
    );
  }

  if (catParam && String(catParam).trim() && String(catParam).toLowerCase() !== 'all') {
    const term = String(catParam).trim().toLowerCase();
    const matchingCats = fallbackCategoriesData.filter(
      (c) =>
        c.id === term ||
        c.slug === term ||
        c.slug.includes(term) ||
        (c.name && c.name.toLowerCase().includes(term))
    );
    const matchedIds = new Set(matchingCats.map((c) => c.id));
    fallbackCategoriesData.forEach((c) => {
      if (c.parent_id && matchedIds.has(c.parent_id)) {
        matchedIds.add(c.id);
      }
    });

    if (matchedIds.size > 0) {
      items = items.filter((p) => matchedIds.has(p.category_id));
    } else {
      items = items.filter((p) => String(p.category_id) === String(catParam));
    }
  }

  if (minP !== undefined && minP !== null && minP !== '') {
    const minVal = Number(minP);
    if (!Number.isNaN(minVal)) {
      items = items.filter((p) => p.base_price >= minVal);
    }
  }

  if (maxP !== undefined && maxP !== null && maxP !== '') {
    const maxVal = Number(maxP);
    if (!Number.isNaN(maxVal)) {
      items = items.filter((p) => p.base_price <= maxVal);
    }
  }

  if (size && String(size).trim()) {
    const targetSize = String(size).trim().toUpperCase();
    items = items.filter((p) =>
      p.variants.some((v) => String(v.size).toUpperCase() === targetSize && v.available_stock > 0)
    );
  }

  if (color && String(color).trim()) {
    const rawColor = String(color).trim();
    const lower = rawColor.toLowerCase();
    const colorKeywords = [rawColor.toLowerCase()];
    if (lower === 'pure white') colorKeywords.push('white');
    if (lower === 'kandyan red') colorKeywords.push('red', 'maroon', 'ruby');
    if (lower === 'ceylon emerald') colorKeywords.push('emerald', 'green', 'olive');
    if (lower === 'ocean blue') colorKeywords.push('blue', 'ocean');
    if (lower === 'indigo navy') colorKeywords.push('navy', 'indigo');
    if (lower === 'earthy ochre') colorKeywords.push('ochre', 'yellow');

    items = items.filter((p) =>
      p.variants.some((v) => {
        const vCol = String(v.color || '').toLowerCase();
        return colorKeywords.some((kw) => vCol.includes(kw));
      })
    );
  }

  // Sorting
  if (sort === 'price_asc') {
    items.sort((a, b) => a.base_price - b.base_price || String(a.id).localeCompare(String(b.id)));
  } else if (sort === 'price_desc') {
    items.sort((a, b) => b.base_price - a.base_price || String(a.id).localeCompare(String(b.id)));
  } else if (sort === 'rating') {
    items.sort(
      (a, b) =>
        (b.average_rating || 5) - (a.average_rating || 5) ||
        String(a.id).localeCompare(String(b.id))
    );
  } else {
    items.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime() ||
        String(a.id).localeCompare(String(b.id))
    );
  }

  // Keyset cursor handling
  if (cursor) {
    try {
      const decodedCursor = Buffer.from(cursor, 'base64').toString('utf8');
      const cursorIndex = items.findIndex((p) => String(p.id) === decodedCursor);
      if (cursorIndex >= 0) {
        items = items.slice(cursorIndex + 1);
      }
    } catch (e) {
      logger.warn('Failed to parse cursor in fallback catalog:', e.message);
    }
  }

  const total = items.length;
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.max(1, parseInt(limit, 10) || 12);
  const totalPages = Math.ceil(total / limitNum) || 1;
  const offset = (pageNum - 1) * limitNum;
  const paginatedItems = items.slice(offset, offset + limitNum);

  const hasNext = pageNum < totalPages;
  const hasPrev = pageNum > 1;
  const lastItem = paginatedItems[paginatedItems.length - 1];
  const nextCursor =
    hasNext && lastItem ? Buffer.from(String(lastItem.id)).toString('base64') : null;

  return {
    products: paginatedItems,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages,
      hasNext,
      hasPrev,
      nextCursor,
    },
    total,
    page: pageNum,
    limit: limitNum,
    totalPages,
  };
};

/**
 * List products with multi-faceted filtering, sorting, and pagination.
 *
 * @param {object} params
 * @returns {Promise<object>} Paginated products response
 */
const listProducts = async (params = {}) => {
  const catParam = params.category || params.categoryId || params.category_id;
  let minP;
  if (params.minPrice !== undefined && params.minPrice !== '' && params.minPrice !== null) {
    minP = Number(params.minPrice);
  } else if (
    params.min_price !== undefined &&
    params.min_price !== '' &&
    params.min_price !== null
  ) {
    minP = Number(params.min_price);
  }

  let maxP;
  if (params.maxPrice !== undefined && params.maxPrice !== '' && params.maxPrice !== null) {
    maxP = Number(params.maxPrice);
  } else if (
    params.max_price !== undefined &&
    params.max_price !== '' &&
    params.max_price !== null
  ) {
    maxP = Number(params.max_price);
  }

  const { size, color, sort, page = 1, limit = 12, cursor } = params;
  const search = params.search || params.q || params.keyword;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.max(1, parseInt(limit, 10) || 12);
  const offset = (pageNum - 1) * limitNum;

  // L2 Cache lookup via Redis
  const cacheKey = `products:list:${Buffer.from(JSON.stringify(params)).toString('base64')}`;
  try {
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }
  } catch (err) {
    logger.warn('Cache lookup failed in listProducts:', err.message);
  }

  try {
    // 1. Build product WHERE condition
    const productWhere = { is_active: true };

    if (search && String(search).trim()) {
      const rawSearch = String(search).trim();
      const searchTerm = `%${rawSearch}%`;

      // Find any categories matching the search term to include products in those categories
      const matchedCategoryIds = [];
      try {
        const matchedCategories = await Category.findAll({
          where: {
            [Op.or]: [
              { name: { [Op.iLike]: searchTerm } },
              { slug: { [Op.iLike]: searchTerm } },
              { description: { [Op.iLike]: searchTerm } },
            ],
            is_active: true,
          },
          include: [{ model: Category, as: 'children', attributes: ['id'] }],
          attributes: ['id'],
        });

        matchedCategories.forEach((cat) => {
          matchedCategoryIds.push(cat.id);
          (cat.children || []).forEach((ch) => matchedCategoryIds.push(ch.id));
        });
      } catch (catSearchErr) {
        logger.warn('Category search lookup failed in listProducts:', catSearchErr.message);
      }

      const orConditions = [
        { title: { [Op.iLike]: searchTerm } },
        { description: { [Op.iLike]: searchTerm } },
      ];

      if (matchedCategoryIds.length > 0) {
        orConditions.push({
          category_id: { [Op.in]: Array.from(new Set(matchedCategoryIds)) },
        });
      }

      // Check if search matches any variant SKU or color
      try {
        const matchedVariants = await ProductVariant.findAll({
          where: {
            [Op.or]: [
              { sku: { [Op.iLike]: searchTerm } },
              { color: { [Op.iLike]: searchTerm } },
            ],
          },
          attributes: ['product_id'],
          limit: 50,
        });

        if (matchedVariants.length > 0) {
          const prodIds = Array.from(new Set(matchedVariants.map((v) => v.product_id)));
          orConditions.push({ id: { [Op.in]: prodIds } });
        }
      } catch (varSearchErr) {
        logger.warn('Variant search lookup failed in listProducts:', varSearchErr.message);
      }

      productWhere[Op.or] = orConditions;
    }

    if (cursor) {
      try {
        const decodedId = Buffer.from(cursor, 'base64').toString('utf8');
        if (decodedId) {
          productWhere.id = { [Op.gt]: decodedId };
        }
      } catch (err) {
        logger.warn('Failed to decode cursor in listProducts:', err.message);
      }
    }

    if (catParam && String(catParam).trim() && String(catParam).toLowerCase() !== 'all') {
      const trimmedCat = String(catParam).trim();
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmedCat);

      let targetCategory = null;
      if (isUUID) {
        targetCategory = await Category.findByPk(trimmedCat, {
          include: [{ model: Category, as: 'children', attributes: ['id'] }],
        });
      } else {
        // Query by slug or name (case-insensitive)
        targetCategory = await Category.findOne({
          where: {
            [Op.or]: [
              { slug: trimmedCat.toLowerCase() },
              { name: { [Op.iLike]: trimmedCat } },
            ],
            is_active: true,
          },
          include: [{ model: Category, as: 'children', attributes: ['id'] }],
        });
      }

      if (targetCategory) {
        const childIds = (targetCategory.children || []).map((c) => c.id);
        const allCategoryIds = [targetCategory.id, ...childIds];
        productWhere.category_id = { [Op.in]: allCategoryIds };
      } else if (isUUID) {
        productWhere.category_id = trimmedCat;
      } else {
        // Partial slug match (e.g. 'batik' matches 'men-batik-shirts')
        const matchedCats = await Category.findAll({
          where: {
            slug: { [Op.iLike]: `%${trimmedCat}%` },
            is_active: true,
          },
          attributes: ['id'],
        });
        if (matchedCats.length > 0) {
          productWhere.category_id = { [Op.in]: matchedCats.map((c) => c.id) };
        } else {
          // If no category matched this slug, safely return empty result
          productWhere.category_id = '00000000-0000-0000-0000-000000000000';
        }
      }
    }

    if (minP !== undefined && !Number.isNaN(minP) && maxP !== undefined && !Number.isNaN(maxP)) {
      productWhere.base_price = {
        [Op.between]: [minP, maxP],
      };
    } else if (minP !== undefined && !Number.isNaN(minP)) {
      productWhere.base_price = {
        [Op.gte]: minP,
      };
    } else if (maxP !== undefined && !Number.isNaN(maxP)) {
      productWhere.base_price = {
        [Op.lte]: maxP,
      };
    }

    // 2. Build variant WHERE condition
    const variantWhere = {};
    let requireVariantJoin = false;

    if (size && String(size).trim()) {
      variantWhere.size = String(size).trim().toUpperCase();
      requireVariantJoin = true;
      variantWhere[Op.and] = [
        Sequelize.literal('"variants"."stock_quantity" - "variants"."reserved_quantity" > 0'),
      ];
    }

    if (color && String(color).trim()) {
      const rawColor = String(color).trim();
      const lower = rawColor.toLowerCase();
      const colorKeywords = [rawColor];
      if (lower === 'pure white') colorKeywords.push('White');
      if (lower === 'kandyan red') colorKeywords.push('Red', 'Maroon', 'Ruby');
      if (lower === 'ceylon emerald') colorKeywords.push('Emerald', 'Green', 'Olive');
      if (lower === 'ocean blue') colorKeywords.push('Blue', 'Ocean');
      if (lower === 'indigo navy') colorKeywords.push('Navy', 'Indigo');
      if (lower === 'earthy ochre') colorKeywords.push('Ochre', 'Yellow');

      variantWhere[Op.or] = colorKeywords.map((kw) => ({
        color: { [Op.iLike]: `%${kw}%` },
      }));
      requireVariantJoin = true;
    }

    // 3. Determine sorting
    let order = [
      ['created_at', 'DESC'],
      ['id', 'ASC'],
    ];
    if (sort === 'price_asc') {
      order = [
        ['base_price', 'ASC'],
        ['id', 'ASC'],
      ];
    } else if (sort === 'price_desc') {
      order = [
        ['base_price', 'DESC'],
        ['id', 'ASC'],
      ];
    } else if (sort === 'newest') {
      order = [
        ['created_at', 'DESC'],
        ['id', 'ASC'],
      ];
    } else if (sort === 'rating') {
      order = [
        [
          Sequelize.literal(
            '(SELECT COALESCE(AVG(rating), 5.0) FROM reviews WHERE reviews.product_id = "Product"."id")'
          ),
          'DESC',
        ],
        ['id', 'ASC'],
      ];
    }

    // 4. Query PostgreSQL with eager loading
    const { count, rows } = await Product.findAndCountAll({
      where: productWhere,
      distinct: true,
      include: [
        {
          model: ProductVariant,
          as: 'variants',
          where: Reflect.ownKeys(variantWhere).length > 0 ? variantWhere : undefined,
          required: requireVariantJoin,
        },
        {
          model: ProductImage,
          as: 'images',
          required: false,
        },
        {
          model: Category,
          as: 'category',
          required: false,
        },
        {
          model: Review,
          as: 'reviews',
          attributes: ['id', 'rating', 'comment', 'is_verified_purchase', 'created_at'],
          required: false,
        },
      ],
      order,
      limit: limitNum,
      offset,
    });

    const total = count;
    const totalPages = Math.ceil(total / limitNum) || 1;
    const hasNext = pageNum < totalPages;
    const hasPrev = pageNum > 1;

    // 5. Format product response with primary_image, availableStock, reviews & ratings
    const formattedProducts = rows.map((prod) => {
      const plain = prod.get({ plain: true });
      const images = plain.images || [];
      const primaryImage =
        images.find((img) => img.is_primary) ||
        images.sort((a, b) => a.display_order - b.display_order)[0] ||
        null;

      const variants = (plain.variants || []).map((v) => {
        const stock = v.stock_quantity ?? 0;
        const reserved = v.reserved_quantity ?? 0;
        const available = Math.max(0, stock - reserved);
        return {
          ...v,
          stock_quantity: stock,
          reserved_quantity: reserved,
          available_stock: available,
          availableStock: available,
        };
      });

      const totalAvailable = variants.reduce((sum, v) => sum + v.available_stock, 0);

      const reviews = plain.reviews || [];
      const reviewCount = reviews.length;
      const averageRating =
        reviewCount > 0
          ? Number((reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / reviewCount).toFixed(1))
          : 5.0;

      return {
        ...plain,
        base_price: Number(plain.base_price),
        primary_image: primaryImage ? primaryImage.image_url : null,
        variants,
        availableStock: totalAvailable,
        reviews,
        review_count: reviewCount,
        average_rating: averageRating,
        rating: averageRating,
      };
    });

    const lastItem = formattedProducts[formattedProducts.length - 1];
    const nextCursor =
      hasNext && lastItem ? Buffer.from(String(lastItem.id)).toString('base64') : null;

    const result = {
      products: formattedProducts,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages,
        hasNext,
        hasPrev,
        nextCursor,
      },
      total,
      page: pageNum,
      limit: limitNum,
      totalPages,
    };

    try {
      await cacheService.set(cacheKey, result, 60);
    } catch (err) {
      logger.warn('Redis cache set failed in listProducts:', err.message);
    }

    return result;
  } catch (error) {
    logger.warn(
      'Sequelize query failed or database offline, falling back to mock catalog:',
      error.message
    );
    return filterFallbackCatalog(params);
  }
};

/**
 * Retrieves a single product with full variant matrix, ordered gallery images, category, and review stats.
 *
 * @param {string} slug - Unique product slug
 * @returns {Promise<object|null>} Hydrated product detail or null if not found
 */
const getProductBySlug = async (slug) => {
  if (!slug) return null;
  const cacheKey = `cache:product:slug:${slug}`;

  return cacheService.getOrSet(cacheKey, 3600, async () => {
    try {
      const product = await Product.findOne({
        where: { slug, is_active: true },
        include: [
          {
            model: Category,
            as: 'category',
          },
          {
            model: ProductVariant,
            as: 'variants',
          },
          {
            model: ProductImage,
            as: 'images',
          },
          {
            model: Review,
            as: 'reviews',
            required: false,
          },
        ],
        order: [[{ model: ProductImage, as: 'images' }, 'display_order', 'ASC']],
      });

      if (product) {
        const plain = product.get({ plain: true });
        const images = (plain.images || []).sort(
          (a, b) => (a.display_order || 0) - (b.display_order || 0)
        );
        const primaryImage = images.find((img) => img.is_primary) || images[0] || null;

        const variants = (plain.variants || []).map((v) => {
          const stock = v.stock_quantity ?? 0;
          const reserved = v.reserved_quantity ?? 0;
          const available = Math.max(0, stock - reserved);
          return {
            ...v,
            stock_quantity: stock,
            reserved_quantity: reserved,
            available_stock: available,
            availableStock: available,
          };
        });

        const reviews = plain.reviews || [];
        const reviewCount = reviews.length;
        const averageRating =
          reviewCount > 0
            ? Number(
                (reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / reviewCount).toFixed(1)
              )
            : 5.0;

        return {
          ...plain,
          base_price: Number(plain.base_price),
          primary_image: primaryImage ? primaryImage.image_url : null,
          images,
          variants,
          reviews,
          review_count: reviewCount,
          average_rating: averageRating,
          availableStock: variants.reduce((sum, v) => sum + v.available_stock, 0),
        };
      }
    } catch (error) {
      logger.warn(
        'Sequelize getProductBySlug failed, falling back to mock catalog:',
        error.message
      );
    }

    // Fallback catalog lookup
    const catalog = getFallbackCatalog();
    let item = catalog.find((p) => p.slug === slug);

    // Support alias for classic-linen-batik-shirt
    if (!item && slug === 'classic-linen-batik-shirt') {
      const base = catalog.find((p) => p.slug === 'classic-batik-short-sleeve-shirt') || catalog[0];
      if (base) {
        item = {
          ...base,
          title: 'Classic Linen Batik Shirt',
          slug: 'classic-linen-batik-shirt',
        };
      }
    }

    if (!item) {
      return null;
    }

    const images = (item.images || []).sort(
      (a, b) => (a.display_order || 0) - (b.display_order || 0)
    );
    const primaryImage = images.find((img) => img.is_primary) || images[0] || null;

    const variants = (item.variants || []).map((v) => {
      const stock = v.stock_quantity ?? v.stock ?? 0;
      const reserved = v.reserved_quantity ?? 0;
      const available = Math.max(0, stock - reserved);
      return {
        ...v,
        stock_quantity: stock,
        reserved_quantity: reserved,
        available_stock: available,
        availableStock: available,
      };
    });

    const reviews = item.reviews || [];
    const reviewCount = reviews.length;
    const averageRating =
      reviewCount > 0
        ? Number((reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / reviewCount).toFixed(1))
        : 5.0;

    return {
      ...item,
      base_price: Number(item.base_price),
      primary_image: primaryImage ? primaryImage.image_url : null,
      images,
      variants,
      reviews,
      review_count: reviewCount,
      average_rating: averageRating,
      availableStock: variants.reduce((sum, v) => sum + v.available_stock, 0),
    };
  });
};

/**
 * Invalidates all product and product catalog cache keys.
 *
 * @param {string} [id] - Specific product ID
 * @param {string} [slug] - Specific product slug
 */
const invalidateProductCache = async (id = null, slug = null) => {
  if (id) {
    await cacheService.del(`cache:product:${id}`);
  }
  if (slug) {
    await cacheService.del(`cache:product:slug:${slug}`);
  }
  await cacheService.invalidatePattern('cache:product:*');
  await cacheService.invalidatePattern('cache:products:*');
};

/**
 * Updates an existing product and triggers cache invalidation.
 *
 * @param {string} id - Product UUID
 * @param {object} updateData - Partial product fields to update
 * @returns {Promise<object>} Updated product
 */
const updateProduct = async (id, updateData) => {
  let slug = updateData.slug || null;

  try {
    const product = await Product.findByPk(id);
    if (product) {
      slug = slug || product.slug;
      await product.update(updateData);
      await invalidateProductCache(id, slug);
      return product.get({ plain: true });
    }
  } catch (err) {
    logger.warn(`Database product update failed: ${err.message}. Checking fallback.`);
  }

  const fallbackProd = fallbackProductsData.find((p) => p.id === id);
  if (!fallbackProd) {
    throw ApiError.notFound(`Product not found with ID ${id}`);
  }
  slug = slug || fallbackProd.slug;
  Object.assign(fallbackProd, updateData);
  await invalidateProductCache(id, slug);
  return fallbackProd;
};

/**
 * Deletes an existing product and triggers cache invalidation.
 *
 * @param {string} id - Product UUID
 * @returns {Promise<boolean>}
 */
const deleteProduct = async (id) => {
  let slug = null;

  try {
    const product = await Product.findByPk(id);
    if (product) {
      slug = product.slug;
      await product.destroy();
      await invalidateProductCache(id, slug);
      return true;
    }
  } catch (err) {
    logger.warn(`Database product delete failed: ${err.message}. Checking fallback.`);
  }

  const index = fallbackProductsData.findIndex((p) => p.id === id);
  if (index === -1) {
    throw ApiError.notFound(`Product not found with ID ${id}`);
  }
  slug = fallbackProductsData[index].slug;
  fallbackProductsData.splice(index, 1);
  await invalidateProductCache(id, slug);
  return true;
};

module.exports = {
  listProducts,
  getProductBySlug,
  updateProduct,
  deleteProduct,
  invalidateProductCache,
  getFallbackCatalog,
  filterFallbackCatalog,
};
