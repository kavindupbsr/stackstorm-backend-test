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
 * @route   GET /api/v1/reviews/products/:id
 * @desc    Get paginated reviews and rating summary for a product
 * @access  Public
 */
router.get('/products/:id', reviewController.getProductReviews);

module.exports = router;
