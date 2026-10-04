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
const uploadRoutes = require('./routes/upload.routes');
const cartRoutes = require('./routes/cart.routes');
const checkoutRoutes = require('./routes/checkout.routes');
const wishlistRoutes = require('./routes/wishlist.routes');
const paymentRoutes = require('./routes/payment.routes');
const orderRoutes = require('./routes/order.routes');
const { successResponse } = require('./utils/responseFormatter');
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

// Body parsing middlewares with raw buffer preservation for Stripe webhook verification
app.use(
  express.json({
    limit: '10mb',
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// API Root Discovery endpoint
app.get(['/', '/api/v1'], (req, res) => {
  return successResponse(
    res,
    {
      name: 'StackStorm E-Commerce REST API',
      version: '1.0.0',
      description: 'Dickwella Fashion Corner Enterprise E-Commerce Platform',
      environment: process.env.NODE_ENV || 'development',
      endpoints: {
        health: '/api/v1/health',
        auth: '/api/v1/auth',
        categories: '/api/v1/categories',
        products: '/api/v1/products',
        cart: '/api/v1/cart',
        checkout: '/api/v1/checkout',
        inventory: '/api/v1/inventory',
        wishlist: '/api/v1/wishlist',
        payments: '/api/v1/payments',
        orders: '/api/v1/orders',
        admin: '/api/v1/admin',
        upload: '/api/v1/upload/images',
      },
    },
    'Welcome to StackStorm API v1'
  );
});

// Mount API routes with tiered rate limiting
app.use('/api/v1/health', healthRoutes);
app.use('/api/v1/auth', authLimiter, authRoutes);
app.use('/api/v1/categories', categoryRoutes);
app.use('/api/v1/products', productRoutes);
app.use('/api/v1/cart', cartRoutes);
app.use('/api/v1/checkout', checkoutRoutes);
app.use('/api/v1/wishlist', wishlistRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/orders', orderRoutes);
app.use('/api/v1/upload', uploadRoutes);
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
