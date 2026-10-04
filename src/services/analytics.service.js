/* eslint-disable camelcase */
const { Op } = require('sequelize');
const {
  Order,
  OrderItem,
  ProductVariant,
  Product,
  User,
  sequelize,
} = require('../models');
const { logger } = require('../config/logger');

/**
 * Calculates gross revenue summing item total prices or unit_price * quantity in LKR.
 *
 * @param {Array<object>} items - Array of OrderItem objects or line items
 * @returns {number} Summed gross revenue in LKR rounded to 2 decimal places
 */
const calculateGrossRevenue = (items = []) => {
  if (!Array.isArray(items)) return 0;
  const sum = items.reduce((acc, item) => {
    const total =
      item.total_price !== undefined && item.total_price !== null
        ? Number(item.total_price)
        : Number(item.unit_price_at_purchase || 0) * Number(item.quantity || 0);
    return acc + (Number.isNaN(total) ? 0 : total);
  }, 0);
  return Math.round(sum * 100) / 100;
};

/**
 * Formats a numeric currency amount into Sri Lankan Rupee standard display string.
 *
 * @param {number} amount
 * @returns {string} e.g. "LKR 145,000.00"
 */
const formatLKR = (amount) => {
  const num = Number(amount) || 0;
  return `LKR ${num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

/**
 * Retrieves high-level business analytics overview metrics for the executive dashboard.
 * - Total Revenue in LKR
 * - Total Orders Count
 * - Today's Orders Count
 * - Active Registered Customers
 * - Low Stock Variants Count (stock <= threshold)
 *
 * @returns {Promise<object>}
 */
const getOverviewMetrics = async () => {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  try {
    // 1. Total Revenue from paid/delivered orders
    let totalRevenueRaw = 0;
    try {
      const revenueResult = await Order.findAll({
        attributes: [
          [sequelize.fn('COALESCE', sequelize.fn('SUM', sequelize.col('total_amount')), 0), 'totalRevenue'],
          [sequelize.fn('COUNT', sequelize.col('id')), 'totalOrders'],
        ],
        where: {
          payment_status: 'paid',
        },
        raw: true,
      });

      if (revenueResult && revenueResult.length > 0) {
        totalRevenueRaw = parseFloat(revenueResult[0].totalRevenue) || 0;
      }
    } catch (dbErr) {
      logger.warn(`[ANALYTICS_SERVICE] Revenue query notice: ${dbErr.message}`);
    }

    // 2. Total orders and Today's orders count
    let totalOrders = 0;
    let todaysOrders = 0;
    try {
      totalOrders = await Order.count();
      todaysOrders = await Order.count({
        where: {
          created_at: {
            [Op.gte]: startOfToday,
          },
        },
      });
    } catch (countErr) {
      logger.warn(`[ANALYTICS_SERVICE] Order count notice: ${countErr.message}`);
    }

    // 3. Active customers count
    let activeCustomers = 0;
    try {
      activeCustomers = await User.count({
        where: {
          role: 'customer',
          is_active: true,
        },
      });
    } catch (userErr) {
      logger.warn(`[ANALYTICS_SERVICE] Active customer count notice: ${userErr.message}`);
    }

    // 4. Low stock variants count (stock_quantity <= 10)
    let lowStockItems = 0;
    try {
      lowStockItems = await ProductVariant.count({
        where: {
          stock_quantity: {
            [Op.lte]: 10,
          },
        },
      });
    } catch (stockErr) {
      logger.warn(`[ANALYTICS_SERVICE] Low stock count notice: ${stockErr.message}`);
    }

    // Round raw revenue to 2 decimal places
    totalRevenueRaw = Math.round(totalRevenueRaw * 100) / 100;

    return {
      totalRevenue: formatLKR(totalRevenueRaw),
      totalRevenueRaw,
      totalOrders,
      todaysOrders,
      activeCustomers,
      lowStockItems,
      lowStockItemCount: lowStockItems,
      currency: 'LKR',
      generatedAt: new Date().toISOString(),
    };
  } catch (err) {
    logger.error(`[ANALYTICS_SERVICE] getOverviewMetrics critical error: ${err.message}`);
    return {
      totalRevenue: 'LKR 0.00',
      totalRevenueRaw: 0,
      totalOrders: 0,
      todaysOrders: 0,
      activeCustomers: 0,
      lowStockItems: 0,
      lowStockItemCount: 0,
      currency: 'LKR',
      generatedAt: new Date().toISOString(),
    };
  }
};

/**
 * Retrieves daily sales trends over a specified day window (7, 30, or 90 days).
 *
 * @param {number|string} [days=30]
 * @returns {Promise<object>}
 */
const getSalesTrend = async (days = 30) => {
  const windowDays = Math.max(1, Math.min(365, parseInt(days, 10) || 30));
  const now = new Date();
  const startDate = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (windowDays - 1), 0, 0, 0, 0)
  );

  // Initialize day buckets map with zero values
  const dateMap = new Map();
  for (let i = windowDays - 1; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i));
    const key = d.toISOString().split('T')[0];
    dateMap.set(key, { date: key, revenue: 0, orders: 0, orderCount: 0 });
  }

  try {
    const orders = await Order.findAll({
      where: {
        payment_status: 'paid',
        created_at: {
          [Op.gte]: startDate,
        },
      },
      attributes: ['total_amount', 'created_at'],
      raw: true,
    });

    orders.forEach((ord) => {
      const orderDate = new Date(ord.created_at).toISOString().split('T')[0];
      if (dateMap.has(orderDate)) {
        const bucket = dateMap.get(orderDate);
        bucket.revenue = Math.round((bucket.revenue + parseFloat(ord.total_amount || 0)) * 100) / 100;
        bucket.orders += 1;
        bucket.orderCount += 1;
      }
    });
  } catch (err) {
    logger.warn(`[ANALYTICS_SERVICE] getSalesTrend query notice: ${err.message}`);
  }

  const trend = Array.from(dateMap.values());
  const totalWindowRevenue = trend.reduce((sum, item) => sum + item.revenue, 0);
  const totalWindowOrders = trend.reduce((sum, item) => sum + item.orders, 0);

  return {
    days: windowDays,
    startDate: startDate.toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    totalRevenue: Math.round(totalWindowRevenue * 100) / 100,
    totalRevenueFormatted: formatLKR(totalWindowRevenue),
    totalOrders: totalWindowOrders,
    trend,
  };
};

/**
 * Identifies top-selling garments based on historical order item volumes.
 *
 * @param {number|string} [limit=5]
 * @returns {Promise<Array<object>>}
 */
const getTopSellingProducts = async (limit = 5) => {
  const maxLimit = Math.max(1, Math.min(50, parseInt(limit, 10) || 5));

  try {
    const results = await OrderItem.findAll({
      attributes: [
        'product_title_snapshot',
        [sequelize.fn('SUM', sequelize.col('quantity')), 'units_sold'],
        [sequelize.fn('SUM', sequelize.col('total_price')), 'gross_revenue'],
      ],
      include: [
        {
          model: Order,
          as: 'order',
          where: { payment_status: 'paid' },
          attributes: [],
        },
      ],
      group: ['product_title_snapshot'],
      order: [[sequelize.literal('units_sold'), 'DESC']],
      limit: maxLimit,
      raw: true,
    });

    return results.map((row) => ({
      title: row.product_title_snapshot || 'Untitled Item',
      units_sold: parseInt(row.units_sold, 10) || 0,
      revenue: Math.round((parseFloat(row.gross_revenue) || 0) * 100) / 100,
      revenueFormatted: formatLKR(row.gross_revenue),
    }));
  } catch (err) {
    logger.warn(`[ANALYTICS_SERVICE] getTopSellingProducts fallback notice: ${err.message}`);
    return [];
  }
};

/**
 * Retrieves inventory variants currently at or below the stock threshold.
 *
 * @param {number|string} [threshold=10]
 * @returns {Promise<Array<object>>}
 */
const getLowStockAlerts = async (threshold = 10) => {
  const stockLimit = Math.max(0, parseInt(threshold, 10) || 10);

  try {
    const variants = await ProductVariant.findAll({
      where: {
        stock_quantity: {
          [Op.lte]: stockLimit,
        },
      },
      include: [
        {
          model: Product,
          as: 'product',
          attributes: ['id', 'title', 'slug', 'base_price'],
        },
      ],
      order: [['stock_quantity', 'ASC']],
      limit: 50,
    });

    return variants.map((v) => ({
      variant_id: v.id,
      product_id: v.product_id,
      product_title: v.product ? v.product.title : 'Unknown Product',
      sku: v.sku,
      size: v.size,
      color: v.color,
      stock_quantity: v.stock_quantity,
      reserved_quantity: v.reserved_quantity,
      available_stock: Math.max(0, v.stock_quantity - (v.reserved_quantity || 0)),
      is_critically_low: v.stock_quantity <= 3,
    }));
  } catch (err) {
    logger.warn(`[ANALYTICS_SERVICE] getLowStockAlerts query notice: ${err.message}`);
    return [];
  }
};

module.exports = {
  calculateGrossRevenue,
  formatLKR,
  getOverviewMetrics,
  getSalesTrend,
  getTopSellingProducts,
  getLowStockAlerts,
};
