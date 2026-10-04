const reviewService = require('../services/review.service');
const { successResponse } = require('../utils/responseFormatter');
const ApiError = require('../utils/ApiError');

/**
 * Controller handling product reviews and verified purchase feedback.
 */

/**
 * Creates a verified purchase customer review.
 * Route: POST /api/v1/products/:id/reviews or POST /api/v1/reviews
 */
const createReview = async (req, res, next) => {
  try {
    const userId = req.user && req.user.id;
    if (!userId) {
      throw ApiError.unauthorized('Authentication token is required');
    }

    const productId =
      req.params.id || req.params.productId || req.body.productId || req.body.product_id;
    if (!productId) {
      throw ApiError.badRequest('product_id is required');
    }

    const review = await reviewService.createReview(userId, productId, req.body);
    return successResponse(res, review, 'Review submitted successfully', 201);
  } catch (error) {
    return next(error);
  }
};

/**
 * Retrieves paginated reviews and summary rating stats for a product.
 * Route: GET /api/v1/products/:id/reviews or GET /api/v1/reviews/products/:id
 */
const getProductReviews = async (req, res, next) => {
  try {
    const productId = req.params.id || req.params.productId;
    if (!productId) {
      throw ApiError.badRequest('product_id is required');
    }

    const reviews = await reviewService.getProductReviews(productId, req.query);
    return successResponse(res, reviews, 'Product reviews retrieved successfully', 200);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  createReview,
  getProductReviews,
};
