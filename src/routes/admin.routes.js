const express = require('express');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { ROLES } = require('../config/constants');
const analyticsController = require('../controllers/analytics.controller');
const { successResponse } = require('../utils/responseFormatter');

const router = express.Router();

// Enforce authentication on all administrative endpoints
router.use(authenticate);

// Enforce admin-only access on administrative routes
router.use(authorize(ROLES.ADMIN));

/**
 * @route GET /api/v1/admin/analytics/overview
 * @desc Get real-time business performance overview (Revenue, Orders, Active Customers, Low Stock)
 * @access Private (Admin only)
 */
router.get('/analytics/overview', analyticsController.getOverview);
router.get('/analytics', analyticsController.getOverview);

/**
 * @route GET /api/v1/admin/analytics/sales-trend
 * @desc Get daily sales trend aggregations for charting
 * @access Private (Admin only)
 */
router.get('/analytics/sales-trend', analyticsController.getSalesTrend);

/**
 * @route GET /api/v1/admin/analytics/top-products
 * @desc Get top-selling garments by sales volume and revenue
 * @access Private (Admin only)
 */
router.get('/analytics/top-products', analyticsController.getTopProducts);

/**
 * @route GET /api/v1/admin/analytics/low-stock
 * @desc Get low stock variant alerts requiring restocking
 * @access Private (Admin only)
 */
router.get('/analytics/low-stock', analyticsController.getLowStock);

/**
 * @route GET /api/v1/admin/metrics
 * @desc Get system business metrics and store statistics
 * @access Private (Admin only)
 */
router.get('/metrics', (req, res) => {
  return successResponse(
    res,
    {
      metrics: {
        totalOrders: 1420,
        totalSalesLKR: 18450000,
        activeUsers: 840,
        lowStockItems: 12,
        currency: 'LKR',
      },
    },
    'Admin metrics retrieved successfully'
  );
});

/**
 * @route GET /api/v1/admin/users
 * @desc List registered system users and roles
 * @access Private (Admin only)
 */
router.get('/users', (req, res) => {
  return successResponse(
    res,
    {
      users: [
        {
          id: 'admin-001',
          email: 'admin@dickwellafashion.lk',
          role: ROLES.ADMIN,
        },
        {
          id: 'inventory-001',
          email: 'inventory@dickwellafashion.lk',
          role: ROLES.INVENTORY,
        },
      ],
    },
    'Admin users retrieved successfully'
  );
});

module.exports = router;
