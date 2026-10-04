const express = require('express');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { ROLES } = require('../config/constants');
const { successResponse } = require('../utils/responseFormatter');

const router = express.Router();

// Enforce authentication on all inventory endpoints
router.use(authenticate);

// Enforce staff/admin authorization (inventory_staff or admin)
router.use(authorize(ROLES.ADMIN, ROLES.INVENTORY));

/**
 * @route POST /api/v1/inventory/adjust-stock
 * @desc Adjust SKU stock level
 * @access Private (Admin and Inventory Staff)
 */
router.post('/adjust-stock', (req, res) => {
  const { sku, delta = 0 } = req.body || {};
  return successResponse(
    res,
    {
      sku: sku || 'SKU-SAMPLE-01',
      delta,
      newStockLevel: 50 + Number(delta),
      updatedBy: req.user.email,
    },
    'Stock level adjusted successfully'
  );
});

/**
 * @route GET /api/v1/inventory/status
 * @desc Overview of warehouse inventory status
 * @access Private (Admin and Inventory Staff)
 */
router.get('/status', (req, res) => {
  return successResponse(
    res,
    {
      warehouse: 'Dickwella Central Warehouse',
      totalSKUs: 69,
      outOfStockSKUs: 0,
      checkedBy: req.user.email,
    },
    'Inventory status retrieved successfully'
  );
});

module.exports = router;
