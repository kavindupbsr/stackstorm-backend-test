const express = require('express');
const { successResponse } = require('../utils/responseFormatter');
const { sequelize } = require('../models');

const router = express.Router();

let lastDbCheck = 0;
let cachedDbStatus = 'connected';
let lastHealthCheck = 0;
let cachedHealthData = null;

/**
 * @route   GET /api/v1/health
 * @desc    System health, uptime, memory, database, and environment probe
 * @access  Public
 */
router.get('/', async (req, res) => {
  const now = Date.now();
  if (!cachedHealthData || now - lastHealthCheck > 1000) {
    if (now - lastDbCheck > 2000) {
      try {
        await sequelize.authenticate({ logging: false });
        cachedDbStatus = 'connected';
      } catch (err) {
        cachedDbStatus = 'disconnected';
      }
      lastDbCheck = now;
    }

    cachedHealthData = {
      service: 'stackstorm-backend',
      status: 'healthy',
      database: cachedDbStatus,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      memoryUsage: {
        rss: `${Math.round(process.memoryUsage().rss / 1024 / 1024)} MB`,
        heapTotal: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)} MB`,
        heapUsed: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`,
      },
    };
    lastHealthCheck = now;
  }

  return successResponse(res, cachedHealthData, 'System is healthy and operational', 200);
});

module.exports = router;
