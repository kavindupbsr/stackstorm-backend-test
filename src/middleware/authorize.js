const { errorResponse } = require('../utils/responseFormatter');

/**
 * Role-Based Access Control (RBAC) Authorization Middleware Factory.
 * Higher-order middleware that restricts endpoint access to specified user roles.
 *
 * @param {...(string|string[])} allowedRoles - Single role, comma-separated roles, or array of allowed roles
 * @returns {import('express').RequestHandler} Express middleware handler
 *
 * @example
 * // Single role
 * router.get('/metrics', authenticate, authorize(ROLES.ADMIN), adminController.getMetrics);
 *
 * // Multiple roles
 * router.patch('/stock', authenticate, authorize(ROLES.ADMIN, ROLES.INVENTORY), inventoryController.adjustStock);
 */
const authorize = (...allowedRoles) => {
  const roles = allowedRoles.flat();

  return (req, res, next) => {
    // 1. Guard against unauthenticated requests (missing req.user from authenticate middleware)
    if (!req.user) {
      return errorResponse(res, 'Authentication required', [], 401);
    }

    // 2. Guard against missing or unauthorized roles
    const userRole = req.user.role;
    if (!userRole || !roles.includes(userRole)) {
      return errorResponse(res, 'Access denied: insufficient permissions', [], 403);
    }

    // 3. User is authenticated and possesses an authorized role
    return next();
  };
};

module.exports = authorize;
module.exports.authorize = authorize;
