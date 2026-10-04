const express = require('express');
const productController = require('../controllers/product.controller');

const router = express.Router();

/**
 * @route   GET /api/v1/products
 * @desc    Retrieve paginated product catalog with multi-faceted filtering and sorting
 * @access  Public
 */
router.get('/', productController.getProducts);

/**
 * @route   GET /api/v1/products/:slug
 * @desc    Retrieve single product detail with variant matrix and gallery images
 * @access  Public
 */
router.get('/:slug', productController.getProductBySlug);

module.exports = router;
