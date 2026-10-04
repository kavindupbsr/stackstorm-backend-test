const redisClient = require('../config/redis');
const { logger } = require('../config/logger');

/**
 * Retrieves and deserializes a value from Redis cache.
 *
 * @param {string} key - Cache key
 * @returns {Promise<any|null>} Deserialized data or null on miss/error
 */
const get = async (key) => {
  try {
    const raw = await redisClient.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  } catch (err) {
    logger.warn(`Redis get error for key "${key}": ${err.message}`);
    return null;
  }
};

/**
 * Serializes and stores a value in Redis with a TTL in seconds.
 *
 * @param {string} key - Cache key
 * @param {any} value - Data to cache
 * @param {number} [ttlSeconds=3600] - Expiration in seconds (default 1 hour)
 * @returns {Promise<boolean>}
 */
const set = async (key, value, ttlSeconds = 3600) => {
  try {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    if (ttlSeconds && ttlSeconds > 0) {
      await redisClient.set(key, serialized, 'EX', ttlSeconds);
    } else {
      await redisClient.set(key, serialized);
    }
    return true;
  } catch (err) {
    logger.warn(`Redis set error for key "${key}": ${err.message}`);
    return false;
  }
};

/**
 * Deletes a single key or array of keys from Redis.
 *
 * @param {string|string[]} key - Key or keys to delete
 * @returns {Promise<number>} Number of keys removed
 */
const del = async (key) => {
  try {
    return await redisClient.del(key);
  } catch (err) {
    logger.warn(`Redis del error for key(s) "${key}": ${err.message}`);
    return 0;
  }
};

/**
 * Cache-Aside pattern helper: attempts cache read, falling back to fetcherFn on miss.
 *
 * @param {string} key - Cache key
 * @param {number} ttlSeconds - Cache TTL in seconds
 * @param {Function} fetcherFn - Async function providing fresh data on miss
 * @returns {Promise<any>}
 */
const getOrSet = async (key, ttlSeconds, fetcherFn) => {
  try {
    const cached = await get(key);
    if (cached !== null && cached !== undefined) {
      return cached;
    }
  } catch (err) {
    logger.warn(`Cache-Aside read miss for key "${key}": ${err.message}`);
  }

  const fresh = await fetcherFn();
  if (fresh !== null && fresh !== undefined) {
    await set(key, fresh, ttlSeconds);
  }
  return fresh;
};

/**
 * Non-blocking cache eviction: scans and removes keys matching a wildcard pattern.
 * Uses Redis SCAN cursor with chunk size 100 to prevent event loop blocking.
 *
 * @param {string} pattern - Glob-style key pattern (e.g., 'cache:products:*')
 * @returns {Promise<number>} Total count of purged keys
 */
const invalidatePattern = async (pattern) => {
  let cursor = '0';
  let totalDeleted = 0;

  try {
    do {
      // Redis SCAN cursor progression is inherently sequential
      // eslint-disable-next-line no-await-in-loop
      const result = await redisClient.scan(cursor, 'MATCH', pattern, 'COUNT', 100);

      if (!result || !Array.isArray(result) || result.length < 2) {
        break;
      }

      const [nextCursor, keys] = result;
      cursor = nextCursor;

      if (keys && keys.length > 0) {
        // eslint-disable-next-line no-await-in-loop
        const deleted = await redisClient.del(keys);
        totalDeleted += typeof deleted === 'number' ? deleted : keys.length;
      }
    } while (cursor !== '0');

    logger.info(`Invalidated cache pattern "${pattern}": evicted ${totalDeleted} key(s)`);
    return totalDeleted;
  } catch (err) {
    logger.error(`Failed to invalidate cache pattern "${pattern}": ${err.message}`);
    return totalDeleted;
  }
};

module.exports = {
  get,
  set,
  del,
  getOrSet,
  invalidatePattern,
  invalidate: invalidatePattern,
};
