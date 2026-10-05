const redisClient = require('../config/redis');
const { logger } = require('../config/logger');

// Tier-1 In-Memory L1 Cache with LRU-style eviction and 5-second burst TTL
const l1Cache = new Map();
const L1_MAX_ITEMS = 500;
const L1_TTL_MS = 5000;

/**
 * Retrieves and deserializes a value from L1/L2 Redis cache.
 *
 * @param {string} key - Cache key
 * @returns {Promise<any|null>} Deserialized data or null on miss/error
 */
const get = async (key) => {
  const l1Entry = l1Cache.get(key);
  if (l1Entry && Date.now() - l1Entry.timestamp < L1_TTL_MS) {
    return l1Entry.value;
  }

  try {
    const raw = await redisClient.get(key);
    if (!raw) return null;
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = raw;
    }

    if (l1Cache.size >= L1_MAX_ITEMS) {
      const oldestKey = l1Cache.keys().next().value;
      l1Cache.delete(oldestKey);
    }
    l1Cache.set(key, { value: parsed, timestamp: Date.now() });

    return parsed;
  } catch (err) {
    logger.warn(`Redis get error for key "${key}": ${err.message}`);
    return null;
  }
};

/**
 * Serializes and stores a value in L1 memory and L2 Redis with a TTL in seconds.
 *
 * @param {string} key - Cache key
 * @param {any} value - Data to cache
 * @param {number} [ttlSeconds=3600] - Expiration in seconds (default 1 hour)
 * @returns {Promise<boolean>}
 */
const set = async (key, value, ttlSeconds = 3600) => {
  try {
    if (l1Cache.size >= L1_MAX_ITEMS) {
      const oldestKey = l1Cache.keys().next().value;
      l1Cache.delete(oldestKey);
    }
    l1Cache.set(key, { value, timestamp: Date.now() });

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
 * Deletes a single key or array of keys from L1 memory and L2 Redis.
 *
 * @param {string|string[]} key - Key or keys to delete
 * @returns {Promise<number>} Number of keys removed
 */
const del = async (key) => {
  if (Array.isArray(key)) {
    key.forEach((k) => l1Cache.delete(k));
  } else {
    l1Cache.delete(key);
  }

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
  // Purge matching keys from L1 in-memory cache
  try {
    const regexPattern = new RegExp(`^${pattern.replace(/\*/g, '.*')}$`);
    for (const k of l1Cache.keys()) {
      if (regexPattern.test(k)) {
        l1Cache.delete(k);
      }
    }
  } catch (err) {
    l1Cache.clear();
  }

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

/**
 * Invalidates single product cache keys and all product catalog query patterns.
 *
 * @param {string} [productId] - Product UUID
 * @returns {Promise<void>}
 */
const invalidateProductCaches = async (productId = null) => {
  if (productId) {
    await del(`cache:product:${productId}`);
  }
  await invalidatePattern('cache:product:*');
  await invalidatePattern('cache:products:*');
};

module.exports = {
  get,
  set,
  del,
  getOrSet,
  invalidatePattern,
  invalidate: invalidatePattern,
  invalidateProductCaches,
};
