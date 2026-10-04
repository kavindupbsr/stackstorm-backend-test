const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const corsOptions = require('./config/cors');
const { authLimiter } = require('./middleware/rateLimiter');
const healthRoutes = require('./routes/health.routes');
const authRoutes = require('./routes/auth.routes');
const adminRoutes = require('./routes/admin.routes');
const inventoryRoutes = require('./routes/inventory.routes');
const categoryRoutes = require('./routes/category.routes');
const productRoutes = require('./routes/product.routes');
const notFoundHandler = require('./middleware/notFoundHandler');
const errorHandler = require('./middleware/errorHandler');
const ApiError = require('./utils/ApiError');

const app = express();

// Trust reverse proxy (Nginx, Docker Compose, Cloudflare) for accurate client IP rate limiting
app.set('trust proxy', 1);

// Security HTTP headers with explicit defense-in-depth policies
app.use(
  helmet({
    frameguard: { action: 'deny' },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
  })
);

// Strict CORS configuration
app.use(cors(corsOptions));

// Body parsing middlewares
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Mount API routes with tiered rate limiting
app.use('/api/v1/health', healthRoutes);
app.use('/api/v1/auth', authLimiter, authRoutes);
app.use('/api/v1/categories', categoryRoutes);
app.use('/api/v1/products', productRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/inventory', inventoryRoutes);

// Test routes for Shift-Left automated error handling validation
if (process.env.NODE_ENV !== 'production') {
  app.get('/api/v1/test-error/400', (req, res, next) => {
    next(
      ApiError.badRequest('Deliberate 400 Validation Error', [
        { field: 'email', message: 'Invalid email' },
      ])
    );
  });

  app.get('/api/v1/test-error/500', () => {
    throw new Error('Deliberate Unhandled Synchronous Exception');
  });
}

// 404 Catch-All Not Found Middleware
app.use(notFoundHandler);

// Centralized Global Error Handling Middleware
app.use(errorHandler);

module.exports = app;
