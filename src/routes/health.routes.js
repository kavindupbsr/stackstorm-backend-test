const express = require('express');
const { successResponse } = require('../utils/responseFormatter');
const { sequelize } = require('../models');

const router = express.Router();

/**
 * @route   GET /api/v1/health
 * @desc    System health, uptime, memory, database, and environment probe
 * @access  Public
 */
router.get('/', async (req, res) => {
  let dbStatus = 'disconnected';
  try {
    await sequelize.authenticate();
    dbStatus = 'connected';
  } catch (err) {
    dbStatus = 'disconnected';
  }

  const healthData = {
    service: 'stackstorm-backend',
    status: 'healthy',
    database: dbStatus,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    memoryUsage: {
      rss: `${Math.round(process.memoryUsage().rss / 1024 / 1024)} MB`,
      heapTotal: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)} MB`,
      heapUsed: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`,
    },
  };

  return successResponse(res, healthData, 'System is healthy and operational', 200);
});

module.exports = router;
