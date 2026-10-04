const { rateLimit, MemoryStore } = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const redisClient = require('../config/redis');
const { errorResponse } = require('../utils/responseFormatter');

/**
 * Creates a rate limiter instance with optional RedisStore or fallback MemoryStore.
 *
 * @param {object} options
 * @param {number} options.windowMs - Time window in milliseconds
 * @param {number} options.max - Maximum number of connections per window
 * @param {string} options.message - Human-readable rejection message
 * @param {string} options.prefix - Key prefix in Redis
 * @returns {import('express').RequestHandler} Express rate limit middleware
 */
const createLimiter = ({ windowMs, max, message, prefix }) => {
  let store;

  // Use RedisStore when running in production/development with active Redis
  if (process.env.NODE_ENV !== 'test' && !redisClient.isMock) {
    try {
      store = new RedisStore({
        sendCommand: (...args) => redisClient.call(...args),
        prefix: `rl:${prefix}:`,
      });
    } catch {
      store = new MemoryStore();
    }
  } else {
    store = new MemoryStore();
  }

  return rateLimit({
    windowMs,
    limit: max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    validate: { xForwardedForHeader: false },
    store,
    skip: (req) => {
      // In automated test runs, skip rate limiting unless explicitly testing the rate limiter
      if (process.env.NODE_ENV === 'test') {
        return process.env.TEST_RATE_LIMIT !== 'true' && req.headers['x-test-rate-limit'] !== 'true';
      }
      return false;
    },
    handler: (req, res, _next, options) => {
      const retryAfter = res.getHeader('Retry-After') || Math.ceil(windowMs / 1000);
      return errorResponse(
        res,
        message || options.message,
        [
          {
            field: 'rateLimit',
            message: 'Request quota exceeded for this IP address.',
            retryAfterSeconds: Number(retryAfter),
            maxRequests: max,
            windowMinutes: Math.ceil(windowMs / 60000),
          },
        ],
        429
      );
    },
  });
};

/**
 * Strict rate limiter for sensitive authentication endpoints (5 requests per 15 minutes)
 */
const authLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many authentication attempts. Please try again after 15 minutes.',
  prefix: 'auth',
});

/**
 * Read rate limiter for querying public and read-only endpoints (500 requests per 15 minutes)
 */
const readLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: 'Read request rate limit exceeded. Please try again later.',
  prefix: 'read',
});

/**
 * Write rate limiter for mutating operations (30 requests per 15 minutes)
 */
const writeLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: 'Write request rate limit exceeded. Please try again later.',
  prefix: 'write',
});

module.exports = {
  authLimiter,
  readLimiter,
  writeLimiter,
  createLimiter,
  RedisStore,
};
