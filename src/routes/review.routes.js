const express = require('express');
const reviewController = require('../controllers/review.controller');
const authenticate = require('../middleware/authenticate');

const router = express.Router({ mergeParams: true });

/**
 * @route   POST /api/v1/reviews/products/:id
 * @desc    Submit verified buyer review for a product
 * @access  Private (Authenticated Buyer)
 */
router.post('/products/:id', authenticate, reviewController.createReview);

/**
 * @route   POST /api/v1/reviews
 * @desc    Submit verified buyer review by passing product_id in body
 * @access  Private (Authenticated Buyer)
 */
router.post('/', authenticate, (req, res, next) => {
  req.params.id = req.body.product_id || req.body.productId;
  return reviewController.createReview(req, res, next);
});

/**
 * @route   GET /api/v1/reviews/products/:id
 * @desc    Get paginated reviews and rating summary for a product
 * @access  Public
 */
router.get('/products/:id', reviewController.getProductReviews);
router.get('/product/:id', reviewController.getProductReviews);

module.exports = router;
