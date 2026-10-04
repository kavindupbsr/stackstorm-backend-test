const express = require('express');
const cartController = require('../controllers/cart.controller');
const optionalAuthenticate = require('../middleware/optionalAuthenticate');
const authenticate = require('../middleware/authenticate');

const router = express.Router();

/**
 * @route   POST /api/v1/cart/merge
 * @desc    Merge anonymous guest Redis cart into authenticated customer PostgreSQL cart
 * @access  Private (Authenticated User)
 */
router.post('/merge', authenticate, cartController.mergeCart);

/**
 * Apply optional authentication to all standard cart CRUD operations
 */
router.use(optionalAuthenticate);

/**
 * @route   GET /api/v1/cart
 * @desc    Retrieve active shopping cart for authenticated user or anonymous guest
 * @access  Public (Optional Auth)
 */
router.get('/', cartController.getCart);

/**
 * @route   POST /api/v1/cart
 * @desc    Add an item to the shopping cart, validating stock availability
 * @access  Public (Optional Auth)
 */
router.post('/', cartController.addItem);

/**
 * @route   PUT /api/v1/cart/:itemId
 * @desc    Update quantity of a line item in the cart
 * @access  Public (Optional Auth)
 */
router.put('/:itemId', cartController.updateItem);

/**
 * @route   DELETE /api/v1/cart/:itemId
 * @desc    Remove a specific line item from the cart
 * @access  Public (Optional Auth)
 */
router.delete('/:itemId', cartController.removeItem);

/**
 * @route   DELETE /api/v1/cart
 * @desc    Clear all line items from the active cart
 * @access  Public (Optional Auth)
 */
router.delete('/', cartController.clearCart);

module.exports = router;
