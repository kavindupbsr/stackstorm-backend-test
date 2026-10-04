const express = require('express');
const { successResponse } = require('../utils/responseFormatter');

const router = express.Router();

/**
 * @route   GET /api/v1/health
 * @desc    System health, uptime, memory, and environment probe
 * @access  Public
 */
router.get('/', (req, res) => {
  const healthData = {
    service: 'stackstorm-backend',
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    memoryUsage: {
      rss: `${Math.round(process.memoryUsage().rss / 1024 / 1024)} MB`,
      heapTotal: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)} MB`,
      heapUsed: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`
    }
  };

  return successResponse(res, healthData, 'System is healthy and operational', 200);
});

module.exports = router;
