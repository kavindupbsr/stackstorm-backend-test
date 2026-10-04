const { verifyAccessToken } = require('../services/token.service');
const ApiError = require('../utils/ApiError');

/**
 * Express middleware protecting endpoints via JWT access token authentication.
 * Verifies Authorization: Bearer <token> header and binds decoded identity to req.user.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
const authenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(ApiError.unauthorized('Authentication token is required'));
    }

    const token = authHeader.substring(7).trim();
    if (!token) {
      return next(ApiError.unauthorized('Authentication token is required'));
    }

    const decoded = verifyAccessToken(token);
    req.user = decoded;
    return next();
  } catch (error) {
    return next(error);
  }
};

module.exports = authenticate;
