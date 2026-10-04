const express = require('express');
const wishlistController = require('../controllers/wishlist.controller');
const authenticate = require('../middleware/authenticate');

const router = express.Router();

// Enforce JWT authentication on all wishlist endpoints
router.use(authenticate);

/**
 * @route   GET /api/v1/wishlist
 * @desc    Retrieve customer wishlist with live stock status and formatted LKR prices
 * @access  Private (Authenticated Customer)
 */
router.get('/', wishlistController.getWishlist);

/**
 * @route   POST /api/v1/wishlist
 * @desc    Add a product to customer wishlist
 * @access  Private (Authenticated Customer)
 */
router.post('/', wishlistController.addToWishlist);

/**
 * @route   POST /api/v1/wishlist/toggle
 * @desc    Toggle product in wishlist (adds if absent, removes if present)
 * @access  Private (Authenticated Customer)
 */
router.post('/toggle', wishlistController.toggleWishlist);

/**
 * @route   DELETE /api/v1/wishlist/:productId
 * @desc    Remove a specific product from customer wishlist
 * @access  Private (Authenticated Customer)
 */
router.delete('/:productId', wishlistController.removeFromWishlist);

/**
 * @route   DELETE /api/v1/wishlist
 * @desc    Remove a product specified in request body from customer wishlist
 * @access  Private (Authenticated Customer)
 */
router.delete('/', wishlistController.removeFromWishlist);

/**
 * @route   POST /api/v1/wishlist/restock-alert/:productId
 * @desc    Trigger automated SendGrid back-in-stock notifications for wishlisted subscribers
 * @access  Private (Authenticated Customer / Staff)
 */
router.post('/restock-alert/:productId', wishlistController.triggerRestockAlert);

module.exports = router;
