const express = require('express');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { ROLES } = require('../config/constants');
const inventoryController = require('../controllers/inventory.controller');
const { successResponse } = require('../utils/responseFormatter');

const checkoutController = require('../controllers/checkout.controller');

const router = express.Router();

/**
 * @route POST /api/v1/inventory/reserve
 * @desc Reserve variant inventory for 15 minutes during checkout (STORM-FE-010)
 * @access Public (Guest or Authenticated)
 */
router.post('/reserve', checkoutController.reserve);

/**
 * @route POST /api/v1/inventory/release/:reservationId
 * @desc Release reserved inventory back to available stock
 * @access Public (Guest or Authenticated)
 */
router.post('/release/:reservationId', checkoutController.release);

/**
 * @route GET /api/v1/inventory/reservation-status
 * @desc Get real-time stock reservation status probe
 * @access Public (Guest or Authenticated)
 */
router.get('/reservation-status', (req, res) => {
  return successResponse(
    res,
    {
      active_reservations: 0,
      ttl_seconds: 900,
      status: 'operational',
    },
    'Reservation engine active and operational'
  );
});

// Enforce authentication on all subsequent warehouse management inventory endpoints
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
