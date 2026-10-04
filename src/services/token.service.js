const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const redisClient = require('../config/redis');
const { User } = require('../models');
const ApiError = require('../utils/ApiError');

const ACCESS_TOKEN_SECRET =
  process.env.JWT_ACCESS_SECRET ||
  process.env.JWT_SECRET ||
  'stackstorm-jwt-secret-key-default-2026';
const REFRESH_TOKEN_SECRET = process.env.JWT_REFRESH_SECRET || 'stackstorm-jwt-refresh-secret-2026';

const ACCESS_TOKEN_EXPIRY = process.env.JWT_ACCESS_EXPIRES_IN || '1h';
const REFRESH_TOKEN_EXPIRY = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days in seconds

/**
 * Generates an HMAC-SHA256 JWT access token with standard claims.
 *
 * @param {object} user - User domain model instance or payload object
 * @returns {string} Signed JWT access token
 */
const generateAccessToken = (user) => {
  const payload = {
    sub: user.id,
    id: user.id,
    email: user.email,
    role: user.role,
  };

  return jwt.sign(payload, ACCESS_TOKEN_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
  });
};

/**
 * Generates a refresh token, saves it to Redis with 7-day TTL, and returns the signed token.
 *
 * @param {object} user - User domain model instance or payload object
 * @param {string} [tokenId=crypto.randomUUID()] - Unique ID representing this token instance
 * @returns {Promise<{ refreshToken: string, tokenId: string }>}
 */
const generateRefreshToken = async (user, tokenId = crypto.randomUUID()) => {
  const payload = {
    sub: user.id,
    id: user.id,
    tokenId,
    token_id: tokenId,
  };

  const refreshToken = jwt.sign(payload, REFRESH_TOKEN_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRY,
  });

  const redisKey = `refresh_token:${user.id}:${tokenId}`;
  await redisClient.setex(redisKey, REFRESH_TOKEN_TTL_SECONDS, 'valid');

  return { refreshToken, tokenId };
};

/**
 * Issues a complete token pair (access + refresh) for a user session.
 *
 * @param {object} user
 * @returns {Promise<{ accessToken: string, refreshToken: string }>}
 */
const generateTokenPair = async (user) => {
  const accessToken = generateAccessToken(user);
  const { refreshToken } = await generateRefreshToken(user);

  return {
    accessToken,
    refreshToken,
  };
};

/**
 * Verifies and decodes an access token.
 *
 * @param {string} token
 * @returns {object} Decoded token payload
 */
const verifyAccessToken = (token) => {
  try {
    return jwt.verify(token, ACCESS_TOKEN_SECRET);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw ApiError.unauthorized('Access token has expired');
    }
    throw ApiError.unauthorized('Invalid access token');
  }
};

/**
 * Verifies and decodes a refresh token.
 *
 * @param {string} token
 * @returns {object} Decoded refresh token payload
 */
const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, REFRESH_TOKEN_SECRET);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw ApiError.unauthorized('Refresh token has expired');
    }
    throw ApiError.unauthorized('Invalid refresh token');
  }
};

/**
 * Executes refresh token rotation:
 * Validates token signature, asserts existence in Redis, invalidates old token, and issues new pair.
 *
 * @param {string} oldRefreshToken
 * @returns {Promise<{ accessToken: string, refreshToken: string, user: object }>}
 */
const rotateRefreshToken = async (oldRefreshToken) => {
  const decoded = verifyRefreshToken(oldRefreshToken);
  const userId = decoded.sub || decoded.id;
  const tokenId = decoded.tokenId || decoded.token_id;

  const redisKey = `refresh_token:${userId}:${tokenId}`;
  const tokenState = await redisClient.get(redisKey);

  // If token is absent from Redis, token was already rotated or revoked
  if (!tokenState) {
    throw ApiError.unauthorized('Invalid or already rotated refresh token');
  }

  // Invalidate old token immediately to enforce single-use rotation
  await redisClient.del(redisKey);

  const user = await User.findByPk(userId);
  if (!user || !user.is_active) {
    throw ApiError.unauthorized('User not found or account is deactivated');
  }

  const newTokens = await generateTokenPair(user);

  const safeUser = user.toJSON ? user.toJSON() : { ...user };
  delete safeUser.password_hash;

  return {
    accessToken: newTokens.accessToken,
    refreshToken: newTokens.refreshToken,
    user: safeUser,
  };
};

/**
 * Revokes a refresh token from Redis (e.g. on logout).
 *
 * @param {string} refreshToken
 * @returns {Promise<boolean>}
 */
const revokeRefreshToken = async (refreshToken) => {
  try {
    const decoded = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET);
    const userId = decoded.sub || decoded.id;
    const tokenId = decoded.tokenId || decoded.token_id;

    if (userId && tokenId) {
      const redisKey = `refresh_token:${userId}:${tokenId}`;
      await redisClient.del(redisKey);
      return true;
    }
    return false;
  } catch {
    // If token is already invalid, no further action required
    return false;
  }
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  generateTokenPair,
  verifyAccessToken,
  verifyRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  ACCESS_TOKEN_SECRET,
  REFRESH_TOKEN_SECRET,
};
