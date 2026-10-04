const Redis = require('ioredis');
const { logger } = require('./logger');

const redisHost = process.env.REDIS_HOST || 'localhost';
const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);
const redisPassword = process.env.REDIS_PASSWORD || undefined;

let redisClient;
const inMemoryStore = new Map();

if (process.env.NODE_ENV === 'test' && process.env.USE_REAL_REDIS !== 'true') {
  // Ultra-fast in-memory adapter for Shift-Left automated testing
  redisClient = {
    isMock: true,
    status: 'ready',
    get: async (key) => inMemoryStore.get(key) || null,
    set: async (key, value) => {
      inMemoryStore.set(key, String(value));
      return 'OK';
    },
    setex: async (key, seconds, value) => {
      inMemoryStore.set(key, String(value));
      return 'OK';
    },
    del: async (key) => {
      const existed = inMemoryStore.has(key);
      inMemoryStore.delete(key);
      return existed ? 1 : 0;
    },
    quit: async () => {
      inMemoryStore.clear();
      return 'OK';
    },
    disconnect: () => {
      inMemoryStore.clear();
    },
    on: () => {},
  };
} else {
  redisClient = new Redis({
    host: redisHost,
    port: redisPort,
    password: redisPassword,
    maxRetriesPerRequest: 1,
    retryStrategy: (times) => {
      if (times > 3) {
        return null; // Stop retrying after 3 attempts
      }
      return Math.min(times * 100, 1000);
    },
    lazyConnect: true,
  });

  redisClient.on('connect', () => {
    logger.info(`Redis client connected to ${redisHost}:${redisPort}`);
  });

  redisClient.on('error', (err) => {
    logger.warn(`Redis connection warning: ${err.message}`);
  });
}

module.exports = redisClient;
