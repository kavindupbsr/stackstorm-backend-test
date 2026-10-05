const express = require('express');
const userController = require('../controllers/user.controller');
const authenticate = require('../middleware/authenticate');

const router = express.Router();

// Enforce JWT authentication on all user profile and address book endpoints
router.use(authenticate);

/**
 * @route   GET /api/v1/users/me
 * @desc    Retrieve authenticated customer profile, loyalty details, and address book
 * @access  Private (Authenticated Customer)
 */
router.get('/me', userController.getProfile);
router.get('/profile', userController.getProfile);

/**
 * @route   PUT /api/v1/users/me
 * @route   PATCH /api/v1/users/me
 * @route   PUT /api/v1/users/profile
 * @desc    Update authenticated customer profile (phone number, marketing preferences)
 * @access  Private (Authenticated Customer)
 */
router.put('/me', userController.updateProfile);
router.patch('/me', userController.updateProfile);
router.put('/profile', userController.updateProfile);
router.patch('/profile', userController.updateProfile);

/**
 * @route   GET /api/v1/users/addresses
 * @desc    List all saved shipping addresses for authenticated customer
 * @access  Private (Authenticated Customer)
 */
router.get('/addresses', userController.getAddresses);

/**
 * @route   POST /api/v1/users/addresses
 * @desc    Add a new shipping address; atomically toggles prior default if is_default=true
 * @access  Private (Authenticated Customer)
 */
router.post('/addresses', userController.addAddress);

/**
 * @route   PUT /api/v1/users/addresses/:id
 * @desc    Update an existing shipping address (enforces owner isolation)
 * @access  Private (Authenticated Customer)
 */
router.put('/addresses/:id', userController.updateAddress);

/**
 * @route   PATCH /api/v1/users/addresses/:id/default
 * @desc    Atomically set a specific address as default shipping address
 * @access  Private (Authenticated Customer)
 */
router.patch('/addresses/:id/default', userController.setDefaultAddress);

/**
 * @route   DELETE /api/v1/users/addresses/:id
 * @desc    Delete a shipping address (enforces owner isolation)
 * @access  Private (Authenticated Customer)
 */
router.delete('/addresses/:id', userController.deleteAddress);

module.exports = router;
