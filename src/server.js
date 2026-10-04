require('dotenv').config();
const http = require('http');
const app = require('./app');

const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

// Start HTTP server listener
if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, () => {
    console.log(`[StackStorm Backend] Server listening on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
    console.log(`[StackStorm Backend] Healthcheck probe available at http://localhost:${PORT}/api/v1/health`);
  });
}

// Graceful shutdown handling
const gracefulShutdown = (signal) => {
  console.log(`\n[StackStorm Backend] Received ${signal}. Starting graceful shutdown...`);
  server.close((err) => {
    if (err) {
      console.error('[StackStorm Backend] Error during server close:', err);
      process.exit(1);
    }
    console.log('[StackStorm Backend] HTTP server closed gracefully.');
    process.exit(0);
  });

  // Force close after 10 seconds if hanging
  setTimeout(() => {
    console.error('[StackStorm Backend] Forcing shutdown after timeout.');
    process.exit(1);
  }, 10000).unref();
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason, promise) => {
  console.error('[StackStorm Backend] Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('[StackStorm Backend] Uncaught Exception:', error);
  process.exit(1);
});

module.exports = server;
