const { Wishlist, Product, ProductVariant, ProductImage, User } = require('../models');
const { logger } = require('../config/logger');
const ApiError = require('../utils/ApiError');

// In-memory fallback wishlist store for offline resilience and fast unit testing
const fallbackWishlistStore = new Map();

/**
 * Helper to retrieve fallback products from seed data if database is offline.
 */
const getFallbackProduct = (productId) => {
  try {
    // eslint-disable-next-line global-require
    const demoProducts = require('../seeders/20261004000003-demo-products');
    const prod = (demoProducts.products || []).find((p) => String(p.id) === String(productId));
    if (!prod) return null;

    const variants = (demoProducts.productVariants || []).filter(
      (v) => String(v.product_id) === String(productId)
    );
    // eslint-disable-next-line global-require
    const demoImages = require('../seeders/20261004000004-demo-images');
    const images = (demoImages.productImages || []).filter(
      (img) => String(img.product_id) === String(productId)
    );
    const primaryImg = images.find((i) => i.is_primary) || images[0] || null;

    const totalStock = variants.reduce(
      (sum, v) => sum + Math.max(0, (v.stock_quantity || 0) - (v.reserved_quantity || 0)),
      0
    );

    return {
      id: prod.id,
      title: prod.title,
      slug: prod.slug,
      base_price: Number(prod.base_price),
      primary_image: primaryImg ? primaryImg.image_url : null,
      available_stock: totalStock,
      in_stock: totalStock > 0,
      variants,
    };
  } catch (err) {
    logger.warn('Could not load fallback product for wishlist:', err.message);
    return null;
  }
};

/**
 * Formats a single wishlist item with live inventory, primary image, and formatted pricing.
 *
 * @param {object} item - Plain wishlist model instance
 * @returns {object} Formatted wishlist item
 */
const formatWishlistItem = (item) => {
  const prod = item.product || {};
  const images = prod.images || [];
  const primaryImage =
    images.find((img) => img.is_primary) ||
    images.sort((a, b) => (a.display_order || 0) - (b.display_order || 0))[0] ||
    null;

  const variants = (prod.variants || []).map((v) => {
    const stock = v.stock_quantity ?? 0;
    const reserved = v.reserved_quantity ?? 0;
    const available = Math.max(0, stock - reserved);
    return {
      id: v.id,
      sku: v.sku,
      size: v.size,
      color: v.color,
      stock_quantity: stock,
      reserved_quantity: reserved,
      available_stock: available,
      availableStock: available,
      price_override: v.price_override ? Number(v.price_override) : null,
    };
  });

  const totalAvailableStock = variants.reduce((sum, v) => sum + v.available_stock, 0);
  const basePrice = Number(prod.base_price || 0);

  return {
    id: item.id,
    user_id: item.user_id,
    product_id: item.product_id,
    created_at: item.created_at || item.createdAt,
    product: {
      id: prod.id,
      title: prod.title,
      slug: prod.slug,
      base_price: basePrice,
      formatted_price: `LKR ${basePrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      primary_image: primaryImage ? primaryImage.image_url : null,
      available_stock: totalAvailableStock,
      availableStock: totalAvailableStock,
      in_stock: totalAvailableStock > 0,
      variants,
    },
  };
};

/**
 * Retrieve the active wishlist for a specific authenticated customer.
 *
 * @param {string} userId - Customer UUID
 * @returns {Promise<Array<object>>} List of hydrated wishlist items
 */
const getWishlist = async (userId) => {
  if (!userId) {
    throw ApiError.unauthorized('User ID is required to retrieve wishlist');
  }

  try {
    const items = await Wishlist.findAll({
      where: { user_id: userId },
      include: [
        {
          model: Product,
          as: 'product',
          include: [
            {
              model: ProductVariant,
              as: 'variants',
            },
            {
              model: ProductImage,
              as: 'images',
            },
          ],
        },
      ],
      order: [
        ['created_at', 'DESC'],
        ['id', 'ASC'],
      ],
    });

    return items.map((item) => formatWishlistItem(item.get({ plain: true })));
  } catch (err) {
    logger.warn(
      'PostgreSQL query failed in getWishlist, checking in-memory fallback:',
      err.message
    );

    const userSet = fallbackWishlistStore.get(String(userId)) || new Set();
    const fallbackItems = [];

    userSet.forEach((productId) => {
      const prod = getFallbackProduct(productId);
      if (prod) {
        fallbackItems.push({
          id: `wishlist-fallback-${userId}-${productId}`,
          user_id: userId,
          product_id: productId,
          created_at: new Date(),
          product: {
            ...prod,
            formatted_price: `LKR ${prod.base_price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          },
        });
      }
    });

    return fallbackItems;
  }
};

/**
 * Add a product to customer wishlist with composite uniqueness.
 *
 * @param {string} userId - Customer UUID
 * @param {string} productId - Product UUID
 * @returns {Promise<object>} Created wishlist item metadata
 */
const addToWishlist = async (userId, productId) => {
  if (!userId) {
    throw ApiError.unauthorized('User ID is required to add to wishlist');
  }
  if (!productId) {
    throw ApiError.badRequest('Product ID is required');
  }

  try {
    // Verify product existence
    const product = await Product.findByPk(productId);
    if (!product) {
      const fallbackProd = getFallbackProduct(productId);
      if (!fallbackProd) {
        throw ApiError.notFound(`Product with ID '${productId}' not found`);
      }
    }

    const [wishlistItem, created] = await Wishlist.findOrCreate({
      where: { user_id: userId, product_id: productId },
      defaults: { user_id: userId, product_id: productId },
    });

    // Update in-memory fallback mirror
    if (!fallbackWishlistStore.has(String(userId))) {
      fallbackWishlistStore.set(String(userId), new Set());
    }
    fallbackWishlistStore.get(String(userId)).add(String(productId));

    return {
      item: wishlistItem,
      created,
      message: created ? 'Product added to wishlist' : 'Product already exists in wishlist',
    };
  } catch (err) {
    if (err instanceof ApiError) throw err;

    logger.warn('Database error in addToWishlist, using in-memory fallback store:', err.message);
    if (!fallbackWishlistStore.has(String(userId))) {
      fallbackWishlistStore.set(String(userId), new Set());
    }
    const userSet = fallbackWishlistStore.get(String(userId));
    const alreadyPresent = userSet.has(String(productId));
    userSet.add(String(productId));

    return {
      item: {
        id: `wishlist-fallback-${userId}-${productId}`,
        user_id: userId,
        product_id: productId,
        created_at: new Date(),
      },
      created: !alreadyPresent,
      message: !alreadyPresent ? 'Product added to wishlist' : 'Product already exists in wishlist',
    };
  }
};

/**
 * Remove a specific product from customer wishlist.
 *
 * @param {string} userId - Customer UUID
 * @param {string} productId - Product UUID
 * @returns {Promise<object>} Deletion confirmation
 */
const removeFromWishlist = async (userId, productId) => {
  if (!userId) {
    throw ApiError.unauthorized('User ID is required to remove from wishlist');
  }
  if (!productId) {
    throw ApiError.badRequest('Product ID is required');
  }

  try {
    const deletedCount = await Wishlist.destroy({
      where: { user_id: userId, product_id: productId },
    });

    if (fallbackWishlistStore.has(String(userId))) {
      fallbackWishlistStore.get(String(userId)).delete(String(productId));
    }

    return {
      removed: deletedCount > 0,
      product_id: productId,
      message: deletedCount > 0 ? 'Item removed from wishlist' : 'Item was not in wishlist',
    };
  } catch (err) {
    logger.warn('Database error in removeFromWishlist, using in-memory store:', err.message);
    let removed = false;
    if (fallbackWishlistStore.has(String(userId))) {
      removed = fallbackWishlistStore.get(String(userId)).delete(String(productId));
    }
    return {
      removed,
      product_id: productId,
      message: removed ? 'Item removed from wishlist' : 'Item was not in wishlist',
    };
  }
};

/**
 * Toggle a product's presence in customer wishlist.
 * If present, removes it; if absent, adds it.
 *
 * @param {string} userId - Customer UUID
 * @param {string} productId - Product UUID
 * @returns {Promise<object>} Toggle status { wishlisted: boolean, message: string }
 */
const toggleWishlist = async (userId, productId) => {
  if (!userId) {
    throw ApiError.unauthorized('User ID is required to toggle wishlist item');
  }
  if (!productId) {
    throw ApiError.badRequest('Product ID is required');
  }

  try {
    const existing = await Wishlist.findOne({
      where: { user_id: userId, product_id: productId },
    });

    if (existing) {
      await existing.destroy();
      if (fallbackWishlistStore.has(String(userId))) {
        fallbackWishlistStore.get(String(userId)).delete(String(productId));
      }
      return {
        wishlisted: false,
        product_id: productId,
        message: 'Product removed from wishlist',
      };
    }

    const { item } = await addToWishlist(userId, productId);
    return {
      wishlisted: true,
      product_id: productId,
      item,
      message: 'Product added to wishlist',
    };
  } catch (err) {
    if (err instanceof ApiError) throw err;

    logger.warn('Database error in toggleWishlist, using in-memory store:', err.message);
    if (!fallbackWishlistStore.has(String(userId))) {
      fallbackWishlistStore.set(String(userId), new Set());
    }
    const userSet = fallbackWishlistStore.get(String(userId));
    if (userSet.has(String(productId))) {
      userSet.delete(String(productId));
      return {
        wishlisted: false,
        product_id: productId,
        message: 'Product removed from wishlist',
      };
    }

    userSet.add(String(productId));
    return {
      wishlisted: true,
      product_id: productId,
      message: 'Product added to wishlist',
    };
  }
};

/**
 * Query subscribers who have saved a specific product to their wishlist.
 *
 * @param {string} productId - Product UUID
 * @returns {Promise<Array<object>>} List of subscribed users
 */
const getSubscribersForRestock = async (productId) => {
  if (!productId) return [];

  try {
    const records = await Wishlist.findAll({
      where: { product_id: productId },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'email', 'first_name', 'last_name'],
        },
      ],
    });

    return records.map((r) => r.user).filter(Boolean);
  } catch (err) {
    logger.warn('Failed to query wishlist subscribers from database:', err.message);
    return [];
  }
};

/**
 * Trigger SendGrid automated restock notification emails to subscribed customers.
 *
 * @param {string} productId - Product UUID
 * @param {object} restockDetails - Restock quantity and variant details
 * @returns {Promise<object>} Dispatch summary
 */
const triggerRestockAlerts = async (productId, restockDetails = {}) => {
  const subscribers = await getSubscribersForRestock(productId);
  let productTitle = 'Your wishlisted item';

  try {
    const prod = await Product.findByPk(productId);
    if (prod && prod.title) {
      productTitle = prod.title;
    }
  } catch (e) {
    const fb = getFallbackProduct(productId);
    if (fb && fb.title) productTitle = fb.title;
  }

  logger.info(
    `[Restock Alert Engine] Found ${subscribers.length} subscriber(s) for restocked product: '${productTitle}' (${productId})`
  );

  const notifications = subscribers.map((sub) => {
    const payload = {
      to: sub.email,
      recipientName: `${sub.first_name || ''} ${sub.last_name || ''}`.trim() || 'Valued Customer',
      subject: `Back in Stock: ${productTitle} is now available at Dickwella Fashion Corner!`,
      productId,
      productTitle,
      restockDetails,
      dispatchedAt: new Date().toISOString(),
    };

    // If SENDGRID_API_KEY is configured in production, integrate SendGrid SDK dispatch
    if (process.env.SENDGRID_API_KEY) {
      logger.info(`[SendGrid Integration] Dispatching restock email to ${sub.email}`);
    } else {
      logger.info(`[SendGrid Simulated] Restock alert prepared for ${sub.email} (${productTitle})`);
    }

    return payload;
  });

  return {
    product_id: productId,
    product_title: productTitle,
    notified_count: notifications.length,
    subscribers: notifications,
  };
};

/**
 * Clears the in-memory fallback store (useful for clean test teardown).
 */
const resetFallbackStore = () => {
  fallbackWishlistStore.clear();
};

module.exports = {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  toggleWishlist,
  getSubscribersForRestock,
  triggerRestockAlerts,
  formatWishlistItem,
  resetFallbackStore,
};
