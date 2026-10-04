const express = require('express');
const productController = require('../controllers/product.controller');
const reviewController = require('../controllers/review.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { ROLES } = require('../config/constants');

const router = express.Router();

/**
 * @route   GET /api/v1/products
 * @desc    Retrieve paginated product catalog with multi-faceted filtering and sorting
 * @access  Public
 */
router.get('/', productController.getProducts);

/**
 * @route   POST /api/v1/products/:id/reviews
 * @desc    Submit verified buyer review for a product (enforces delivered purchase gate)
 * @access  Private (Authenticated Buyer)
 */
router.post('/:id/reviews', authenticate, reviewController.createReview);

/**
 * @route   GET /api/v1/products/:id/reviews
 * @desc    Get reviews and rating summary for a product
 * @access  Public
 */
router.get('/:id/reviews', reviewController.getProductReviews);

/**
 * @route   PUT /api/v1/products/:id
 * @desc    Update product details (Admin only) and evict cache
 * @access  Private (Admin)
 */
router.put('/:id', authenticate, authorize(ROLES.ADMIN), productController.updateProduct);

/**
 * @route   DELETE /api/v1/products/:id
 * @desc    Delete product (Admin only) and evict cache
 * @access  Private (Admin)
 */
router.delete('/:id', authenticate, authorize(ROLES.ADMIN), productController.deleteProduct);

/**
 * @route   GET /api/v1/products/:slug
 * @desc    Retrieve single product detail with variant matrix and gallery images
 * @access  Public
 */
router.get('/:slug', productController.getProductBySlug);

module.exports = router;
