const Redis = require('ioredis');
const { logger } = require('./logger');

const redisHost = process.env.REDIS_HOST || 'localhost';
const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);
const redisPassword = process.env.REDIS_PASSWORD || undefined;

const inMemoryStore = new Map();

const inMemoryClient = {
  isMock: true,
  status: 'ready',
  get: async (key) => inMemoryStore.get(key) || null,
  set: async (key, value, _mode, _duration) => {
    inMemoryStore.set(key, String(value));
    return 'OK';
  },
  setex: async (key, _seconds, value) => {
    inMemoryStore.set(key, String(value));
    return 'OK';
  },
  incr: async (key) => {
    const current = parseInt(inMemoryStore.get(key) || '0', 10);
    const updated = current + 1;
    inMemoryStore.set(key, String(updated));
    return updated;
  },
  ttl: async (key) => {
    return inMemoryStore.has(key) ? 900 : -2;
  },
  expire: async (key, _seconds) => {
    return inMemoryStore.has(key) ? 1 : 0;
  },
  del: async (key) => {
    if (Array.isArray(key)) {
      let count = 0;
      key.forEach((k) => {
        if (inMemoryStore.delete(k)) count += 1;
      });
      return count;
    }
    const existed = inMemoryStore.has(key);
    inMemoryStore.delete(key);
    return existed ? 1 : 0;
  },
  scan: async (cursor, matchOption, pattern) => {
    let pat = pattern;
    if (matchOption && typeof matchOption === 'string' && matchOption.toLowerCase() === 'match') {
      pat = pattern;
    } else if (typeof matchOption === 'string') {
      pat = matchOption;
    }
    const escaped = (pat || '*').replace(/([.+?^=!:${}()|[\]/\\])/g, '\\$1').replace(/\*/g, '.*');
    const regex = new RegExp(`^${escaped}$`);
    const matched = [];
    for (const key of inMemoryStore.keys()) {
      if (regex.test(key)) {
        matched.push(key);
      }
    }
    return ['0', matched];
  },
  keys: async (pattern) => {
    const escaped = (pattern || '*')
      .replace(/([.+?^=!:${}()|[\]/\\])/g, '\\$1')
      .replace(/\*/g, '.*');
    const regex = new RegExp(`^${escaped}$`);
    return Array.from(inMemoryStore.keys()).filter((k) => regex.test(k));
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

let realClient = null;
let isConnected = false;

if (process.env.NODE_ENV !== 'test' || process.env.USE_REAL_REDIS === 'true') {
  try {
    realClient = new Redis({
      host: redisHost,
      port: redisPort,
      password: redisPassword,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      retryStrategy: (times) => {
        if (times > 3) return null;
        return Math.min(times * 100, 1000);
      },
      lazyConnect: true,
    });

    realClient.on('connect', () => {
      isConnected = true;
      logger.info(`Redis client connected to ${redisHost}:${redisPort}`);
    });

    realClient.on('error', (err) => {
      isConnected = false;
      logger.warn(`Redis connection warning: ${err.message}. Falling back to memory store.`);
    });
  } catch (err) {
    logger.warn(`Redis initialization error: ${err.message}. Falling back to memory store.`);
  }
}

// Resilient Proxy: delegates to realClient when connected, otherwise fails open/gracefully to in-memory store
const redisClient = new Proxy(inMemoryClient, {
  get(target, prop) {
    if (isConnected && realClient && typeof realClient[prop] === 'function') {
      return async (...args) => {
        try {
          return await realClient[prop](...args);
        } catch {
          return target[prop](...args);
        }
      };
    }
    return target[prop];
  },
});

module.exports = redisClient;
