const { Server } = require('socket.io');
const corsOptions = require('../config/cors');
const { logger } = require('../config/logger');
const socketAuth = require('./socketAuth');
const registerChatHandlers = require('./chatHandler');

let io = null;

/**
 * Initializes Socket.IO server on top of existing HTTP server.
 *
 * @param {import('http').Server} httpServer
 * @param {object} [customOptions={}]
 * @returns {Server} Initialized Socket.IO Server instance
 */
const initSocketServer = (httpServer, customOptions = {}) => {
  if (io) {
    return io;
  }

  const defaultOptions = {
    cors: {
      origin: corsOptions.origin,
      credentials: true,
      methods: ['GET', 'POST'],
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    ...customOptions,
  };

  io = new Server(httpServer, defaultOptions);

  // Enforce JWT handshake authentication
  io.use(socketAuth);

  // Connection event handler
  io.on('connection', (socket) => {
    const { user } = socket;

    logger.info(`[WEBSOCKET] Client connected: ${socket.id} (user: ${user?.id}, role: ${user?.role})`);

    // Partition socket into specific personal and role rooms
    if (user?.id) {
      const userRoom = `user:${user.id}`;
      socket.join(userRoom);
      logger.debug(`[WEBSOCKET] Socket ${socket.id} joined room ${userRoom}`);
    }

    if (user?.role) {
      const roleRoom = `role:${user.role}`;
      socket.join(roleRoom);
      logger.debug(`[WEBSOCKET] Socket ${socket.id} joined room ${roleRoom}`);
    }

    // Register live chat event listeners
    registerChatHandlers(io, socket);

    socket.on('disconnect', (reason) => {
      logger.info(`[WEBSOCKET] Client disconnected: ${socket.id} (reason: ${reason})`);
    });
  });

  logger.info('[WEBSOCKET] Socket.IO server initialized successfully');
  return io;
};

/**
 * Returns active Socket.IO server instance.
 *
 * @returns {Server}
 */
const getIO = () => {
  if (!io) {
    throw new Error('Socket.IO has not been initialized. Call initSocketServer(server) first.');
  }
  return io;
};

/**
 * Closes active Socket.IO server and resets singleton.
 *
 * @returns {Promise<void>}
 */
const closeSocketServer = () => {
  return new Promise((resolve) => {
    if (io) {
      io.close(() => {
        io = null;
        logger.info('[WEBSOCKET] Socket.IO server closed');
        resolve();
      });
    } else {
      resolve();
    }
  });
};

module.exports = {
  initSocketServer,
  getIO,
  closeSocketServer,
};
