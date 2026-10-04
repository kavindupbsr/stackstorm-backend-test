/**
 * StackStorm CORS Configuration
 * Enforces cross-origin resource sharing policy against configured whitelist domains.
 * Whitelists FRONTEND_CUSTOMER_URL and FRONTEND_ADMIN_URL.
 */

const getOriginWhitelist = () => {
  const whitelist = [
    process.env.FRONTEND_CUSTOMER_URL || 'http://localhost:3000',
    process.env.FRONTEND_ADMIN_URL || 'http://localhost:3001',
    process.env.CLIENT_URL,
    process.env.ADMIN_URL,
  ];

  if (process.env.FRONTEND_URL) {
    whitelist.push(process.env.FRONTEND_URL);
  }

  if (process.env.CORS_WHITELIST) {
    whitelist.push(...process.env.CORS_WHITELIST.split(',').map((o) => o.trim()));
  }

  return whitelist.filter(Boolean);
};

const corsOptions = {
  origin: (origin, callback) => {
    // 1. Allow server-to-server, curl, Postman, mobile apps, or headless requests without Origin header
    if (!origin) {
      return callback(null, true);
    }

    const whitelist = getOriginWhitelist();

    // 2. Allow explicitly whitelisted frontend origins
    if (whitelist.includes(origin)) {
      return callback(null, true);
    }

    // 3. In local development or testing environments, permit localhost origins
    if (
      (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') &&
      /^http:\/\/localhost(:\d+)?$/.test(origin)
    ) {
      return callback(null, true);
    }

    // 4. Reject unauthorized origin (omitting Access-Control-Allow-Origin header)
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Retry-After', 'RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset'],
};

module.exports = corsOptions;
module.exports.corsOptions = corsOptions;
module.exports.getOriginWhitelist = getOriginWhitelist;
