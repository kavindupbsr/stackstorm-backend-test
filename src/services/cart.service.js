const crypto = require('crypto');
const { CartItem, ProductVariant, Product } = require('../models');
const cacheService = require('./cache.service');
const { getFallbackCatalog } = require('./product.service');
const { logger } = require('../config/logger');
const ApiError = require('../utils/ApiError');

const GUEST_CART_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days (604,800 seconds)

// In-memory fallback storage for offline test runs or disconnected PostgreSQL
const fallbackUserCarts = new Map();

/**
 * Formats a numeric currency amount into Sri Lankan Rupees (LKR).
 *
 * @param {number|string} amount
 * @returns {string} Formatted LKR string, e.g. "LKR 3,500.00"
 */
const formatLkr = (amount) => {
  const num = Number(amount) || 0;
  return `LKR ${num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

/**
 * Calculates the total subtotal for an array of cart items in LKR.
 *
 * @param {Array<object>} items - Line items with unit_price and quantity
 * @returns {string} Subtotal formatted to 2 decimal places (e.g., "7000.00")
 */
const calculateSubtotal = (items = []) => {
  const sum = (items || []).reduce((acc, item) => {
    const price = Number(item.unit_price ?? item.price ?? 0);
    const qty = Number(item.quantity ?? 1);
    return acc + price * qty;
  }, 0);
  return sum.toFixed(2);
};

/**
 * Retrieves full variant details, active stock, and unit price.
 *
 * @param {string} variantId - UUID of the product variant
 * @returns {Promise<object|null>}
 */
const getVariantDetails = async (variantId) => {
  if (!variantId) return null;

  try {
    const variant = await ProductVariant.findByPk(variantId, {
      include: [
        {
          model: Product,
          as: 'product',
          attributes: ['id', 'title', 'slug', 'base_price', 'is_active'],
        },
      ],
    });

    if (variant) {
      const plain = variant.get({ plain: true });
      const stock = plain.stock_quantity ?? 0;
      const reserved = plain.reserved_quantity ?? 0;
      const available = Math.max(0, stock - reserved);
      const unitPrice = Number(
        plain.price_override || (plain.product && plain.product.base_price) || 0
      );

      return {
        id: plain.id,
        sku: plain.sku,
        size: plain.size,
        color: plain.color,
        stock_quantity: stock,
        reserved_quantity: reserved,
        availableStock: available,
        unit_price: unitPrice,
        product: plain.product || {
          id: plain.product_id,
          title: 'Apparel Item',
          slug: 'apparel-item',
        },
      };
    }
  } catch (err) {
    logger.warn(
      `Database lookup for variant ${variantId} failed: ${err.message}. Checking fallback catalog.`
    );
  }

  // Fallback catalog lookup
  const fallbackCatalog = getFallbackCatalog();
  for (let i = 0; i < fallbackCatalog.length; i += 1) {
    const prod = fallbackCatalog[i];
    const foundVar = (prod.variants || []).find((v) => v.id === variantId);
    if (foundVar) {
      const stock = foundVar.stock_quantity ?? foundVar.stock ?? 0;
      const reserved = foundVar.reserved_quantity ?? 0;
      const available = Math.max(0, stock - reserved);
      const unitPrice = Number(foundVar.price_override || prod.base_price || 0);
      return {
        id: foundVar.id,
        sku: foundVar.sku,
        size: foundVar.size,
        color: foundVar.color,
        stock_quantity: stock,
        reserved_quantity: reserved,
        availableStock: available,
        unit_price: unitPrice,
        product: {
          id: prod.id,
          title: prod.title,
          slug: prod.slug,
          base_price: Number(prod.base_price),
        },
      };
    }
  }

  return null;
};

/**
 * Returns raw items stored in guest Redis cart.
 *
 * @param {string} sessionId - Guest session UUID
 * @returns {Promise<Array<object>>}
 */
const getGuestItems = async (sessionId) => {
  if (!sessionId) return [];
  const key = `cart:guest:${sessionId}`;
  const data = await cacheService.get(key);
  return Array.isArray(data) ? data : [];
};

/**
 * Saves guest items to Redis with a 7-day TTL.
 *
 * @param {string} sessionId
 * @param {Array<object>} items
 * @returns {Promise<boolean>}
 */
const setGuestItems = async (sessionId, items) => {
  if (!sessionId) return false;
  const key = `cart:guest:${sessionId}`;
  return cacheService.set(key, items, GUEST_CART_TTL_SECONDS);
};

/**
 * Formats an array of line items and calculates financial totals.
 *
 * @param {Array<object>} rawItems
 * @returns {object} Formatted cart object
 */
const formatCartResponse = (rawItems = []) => {
  const items = (rawItems || []).map((item) => {
    const unitPrice = Number(item.unit_price ?? item.price ?? 0);
    const quantity = Number(item.quantity ?? 1);
    const itemTotal = unitPrice * quantity;

    return {
      id: item.id || item.product_variant_id,
      product_variant_id: item.product_variant_id || item.id,
      variant_id: item.product_variant_id || item.id,
      quantity,
      unit_price: unitPrice,
      total_price: itemTotal,
      unit_price_formatted: formatLkr(unitPrice),
      total_price_formatted: formatLkr(itemTotal),
      variant: item.variant || null,
      product: item.product || null,
    };
  });

  const subtotalStr = calculateSubtotal(items);
  const subtotalNum = Number(subtotalStr);
  const totalItems = items.reduce((acc, it) => acc + it.quantity, 0);

  return {
    items,
    subtotal: formatLkr(subtotalNum),
    subtotal_amount: subtotalNum,
    subtotal_lkr: subtotalStr,
    tax: formatLkr(0),
    total: formatLkr(subtotalNum),
    total_amount: subtotalNum,
    item_count: items.length,
    total_items: totalItems,
  };
};

/**
 * Retrieves the active shopping cart for an authenticated user or anonymous guest.
 *
 * @param {object} params
 * @param {string} [params.userId] - Authenticated customer ID
 * @param {string} [params.sessionId] - Guest session UUID
 * @returns {Promise<object>} Unified cart response
 */
const getCart = async ({ userId = null, sessionId = null } = {}) => {
  if (userId) {
    try {
      const dbItems = await CartItem.findAll({
        where: { user_id: userId },
        include: [
          {
            model: ProductVariant,
            as: 'variant',
            include: [
              {
                model: Product,
                as: 'product',
                attributes: ['id', 'title', 'slug', 'base_price', 'is_active'],
              },
            ],
          },
        ],
        order: [['created_at', 'ASC']],
      });

      if (dbItems && dbItems.length > 0) {
        const mapped = dbItems.map((dbIt) => {
          const plain = dbIt.get({ plain: true });
          const v = plain.variant || {};
          const p = v.product || {};
          const unitPrice = Number(v.price_override || p.base_price || 0);

          return {
            id: plain.id,
            product_variant_id: plain.product_variant_id,
            quantity: plain.quantity,
            unit_price: unitPrice,
            variant: {
              id: v.id,
              sku: v.sku,
              size: v.size,
              color: v.color,
              availableStock: Math.max(0, (v.stock_quantity || 0) - (v.reserved_quantity || 0)),
            },
            product: {
              id: p.id,
              title: p.title,
              slug: p.slug,
            },
          };
        });
        return formatCartResponse(mapped);
      }
    } catch (err) {
      logger.warn(
        `Database getCart failed for user ${userId}: ${err.message}. Checking fallback storage.`
      );
    }

    const fallbackItems = fallbackUserCarts.get(userId) || [];
    return formatCartResponse(fallbackItems);
  }

  if (sessionId) {
    const guestItems = await getGuestItems(sessionId);
    return formatCartResponse(guestItems);
  }

  return formatCartResponse([]);
};

/**
 * Adds an item to the shopping cart, asserting available inventory.
 *
 * @param {object} params
 * @param {string} [params.userId] - Authenticated user UUID
 * @param {string} [params.sessionId] - Anonymous guest session UUID
 * @param {string} params.variantId - ProductVariant UUID
 * @param {number} [params.quantity=1] - Number of units to add
 * @returns {Promise<object>} Updated cart response
 */
const addItem = async ({ userId = null, sessionId = null, variantId, quantity = 1 }) => {
  const reqQty = parseInt(quantity, 10);
  if (!reqQty || reqQty < 1) {
    throw ApiError.badRequest('Quantity must be an integer of at least 1');
  }

  const variant = await module.exports.getVariantDetails(variantId);
  if (!variant) {
    throw ApiError.notFound(`Product variant not found: ${variantId}`);
  }

  if (variant.availableStock < 1) {
    throw ApiError.badRequest('Only 0 units available for this variant');
  }

  if (userId) {
    try {
      const existing = await CartItem.findOne({
        where: { user_id: userId, product_variant_id: variantId },
      });

      const currentQty = existing ? existing.quantity : 0;
      const targetQty = currentQty + reqQty;

      if (targetQty > variant.availableStock) {
        throw ApiError.badRequest(
          `Only ${variant.availableStock} units available for this variant`
        );
      }

      if (existing) {
        await existing.update({ quantity: targetQty });
      } else {
        await CartItem.create({
          id: crypto.randomUUID(),
          user_id: userId,
          product_variant_id: variantId,
          quantity: reqQty,
        });
      }
      return getCart({ userId });
    } catch (err) {
      if (err instanceof ApiError) throw err;
      logger.warn(`Database addItem failed: ${err.message}. Storing in fallback user cart.`);
    }

    // Fallback user cart
    const userItems = fallbackUserCarts.get(userId) || [];
    const existingIndex = userItems.findIndex((it) => it.product_variant_id === variantId);
    const currentQty = existingIndex !== -1 ? userItems[existingIndex].quantity : 0;
    const targetQty = currentQty + reqQty;

    if (targetQty > variant.availableStock) {
      throw ApiError.badRequest(`Only ${variant.availableStock} units available for this variant`);
    }

    if (existingIndex !== -1) {
      userItems[existingIndex].quantity = targetQty;
    } else {
      userItems.push({
        id: crypto.randomUUID(),
        product_variant_id: variant.id,
        quantity: reqQty,
        unit_price: variant.unit_price,
        variant,
        product: variant.product,
      });
    }
    fallbackUserCarts.set(userId, userItems);
    return formatCartResponse(userItems);
  }

  if (sessionId) {
    const items = await getGuestItems(sessionId);
    const existingIndex = items.findIndex((it) => it.product_variant_id === variantId);
    const currentQty = existingIndex !== -1 ? items[existingIndex].quantity : 0;
    const targetQty = currentQty + reqQty;

    if (targetQty > variant.availableStock) {
      throw ApiError.badRequest(`Only ${variant.availableStock} units available for this variant`);
    }

    if (existingIndex !== -1) {
      items[existingIndex].quantity = targetQty;
    } else {
      items.push({
        id: crypto.randomUUID(),
        product_variant_id: variant.id,
        quantity: reqQty,
        unit_price: variant.unit_price,
        variant,
        product: variant.product,
      });
    }

    await setGuestItems(sessionId, items);
    return formatCartResponse(items);
  }

  throw ApiError.badRequest('Either an authenticated user or a guest session ID is required');
};

/**
 * Removes a specific line item from the active cart.
 *
 * @param {object} params
 * @param {string} [params.userId]
 * @param {string} [params.sessionId]
 * @param {string} params.itemId - Line item ID or ProductVariant UUID
 * @returns {Promise<object>} Updated cart response
 */
const removeItem = async ({ userId = null, sessionId = null, itemId }) => {
  if (userId) {
    try {
      const removed = await CartItem.destroy({
        where: { id: itemId, user_id: userId },
      });
      if (removed === 0) {
        await CartItem.destroy({
          where: { product_variant_id: itemId, user_id: userId },
        });
      }
      return getCart({ userId });
    } catch (err) {
      logger.warn(`Database removeItem failed: ${err.message}`);
    }

    // Fallback user cart
    const userItems = fallbackUserCarts.get(userId) || [];
    const filtered = userItems.filter((it) => it.id !== itemId && it.product_variant_id !== itemId);
    fallbackUserCarts.set(userId, filtered);
    return formatCartResponse(filtered);
  }

  if (sessionId) {
    const items = await getGuestItems(sessionId);
    const filtered = items.filter((it) => it.id !== itemId && it.product_variant_id !== itemId);
    await setGuestItems(sessionId, filtered);
    return formatCartResponse(filtered);
  }

  return formatCartResponse([]);
};

/**
 * Updates the quantity of a specific cart line item.
 *
 * @param {object} params
 * @param {string} [params.userId]
 * @param {string} [params.sessionId]
 * @param {string} params.itemId - Line item ID or ProductVariant UUID
 * @param {number} params.quantity - New desired quantity
 * @returns {Promise<object>} Updated cart response
 */
const updateItemQuantity = async ({ userId = null, sessionId = null, itemId, quantity }) => {
  const newQty = parseInt(quantity, 10);
  if (Number.isNaN(newQty)) {
    throw ApiError.badRequest('Quantity must be a valid integer');
  }

  // If quantity <= 0, remove the item
  if (newQty <= 0) {
    return removeItem({ userId, sessionId, itemId });
  }

  if (userId) {
    try {
      const dbItem = await CartItem.findOne({
        where: { id: itemId, user_id: userId },
      });

      const targetItem =
        dbItem ||
        (await CartItem.findOne({
          where: { product_variant_id: itemId, user_id: userId },
        }));

      if (targetItem) {
        const variant = await module.exports.getVariantDetails(targetItem.product_variant_id);
        if (variant && newQty > variant.availableStock) {
          throw ApiError.badRequest(
            `Only ${variant.availableStock} units available for this variant`
          );
        }
        await targetItem.update({ quantity: newQty });
        return getCart({ userId });
      }
    } catch (err) {
      if (err instanceof ApiError) throw err;
      logger.warn(`Database updateItemQuantity failed: ${err.message}`);
    }

    // Fallback user cart
    const userItems = fallbackUserCarts.get(userId) || [];
    const item = userItems.find((it) => it.id === itemId || it.product_variant_id === itemId);
    if (!item) {
      throw ApiError.notFound('Cart item not found');
    }
    const variant = await module.exports.getVariantDetails(item.product_variant_id);
    if (variant && newQty > variant.availableStock) {
      throw ApiError.badRequest(`Only ${variant.availableStock} units available for this variant`);
    }
    item.quantity = newQty;
    fallbackUserCarts.set(userId, userItems);
    return formatCartResponse(userItems);
  }

  if (sessionId) {
    const items = await getGuestItems(sessionId);
    const item = items.find((it) => it.id === itemId || it.product_variant_id === itemId);
    if (!item) {
      throw ApiError.notFound('Cart item not found in guest session');
    }
    const variant = await module.exports.getVariantDetails(item.product_variant_id);
    if (variant && newQty > variant.availableStock) {
      throw ApiError.badRequest(`Only ${variant.availableStock} units available for this variant`);
    }
    item.quantity = newQty;
    await setGuestItems(sessionId, items);
    return formatCartResponse(items);
  }

  throw ApiError.badRequest('Session or user identification required');
};

/**
 * Clears all items from the active cart.
 *
 * @param {object} params
 * @param {string} [params.userId]
 * @param {string} [params.sessionId]
 * @returns {Promise<object>} Empty cart response
 */
const clearCart = async ({ userId = null, sessionId = null } = {}) => {
  if (userId) {
    try {
      await CartItem.destroy({ where: { user_id: userId } });
    } catch (err) {
      logger.warn(`Database clearCart failed: ${err.message}`);
    }
    fallbackUserCarts.delete(userId);
  }

  if (sessionId) {
    await cacheService.del(`cart:guest:${sessionId}`);
  }

  return formatCartResponse([]);
};

/**
 * Merges anonymous Redis guest cart into authenticated customer PostgreSQL cart.
 * Combines quantities for colliding variants up to available stock.
 * Evicts the guest cart from Redis upon successful completion.
 *
 * @param {object} params
 * @param {string} params.userId - Authenticated user UUID
 * @param {string} params.guestSessionId - Anonymous guest session UUID
 * @returns {Promise<object>} Merged customer cart response
 */
const mergeCart = async ({ userId, guestSessionId }) => {
  if (!userId) {
    throw ApiError.badRequest('User ID is required to merge shopping cart');
  }

  if (!guestSessionId) {
    return getCart({ userId });
  }

  const guestItems = await getGuestItems(guestSessionId);
  if (!guestItems || guestItems.length === 0) {
    return getCart({ userId });
  }

  // Iterate over each guest item and merge into user cart
  for (let i = 0; i < guestItems.length; i += 1) {
    const gItem = guestItems[i];
    const variantId = gItem.product_variant_id || gItem.variant_id || gItem.id;
    const gQty = parseInt(gItem.quantity, 10) || 1;

    // eslint-disable-next-line no-await-in-loop
    const variantDetails = await module.exports.getVariantDetails(variantId);
    let availableStock = 9999;
    if (variantDetails && variantDetails.availableStock !== undefined) {
      availableStock = variantDetails.availableStock;
    } else if (gItem.variant && gItem.variant.availableStock !== undefined) {
      availableStock = gItem.variant.availableStock;
    }

    let dbUpdated = false;
    try {
      // eslint-disable-next-line no-await-in-loop
      const existingDbItem = await CartItem.findOne({
        where: { user_id: userId, product_variant_id: variantId },
      });

      if (existingDbItem) {
        const combinedQty = Math.min(existingDbItem.quantity + gQty, availableStock);
        // eslint-disable-next-line no-await-in-loop
        await existingDbItem.update({ quantity: combinedQty });
      } else {
        const finalQty = Math.min(gQty, availableStock);
        // eslint-disable-next-line no-await-in-loop
        await CartItem.create({
          id: crypto.randomUUID(),
          user_id: userId,
          product_variant_id: variantId,
          quantity: finalQty,
        });
      }
      dbUpdated = true;
    } catch (err) {
      logger.warn(`Database cart merge item failed: ${err.message}`);
    }

    if (!dbUpdated) {
      // Fallback user cart merge
      const userItems = fallbackUserCarts.get(userId) || [];
      const matchIndex = userItems.findIndex(
        (it) =>
          it.product_variant_id === variantId || it.variant_id === variantId || it.id === variantId
      );

      if (matchIndex !== -1) {
        const combinedQty = Math.min(userItems[matchIndex].quantity + gQty, availableStock);
        userItems[matchIndex].quantity = combinedQty;
      } else {
        const finalQty = Math.min(gQty, availableStock);
        userItems.push({
          id: crypto.randomUUID(),
          product_variant_id: variantId,
          variant_id: variantId,
          quantity: finalQty,
          unit_price: gItem.unit_price || (variantDetails ? variantDetails.unit_price : 0),
          variant: gItem.variant || variantDetails,
          product: gItem.product || (variantDetails && variantDetails.product),
        });
      }
      fallbackUserCarts.set(userId, userItems);
    }
  }

  // Atomically evict guest cart key from Redis
  await cacheService.del(`cart:guest:${guestSessionId}`);
  logger.info(
    `Merged guest cart "${guestSessionId}" into user account "${userId}" and evicted Redis key`
  );

  return getCart({ userId });
};

module.exports = {
  getCart,
  addItem,
  updateItemQuantity,
  removeItem,
  clearCart,
  mergeCart,
  calculateSubtotal,
  formatLkr,
  getVariantDetails,
  GUEST_CART_TTL_SECONDS,
  fallbackUserCarts,
};
