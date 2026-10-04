const { logger } = require('../config/logger');
const { errorResponse } = require('../utils/responseFormatter');

/**
 * Centralized Global Error Handler Middleware
 * Intercepts all errors propagated via next(err) or thrown in Express handlers.
 * Logs structured diagnostic information via Winston and returns standardized JSON envelopes.
 */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  let errors = err.errors || [];

  // If unexpected system error in production, mask internal error details
  if (process.env.NODE_ENV === 'production' && !err.isOperational && statusCode === 500) {
    message = 'Internal Server Error';
    errors = [];
  }

  // Structured logging via Winston
  logger.error(err.message || 'Unhandled Application Error', {
    statusCode,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip || req.connection?.remoteAddress,
    isOperational: err.isOperational || false,
    stack: err.stack,
  });

  return errorResponse(res, message, errors, statusCode);
};

module.exports = errorHandler;
