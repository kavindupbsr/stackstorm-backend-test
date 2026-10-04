const express = require('express');
const productController = require('../controllers/product.controller');

const router = express.Router();

/**
 * @route   GET /api/v1/products
 * @desc    Retrieve paginated product catalog with multi-faceted filtering and sorting
 * @access  Public
 */
router.get('/', productController.getProducts);

module.exports = router;
