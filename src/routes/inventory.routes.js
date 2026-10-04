const express = require('express');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { ROLES } = require('../config/constants');
const inventoryController = require('../controllers/inventory.controller');
const { successResponse } = require('../utils/responseFormatter');

const router = express.Router();

// Enforce authentication on all inventory endpoints
router.use(authenticate);

// Enforce staff/admin authorization (inventory_staff or admin)
router.use(authorize(ROLES.ADMIN, ROLES.INVENTORY));

/**
 * @route PATCH /api/v1/inventory/variants/:sku/stock
 * @desc Adjust SKU variant stock quantity with reason and immutable audit log
 * @access Private (Admin and Inventory Staff)
 */
router.patch('/variants/:sku/stock', inventoryController.adjustVariantStock);

/**
 * @route GET /api/v1/inventory/variants/:sku/logs
 * @desc Get audit trail for a specific SKU
 * @access Private (Admin and Inventory Staff)
 */
router.get('/variants/:sku/logs', inventoryController.getAuditLogs);

/**
 * @route GET /api/v1/inventory/logs
 * @desc Get global inventory adjustment audit logs
 * @access Private (Admin and Inventory Staff)
 */
router.get('/logs', inventoryController.getAuditLogs);

/**
 * @route POST /api/v1/inventory/adjust-stock
 * @desc Adjust SKU stock level (backwards compatible legacy endpoint)
 * @access Private (Admin and Inventory Staff)
 */
router.post('/adjust-stock', inventoryController.adjustStockLegacy);

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
      checkedBy: (req.user && req.user.email) || 'system',
    },
    'Inventory status retrieved successfully'
  );
});

module.exports = router;
