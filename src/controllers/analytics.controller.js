const analyticsService = require('../services/analytics.service');
const { successResponse } = require('../utils/responseFormatter');

/**
 * Controller handling administrative analytics and financial reporting endpoints.
 */

/**
 * Retrieves executive dashboard summary metrics (Revenue, Orders, Customers, Low Stock).
 * Route: GET /api/v1/admin/analytics/overview
 */
const getOverview = async (req, res, next) => {
  try {
    const overview = await analyticsService.getOverviewMetrics();
    return successResponse(res, overview, 'Admin analytics overview retrieved successfully');
  } catch (error) {
    return next(error);
  }
};

/**
 * Retrieves daily sales trend aggregations for charting.
 * Route: GET /api/v1/admin/analytics/sales-trend
 */
const getSalesTrend = async (req, res, next) => {
  try {
    const days = req.query.days || 30;
    const trendData = await analyticsService.getSalesTrend(days);
    return successResponse(res, trendData, 'Sales trend retrieved successfully');
  } catch (error) {
    return next(error);
  }
};

/**
 * Retrieves top-selling garments by volume and revenue.
 * Route: GET /api/v1/admin/analytics/top-products
 */
const getTopProducts = async (req, res, next) => {
  try {
    const limit = req.query.limit || 5;
    const topProducts = await analyticsService.getTopSellingProducts(limit);
    return successResponse(res, topProducts, 'Top selling products retrieved successfully');
  } catch (error) {
    return next(error);
  }
};

/**
 * Retrieves active low-stock alerts for garments needing replenishment.
 * Route: GET /api/v1/admin/analytics/low-stock
 */
const getLowStock = async (req, res, next) => {
  try {
    const threshold = req.query.threshold || 10;
    const alerts = await analyticsService.getLowStockAlerts(threshold);
    return successResponse(res, alerts, 'Low stock alerts retrieved successfully');
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getOverview,
  getSalesTrend,
  getTopProducts,
  getLowStock,
};
