const { verifyAccessToken } = require('../services/token.service');
const { logger } = require('../config/logger');

/**
 * Socket.IO authentication middleware.
 * Validates JWT access token in connection handshake auth or headers.
 * Attaches decoded identity payload to socket.user.
 *
 * @param {import('socket.io').Socket} socket
 * @param {Function} next
 */
const socketAuth = (socket, next) => {
  try {
    let token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization;

    if (!token) {
      return next(new Error('Authentication error: invalid token'));
    }

    if (typeof token === 'string' && token.startsWith('Bearer ')) {
      token = token.slice(7).trim();
    }

    if (!token) {
      return next(new Error('Authentication error: invalid token'));
    }

    const decoded = verifyAccessToken(token);

    // Attach decoded user claims to socket instance
    /* eslint-disable no-param-reassign */
    socket.user = decoded;
    /* eslint-enable no-param-reassign */

    return next();
  } catch (error) {
    logger.warn(`[WEBSOCKET] Authentication rejected for socket ${socket.id}: ${error.message}`);
    return next(new Error('Authentication error: invalid token'));
  }
};

module.exports = socketAuth;
