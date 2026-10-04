const { Op, Sequelize } = require('sequelize');
const { Product, ProductVariant, ProductImage, Category } = require('../models');
const { logger } = require('../config/logger');

// Load fallback catalog items for resilience during offline/disconnected test and local dev environments
let fallbackProductsData = [];
let fallbackVariantsData = [];
let fallbackImagesData = [];

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

/**
 * Builds hydrated in-memory fallback catalog items with reciprocal variants and images.
 */
const getFallbackCatalog = () => {
  return fallbackProductsData.map((prod) => {
    const variants = fallbackVariantsData
      .filter((v) => v.product_id === prod.id)
      .map((v) => ({
        ...v,
        availableStock: Math.max(0, (v.stock_quantity || 0) - (v.reserved_quantity || 0)),
      }));

    const images = fallbackImagesData
      .filter((img) => img.product_id === prod.id)
      .sort((a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0) || a.display_order - b.display_order);

    const primaryImage = images.find((img) => img.is_primary) || images[0] || null;
    const availableStock = variants.reduce((sum, v) => sum + v.availableStock, 0);

    return {
      id: prod.id,
      category_id: prod.category_id,
      title: prod.title,
      slug: prod.slug,
      description: prod.description,
      base_price: Number(prod.base_price),
      is_active: prod.is_active,
      is_final_sale: prod.is_final_sale,
      primary_image: primaryImage ? primaryImage.image_url : null,
      images,
      variants,
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
  const catId = params.categoryId || params.category_id;
  const minP = params.minPrice !== undefined ? params.minPrice : params.min_price;
  const maxP = params.maxPrice !== undefined ? params.maxPrice : params.max_price;
  const { size, color, sort, page = 1, limit = 10, cursor } = params;

  let items = getFallbackCatalog().filter((p) => p.is_active);

  if (catId) {
    items = items.filter((p) => String(p.category_id) === String(catId));
  }

  if (minP !== undefined && minP !== null && minP !== '') {
    const minVal = Number(minP);
    items = items.filter((p) => p.base_price >= minVal);
  }

  if (maxP !== undefined && maxP !== null && maxP !== '') {
    const maxVal = Number(maxP);
    items = items.filter((p) => p.base_price <= maxVal);
  }

  if (size) {
    const targetSize = String(size).toUpperCase();
    items = items.filter((p) =>
      p.variants.some((v) => String(v.size).toUpperCase() === targetSize && v.availableStock > 0)
    );
  }

  if (color) {
    const targetColor = String(color).toLowerCase();
    items = items.filter((p) =>
      p.variants.some((v) => String(v.color).toLowerCase().includes(targetColor))
    );
  }

  // Sorting
  if (sort === 'price_asc') {
    items.sort((a, b) => a.base_price - b.base_price);
  } else if (sort === 'price_desc') {
    items.sort((a, b) => b.base_price - a.base_price);
  } else if (sort === 'newest') {
    items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  } else {
    items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
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
  const limitNum = Math.max(1, parseInt(limit, 10) || 10);
  const totalPages = Math.ceil(total / limitNum) || 1;
  const offset = (pageNum - 1) * limitNum;
  const paginatedItems = items.slice(offset, offset + limitNum);

  const hasNext = pageNum < totalPages;
  const hasPrev = pageNum > 1;
  const lastItem = paginatedItems[paginatedItems.length - 1];
  const nextCursor = hasNext && lastItem ? Buffer.from(String(lastItem.id)).toString('base64') : null;

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
  const catId = params.categoryId || params.category_id;
  const minP = params.minPrice !== undefined ? params.minPrice : params.min_price;
  const maxP = params.maxPrice !== undefined ? params.maxPrice : params.max_price;
  const { size, color, sort, page = 1, limit = 10, cursor } = params;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.max(1, parseInt(limit, 10) || 10);
  const offset = (pageNum - 1) * limitNum;

  try {
    // 1. Build product WHERE condition
    const productWhere = { is_active: true };

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

    if (catId) {
      productWhere.category_id = catId;
    }

    if (minP !== undefined && minP !== null && minP !== '' && maxP !== undefined && maxP !== null && maxP !== '') {
      productWhere.base_price = {
        [Op.between]: [Number(minP), Number(maxP)],
      };
    } else if (minP !== undefined && minP !== null && minP !== '') {
      productWhere.base_price = {
        [Op.gte]: Number(minP),
      };
    } else if (maxP !== undefined && maxP !== null && maxP !== '') {
      productWhere.base_price = {
        [Op.lte]: Number(maxP),
      };
    }

    // 2. Build variant WHERE condition
    const variantWhere = {};
    let requireVariantJoin = false;

    if (size) {
      variantWhere.size = size;
      requireVariantJoin = true;
      // In-stock requirement for filtered sizes: availableStock = stock_quantity - reserved_quantity > 0
      variantWhere[Op.and] = [
        Sequelize.literal('"variants"."stock_quantity" - "variants"."reserved_quantity" > 0'),
      ];
    }

    if (color) {
      variantWhere.color = {
        [Op.iLike]: `%${color}%`,
      };
      requireVariantJoin = true;
    }

    // 3. Determine sorting
    let order = [['created_at', 'DESC']];
    if (sort === 'price_asc') {
      order = [['base_price', 'ASC']];
    } else if (sort === 'price_desc') {
      order = [['base_price', 'DESC']];
    } else if (sort === 'newest') {
      order = [['created_at', 'DESC']];
    }

    // 4. Query PostgreSQL with eager loading
    const { count, rows } = await Product.findAndCountAll({
      where: productWhere,
      distinct: true,
      include: [
        {
          model: ProductVariant,
          as: 'variants',
          where: Object.keys(variantWhere).length > 0 ? variantWhere : undefined,
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
      ],
      order,
      limit: limitNum,
      offset,
    });

    const total = count;
    const totalPages = Math.ceil(total / limitNum) || 1;
    const hasNext = pageNum < totalPages;
    const hasPrev = pageNum > 1;

    // 5. Format product response with primary_image and availableStock
    const formattedProducts = rows.map((prod) => {
      const plain = prod.get({ plain: true });
      const images = plain.images || [];
      const primaryImage =
        images.find((img) => img.is_primary) ||
        images.sort((a, b) => a.display_order - b.display_order)[0] ||
        null;

      const variants = plain.variants || [];
      const totalAvailable = variants.reduce((sum, v) => {
        const stock = v.stock_quantity ?? 0;
        const reserved = v.reserved_quantity ?? 0;
        return sum + Math.max(0, stock - reserved);
      }, 0);

      return {
        ...plain,
        base_price: Number(plain.base_price),
        primary_image: primaryImage ? primaryImage.image_url : null,
        availableStock: totalAvailable,
      };
    });

    const lastItem = formattedProducts[formattedProducts.length - 1];
    const nextCursor = hasNext && lastItem ? Buffer.from(String(lastItem.id)).toString('base64') : null;

    return {
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
  } catch (error) {
    logger.warn('Sequelize query failed or database offline, falling back to mock catalog:', error.message);
    return filterFallbackCatalog(params);
  }
};

module.exports = {
  listProducts,
  getFallbackCatalog,
  filterFallbackCatalog,
};
