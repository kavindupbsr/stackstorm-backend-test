const { verifyAccessToken } = require('../services/token.service');

/**
 * Optional authentication middleware:
 * If an Authorization: Bearer <token> header is present and valid,
 * populates req.user. If absent or invalid, leaves req.user = null
 * and continues execution for anonymous guest flows.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
const optionalAuthenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7).trim();
      if (token) {
        try {
          const decoded = verifyAccessToken(token);
          req.user = decoded;
        } catch {
          // Token is invalid/expired; treat as unauthenticated guest
          req.user = null;
        }
      }
    }
  } catch {
    req.user = null;
  }
  return next();
};

module.exports = optionalAuthenticate;
