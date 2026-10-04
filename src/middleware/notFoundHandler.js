const ApiError = require('../utils/ApiError');

/**
 * 404 Catch-All Middleware
 * Forwards an ApiError.notFound for any unmatched routes.
 */
const notFoundHandler = (req, res, next) => {
  const message = `Resource not found: ${req.method} ${req.originalUrl}`;
  next(new ApiError(404, message));
};

module.exports = notFoundHandler;
