const express = require('express');
const categoryController = require('../controllers/category.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { ROLES } = require('../config/constants');

const router = express.Router();

/**
 * @route   GET /api/v1/categories
 * @desc    Retrieve nested category hierarchy tree with Redis sub-tree caching
 * @access  Public
 */
router.get('/', categoryController.getCategories);

/**
 * @route   POST /api/v1/categories
 * @desc    Create a new category (Admin only) and invalidate category cache
 * @access  Private (Admin)
 */
router.post('/', authenticate, authorize(ROLES.ADMIN), categoryController.createCategory);

/**
 * @route   PUT /api/v1/categories/:id
 * @desc    Update category (Admin only) and invalidate category cache
 * @access  Private (Admin)
 */
router.put('/:id', authenticate, authorize(ROLES.ADMIN), categoryController.updateCategory);

/**
 * @route   DELETE /api/v1/categories/:id
 * @desc    Delete category (Admin only) and invalidate category cache
 * @access  Private (Admin)
 */
router.delete('/:id', authenticate, authorize(ROLES.ADMIN), categoryController.deleteCategory);

module.exports = router;
