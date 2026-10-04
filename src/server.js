require('dotenv').config();
const http = require('http');
const app = require('./app');
const { logger } = require('./config/logger');
const { sequelize, connectWithRetry } = require('./models');

const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

// Start HTTP server listener and connect to database
if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, async () => {
    logger.info(
      `Server listening on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`
    );
    logger.info(`Healthcheck probe available at http://localhost:${PORT}/api/v1/health`);

    try {
      await connectWithRetry();
    } catch (err) {
      logger.error('[DATABASE] Critical: Failed to establish initial database connection', {
        error: err.message,
      });
    }
  });
}

// Graceful shutdown handling
const gracefulShutdown = (signal) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  server.close(async (err) => {
    if (err) {
      logger.error('Error during server close:', { error: err });
      process.exit(1);
    }

    try {
      await sequelize.close();
      logger.info('[DATABASE] Sequelize connection pool closed gracefully.');
    } catch (dbErr) {
      logger.error('Error closing database pool:', { error: dbErr.message });
    }

    logger.info('HTTP server closed gracefully.');
    process.exit(0);
  });

  // Force close after 10 seconds if hanging
  setTimeout(() => {
    logger.error('Forcing shutdown after timeout.');
    process.exit(1);
  }, 10000).unref();
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at Promise', { reason, promise });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception occurred', { error: error.message, stack: error.stack });
  process.exit(1);
});

module.exports = server;
