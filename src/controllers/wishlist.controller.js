const wishlistService = require('../services/wishlist.service');
const { successResponse } = require('../utils/responseFormatter');
const ApiError = require('../utils/ApiError');

/**
 * Controller handling authenticated customer wishlist endpoints.
 */
const getWishlist = async (req, res, next) => {
  try {
    const userId = req.user && req.user.id;
    if (!userId) {
      return successResponse(res, [], 'Guest wishlist empty');
    }

    const items = await wishlistService.getWishlist(userId);
    return successResponse(res, items, 'Wishlist retrieved successfully');
  } catch (error) {
    return next(error);
  }
};

const addToWishlist = async (req, res, next) => {
  try {
    const userId = req.user && req.user.id;
    if (!userId) {
      throw ApiError.unauthorized('Authentication required to modify wishlist');
    }

    const productId = req.body.productId || req.body.product_id;
    if (!productId) {
      throw ApiError.badRequest('productId is required in request body');
    }

    const result = await wishlistService.addToWishlist(userId, productId);
    const statusCode = result.created ? 201 : 200;
    return successResponse(res, result, result.message, statusCode);
  } catch (error) {
    return next(error);
  }
};

const removeFromWishlist = async (req, res, next) => {
  try {
    const userId = req.user && req.user.id;
    if (!userId) {
      throw ApiError.unauthorized('Authentication required to modify wishlist');
    }

    const productId = req.params.productId || req.body.productId || req.body.product_id;
    if (!productId) {
      throw ApiError.badRequest('productId is required in route params or body');
    }

    const result = await wishlistService.removeFromWishlist(userId, productId);
    return successResponse(res, result, result.message);
  } catch (error) {
    return next(error);
  }
};

const toggleWishlist = async (req, res, next) => {
  try {
    const userId = req.user && req.user.id;
    if (!userId) {
      throw ApiError.unauthorized('Authentication required to toggle wishlist');
    }

    const productId = req.params.productId || req.body.productId || req.body.product_id;
    if (!productId) {
      throw ApiError.badRequest('productId is required in route params or body');
    }

    const result = await wishlistService.toggleWishlist(userId, productId);
    return successResponse(res, result, result.message);
  } catch (error) {
    return next(error);
  }
};

const triggerRestockAlert = async (req, res, next) => {
  try {
    const productId = req.params.productId || req.body.productId || req.body.product_id;
    if (!productId) {
      throw ApiError.badRequest('productId is required to trigger restock notifications');
    }

    const result = await wishlistService.triggerRestockAlerts(productId, req.body);
    return successResponse(res, result, 'Restock alerts triggered successfully');
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  toggleWishlist,
  triggerRestockAlert,
};
