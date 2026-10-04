const redisClient = require('../config/redis');

const MAX_FAILED_ATTEMPTS = parseInt(process.env.LOCKOUT_MAX_ATTEMPTS || '5', 10);
const LOCKOUT_DURATION_SECONDS = parseInt(process.env.LOCKOUT_DURATION_SECONDS || '900', 10); // 15 mins
const ATTEMPTS_WINDOW_SECONDS = parseInt(process.env.LOCKOUT_WINDOW_SECONDS || '900', 10);

const getLockoutKey = (email) => `lockout:${email.toLowerCase().trim()}`;
const getFailedAttemptsKey = (email) => `failed_login:${email.toLowerCase().trim()}`;

/**
 * Checks whether an account is currently locked out in Redis.
 *
 * @param {string} email
 * @returns {Promise<{ isLocked: boolean, remainingSeconds: number, remainingMinutes: number }>}
 */
const isLocked = async (email) => {
  if (!email) {
    return { isLocked: false, remainingSeconds: 0, remainingMinutes: 0 };
  }

  const key = getLockoutKey(email);
  const lockExists = await redisClient.get(key);

  if (lockExists) {
    let remainingSeconds = await redisClient.ttl(key);
    if (!remainingSeconds || remainingSeconds <= 0) {
      remainingSeconds = LOCKOUT_DURATION_SECONDS;
    }
    const remainingMinutes = Math.ceil(remainingSeconds / 60);

    return {
      isLocked: true,
      remainingSeconds,
      remainingMinutes,
    };
  }

  return {
    isLocked: false,
    remainingSeconds: 0,
    remainingMinutes: 0,
  };
};

/**
 * Records a failed login attempt for the specified email.
 * On reaching MAX_FAILED_ATTEMPTS (5), immediately locks the account for 15 minutes.
 *
 * @param {string} email
 * @returns {Promise<{ isLocked: boolean, attempts: number, remainingAttempts?: number, remainingSeconds?: number, remainingMinutes?: number }>}
 */
const recordFailedAttempt = async (email) => {
  if (!email) {
    return { isLocked: false, attempts: 0 };
  }

  const normalized = email.toLowerCase().trim();
  const currentlyLocked = await isLocked(normalized);
  if (currentlyLocked.isLocked) {
    return currentlyLocked;
  }

  const failedKey = getFailedAttemptsKey(normalized);
  const attempts = await redisClient.incr(failedKey);

  // Set expiration window on first increment
  if (attempts === 1) {
    await redisClient.expire(failedKey, ATTEMPTS_WINDOW_SECONDS);
  }

  // Enforce lockout on reaching max attempts
  if (attempts >= MAX_FAILED_ATTEMPTS) {
    const lockoutKey = getLockoutKey(normalized);
    await redisClient.setex(lockoutKey, LOCKOUT_DURATION_SECONDS, '1');
    await redisClient.del(failedKey);

    return {
      isLocked: true,
      attempts,
      remainingSeconds: LOCKOUT_DURATION_SECONDS,
      remainingMinutes: Math.ceil(LOCKOUT_DURATION_SECONDS / 60),
    };
  }

  return {
    isLocked: false,
    attempts,
    remainingAttempts: Math.max(0, MAX_FAILED_ATTEMPTS - attempts),
  };
};

/**
 * Resets the failed login attempts counter and removes lockout for an account (e.g., on successful login).
 *
 * @param {string} email
 * @returns {Promise<boolean>}
 */
const resetFailedAttempts = async (email) => {
  if (!email) return false;

  const normalized = email.toLowerCase().trim();
  const failedKey = getFailedAttemptsKey(normalized);
  const lockoutKey = getLockoutKey(normalized);

  await Promise.all([redisClient.del(failedKey), redisClient.del(lockoutKey)]);

  return true;
};

module.exports = {
  isLocked,
  recordFailedAttempt,
  resetFailedAttempts,
  MAX_FAILED_ATTEMPTS,
  LOCKOUT_DURATION_SECONDS,
};
