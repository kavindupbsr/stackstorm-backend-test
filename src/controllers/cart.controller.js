const crypto = require('crypto');
const cartService = require('../services/cart.service');
const { successResponse } = require('../utils/responseFormatter');

/**
 * Extracts or generates identity tokens for authenticated user or anonymous guest.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {{ userId: string|null, sessionId: string|null }}
 */
const resolveSessionAndUser = (req, res) => {
  const userId = req.user ? req.user.id : null;
  let sessionId =
    req.headers['x-session-id'] ||
    req.headers['x-guest-session-id'] ||
    (req.body && req.body.guest_session_id) ||
    req.query.session_id ||
    null;

  if (!userId && !sessionId) {
    sessionId = `guest_${crypto.randomUUID()}`;
  }

  if (sessionId) {
    res.set('X-Session-ID', sessionId);
  }

  return { userId, sessionId };
};

/**
 * Retrieves current active shopping cart.
 */
const getCart = async (req, res, next) => {
  try {
    const { userId, sessionId } = resolveSessionAndUser(req, res);
    const cart = await cartService.getCart({ userId, sessionId });
    return successResponse(res, cart, 'Shopping cart retrieved successfully');
  } catch (error) {
    return next(error);
  }
};

/**
 * Adds an item to the shopping cart.
 */
const addItem = async (req, res, next) => {
  try {
    const { userId, sessionId } = resolveSessionAndUser(req, res);
    const { variant_id: v1, product_variant_id: v2, quantity = 1 } = req.body;
    const variantId = v1 || v2;

    const cart = await cartService.addItem({
      userId,
      sessionId,
      variantId,
      quantity,
    });
    return successResponse(res, cart, 'Item added to cart successfully', 200);
  } catch (error) {
    return next(error);
  }
};

/**
 * Updates the quantity of a specific item in the cart.
 */
const updateItem = async (req, res, next) => {
  try {
    const { userId, sessionId } = resolveSessionAndUser(req, res);
    const { itemId } = req.params;
    const { quantity } = req.body;

    const cart = await cartService.updateItemQuantity({
      userId,
      sessionId,
      itemId,
      quantity,
    });
    return successResponse(res, cart, 'Cart item updated successfully');
  } catch (error) {
    return next(error);
  }
};

/**
 * Removes an item from the cart.
 */
const removeItem = async (req, res, next) => {
  try {
    const { userId, sessionId } = resolveSessionAndUser(req, res);
    const { itemId } = req.params;

    const cart = await cartService.removeItem({
      userId,
      sessionId,
      itemId,
    });
    return successResponse(res, cart, 'Cart item removed successfully');
  } catch (error) {
    return next(error);
  }
};

/**
 * Clears the active cart completely.
 */
const clearCart = async (req, res, next) => {
  try {
    const { userId, sessionId } = resolveSessionAndUser(req, res);
    const cart = await cartService.clearCart({ userId, sessionId });
    return successResponse(res, cart, 'Shopping cart cleared successfully');
  } catch (error) {
    return next(error);
  }
};

/**
 * Merges anonymous guest cart into authenticated customer account.
 */
const mergeCart = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const guestSessionId =
      (req.body && req.body.guest_session_id) ||
      req.headers['x-session-id'] ||
      req.headers['x-guest-session-id'];

    const cart = await cartService.mergeCart({
      userId,
      guestSessionId,
    });
    return successResponse(res, cart, 'Guest cart merged into user account successfully');
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getCart,
  addItem,
  updateItem,
  removeItem,
  clearCart,
  mergeCart,
  resolveSessionAndUser,
};
