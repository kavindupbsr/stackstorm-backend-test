const jwt = require('jsonwebtoken');
const socketAuth = require('../../../src/websocket/socketAuth');
const { generateAccessToken } = require('../../../src/services/token.service');

describe('SocketAuth Middleware Unit Tests', () => {
  const mockUser = {
    id: 'b84c8fb2-1111-4222-9333-000000000001',
    email: 'customer@dickwella.lk',
    role: 'customer',
  };

  it('should accept valid JWT token in handshake auth and bind socket.user', (done) => {
    const validToken = generateAccessToken(mockUser);
    const mockSocket = {
      id: 'test-socket-001',
      handshake: {
        auth: { token: validToken },
        headers: {},
      },
    };

    socketAuth(mockSocket, (err) => {
      expect(err).toBeUndefined();
      expect(mockSocket.user).toBeDefined();
      expect(mockSocket.user.id).toBe(mockUser.id);
      expect(mockSocket.user.role).toBe(mockUser.role);
      done();
    });
  });

  it('should accept valid JWT token in handshake authorization header with Bearer prefix', (done) => {
    const validToken = generateAccessToken(mockUser);
    const mockSocket = {
      id: 'test-socket-002',
      handshake: {
        auth: {},
        headers: {
          authorization: `Bearer ${validToken}`,
        },
      },
    };

    socketAuth(mockSocket, (err) => {
      expect(err).toBeUndefined();
      expect(mockSocket.user).toBeDefined();
      expect(mockSocket.user.id).toBe(mockUser.id);
      done();
    });
  });

  it('should reject connection when token is completely missing', (done) => {
    const mockSocket = {
      id: 'test-socket-003',
      handshake: {
        auth: {},
        headers: {},
      },
    };

    socketAuth(mockSocket, (err) => {
      expect(err).toBeInstanceOf(Error);
      expect(err.message).toBe('Authentication error: invalid token');
      expect(mockSocket.user).toBeUndefined();
      done();
    });
  });

  it('should reject connection when token is malformed or invalid', (done) => {
    const mockSocket = {
      id: 'test-socket-004',
      handshake: {
        auth: { token: 'invalid.jwt.token' },
        headers: {},
      },
    };

    socketAuth(mockSocket, (err) => {
      expect(err).toBeInstanceOf(Error);
      expect(err.message).toBe('Authentication error: invalid token');
      done();
    });
  });

  it('should reject connection when token is expired', (done) => {
    const expiredToken = jwt.sign(
      { sub: mockUser.id, id: mockUser.id, role: mockUser.role },
      process.env.JWT_SECRET || 'stackstorm-jwt-secret-key-default-2026',
      { expiresIn: '-1s' }
    );

    const mockSocket = {
      id: 'test-socket-005',
      handshake: {
        auth: { token: expiredToken },
        headers: {},
      },
    };

    socketAuth(mockSocket, (err) => {
      expect(err).toBeInstanceOf(Error);
      expect(err.message).toBe('Authentication error: invalid token');
      done();
    });
  });
});
