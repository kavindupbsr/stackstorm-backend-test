const http = require('http');
const { io: ioClient } = require('socket.io-client');
const jwt = require('jsonwebtoken');
const { initSocketServer, closeSocketServer, getIO } = require('../../src/websocket/socketServer');
const { generateAccessToken } = require('../../src/services/token.service');

describe('Socket.IO Infrastructure & JWT Auth Integration Tests', () => {
  let server;
  let port;
  let io;
  const activeClients = [];

  const customerUser = {
    id: 'c1111111-2222-3333-4444-555555555551',
    email: 'customer@dickwella.lk',
    role: 'customer',
  };

  const supportAgentUser = {
    id: 's2222222-3333-4444-5555-666666666662',
    email: 'support@dickwella.lk',
    role: 'support_agent',
  };

  beforeAll((done) => {
    server = http.createServer();
    io = initSocketServer(server);
    server.listen(0, () => {
      port = server.address().port;
      done();
    });
  });

  afterEach(() => {
    while (activeClients.length > 0) {
      const client = activeClients.pop();
      if (client && client.connected) {
        client.disconnect();
      }
    }
  });

  afterAll(async () => {
    await closeSocketServer();
    await new Promise((resolve) => {
      server.close(resolve);
    });
  });

  const createClient = (token, options = {}) => {
    const client = ioClient(`http://localhost:${port}`, {
      auth: token ? { token } : undefined,
      transports: ['websocket'],
      reconnection: false,
      timeout: 5000,
      ...options,
    });
    activeClients.push(client);
    return client;
  };

  it('AC1 & AC2: should connect successfully with valid customer JWT and join user and role rooms', (done) => {
    const token = generateAccessToken(customerUser);
    const client = createClient(token);

    client.on('connect', () => {
      expect(client.connected).toBe(true);

      const serverSocket = io.sockets.sockets.get(client.id);
      expect(serverSocket).toBeDefined();
      expect(serverSocket.user).toBeDefined();
      expect(serverSocket.user.id).toBe(customerUser.id);
      expect(serverSocket.user.role).toBe('customer');

      // Assert room memberships
      expect(serverSocket.rooms.has(`user:${customerUser.id}`)).toBe(true);
      expect(serverSocket.rooms.has('role:customer')).toBe(true);
      done();
    });

    client.on('connect_error', (err) => {
      done(err);
    });
  });

  it('AC2: should join role:support_agent room when support agent connects', (done) => {
    const token = generateAccessToken(supportAgentUser);
    const client = createClient(token);

    client.on('connect', () => {
      expect(client.connected).toBe(true);

      const serverSocket = io.sockets.sockets.get(client.id);
      expect(serverSocket).toBeDefined();
      expect(serverSocket.rooms.has(`user:${supportAgentUser.id}`)).toBe(true);
      expect(serverSocket.rooms.has('role:support_agent')).toBe(true);
      done();
    });

    client.on('connect_error', (err) => {
      done(err);
    });
  });

  it('AC3: should reject connection with invalid token with expected error message', (done) => {
    const client = createClient('invalid.malformed.token');

    client.on('connect', () => {
      done(new Error('Connection should not have succeeded with invalid token'));
    });

    client.on('connect_error', (err) => {
      expect(err.message).toBe('Authentication error: invalid token');
      expect(client.connected).toBe(false);
      done();
    });
  });

  it('AC3: should reject connection with expired token', (done) => {
    const expiredToken = jwt.sign(
      { sub: customerUser.id, id: customerUser.id, role: customerUser.role },
      process.env.JWT_SECRET || 'stackstorm-jwt-secret-key-default-2026',
      { expiresIn: '-1s' }
    );
    const client = createClient(expiredToken);

    client.on('connect', () => {
      done(new Error('Connection should not have succeeded with expired token'));
    });

    client.on('connect_error', (err) => {
      expect(err.message).toBe('Authentication error: invalid token');
      expect(client.connected).toBe(false);
      done();
    });
  });

  it('AC3: should reject connection when no auth token is provided', (done) => {
    const client = createClient(null);

    client.on('connect', () => {
      done(new Error('Connection should not have succeeded without auth token'));
    });

    client.on('connect_error', (err) => {
      expect(err.message).toBe('Authentication error: invalid token');
      expect(client.connected).toBe(false);
      done();
    });
  });

  it('should expose getIO() singleton providing active Socket.IO server', () => {
    const activeIO = getIO();
    expect(activeIO).toBeDefined();
    expect(typeof activeIO.on).toBe('function');
    expect(typeof activeIO.emit).toBe('function');
  });
});
