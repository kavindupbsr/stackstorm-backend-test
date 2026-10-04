const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const healthRoutes = require('./routes/health.routes');
const notFoundHandler = require('./middleware/notFoundHandler');
const errorHandler = require('./middleware/errorHandler');
const ApiError = require('./utils/ApiError');

const app = express();

// Security HTTP headers
app.use(helmet());

// CORS configuration
const allowedOrigins = [
  process.env.CLIENT_URL || 'http://localhost:3000',
  process.env.ADMIN_URL || 'http://localhost:3001',
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g., mobile apps, curl, postman) or matching origins
      if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV === 'development') {
        return callback(null, true);
      }
      return callback(new Error('Blocked by CORS policy'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })
);

// Body parsing middlewares
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Mount API routes
app.use('/api/v1/health', healthRoutes);

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
