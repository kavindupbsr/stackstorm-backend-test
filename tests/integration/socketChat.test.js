const http = require('http');
const { io: ioClient } = require('socket.io-client');
const crypto = require('crypto');
const app = require('../../src/app');
const { initSocketServer, closeSocketServer } = require('../../src/websocket/socketServer');
const { User, ChatSession, ChatMessage } = require('../../src/models');
const { generateAccessToken } = require('../../src/services/token.service');

describe('Socket.IO Real-Time Chat Suite', () => {
  let server;
  let port;
  let io;
  let customerUser;
  let agentUser;
  let customerToken;
  let agentToken;
  let clientCustomer;
  let clientAgent;
  let activeSessionId;

  beforeAll(async () => {
    // 1. Seed test users
    customerUser = await User.create({
      id: crypto.randomUUID(),
      email: `socket_cust_${Date.now()}@dickwella.lk`,
      password_hash: 'hashedpassword',
      role: 'customer',
      is_active: true,
    });

    agentUser = await User.create({
      id: crypto.randomUUID(),
      email: `socket_agent_${Date.now()}@dickwella.lk`,
      password_hash: 'hashedpassword',
      role: 'support_agent',
      is_active: true,
    });

    customerToken = generateAccessToken(customerUser);
    agentToken = generateAccessToken(agentUser);

    // 2. Start HTTP & Socket.IO server on dynamic port
    server = http.createServer(app);
    io = initSocketServer(server);
    await new Promise((resolve) => {
      server.listen(0, () => {
        port = server.address().port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (clientCustomer && clientCustomer.connected) clientCustomer.disconnect();
    if (clientAgent && clientAgent.connected) clientAgent.disconnect();
    await closeSocketServer();
    await new Promise((resolve) => {
      server.close(() => resolve());
    });

    await ChatMessage.destroy({ where: {} });
    await ChatSession.destroy({ where: {} });
    await User.destroy({ where: { id: [customerUser.id, agentUser.id] } });
  });

  it('Authenticate and connect socket client', (done) => {
    clientCustomer = ioClient(`http://localhost:${port}`, {
      auth: { token: customerToken },
      transports: ['websocket'],
      reconnection: false,
    });

    clientCustomer.on('connect', () => {
      expect(clientCustomer.connected).toBe(true);

      const serverSocket = io.sockets.sockets.get(clientCustomer.id);
      expect(serverSocket).toBeDefined();
      expect(serverSocket.user.id).toBe(customerUser.id);
      expect(serverSocket.rooms.has(`user:${customerUser.id}`)).toBe(true);
      done();
    });

    clientCustomer.on('connect_error', (err) => {
      done(err);
    });
  });

  it('Join chat room and exchange messages', (done) => {
    clientAgent = ioClient(`http://localhost:${port}`, {
      auth: { token: agentToken },
      transports: ['websocket'],
      reconnection: false,
    });

    clientAgent.on('connect', () => {
      // 1. Customer initiates chat session
      clientCustomer.emit('chat:join', { subject: 'Silk Sarees' }, (custAck) => {
        expect(custAck.success).toBe(true);
        activeSessionId = custAck.sessionId;

        // 2. Agent joins same session room
        clientAgent.emit('chat:join', { sessionId: activeSessionId }, (agentAck) => {
          expect(agentAck.success).toBe(true);

          const startTime = Date.now();
          const testMsg = 'Do you offer international shipping to UK?';

          // 3. Agent expects message within 100ms
          clientAgent.once('chat:message', (incoming) => {
            const elapsed = Date.now() - startTime;
            expect(elapsed).toBeLessThan(100);
            expect(incoming.message).toBe(testMsg);
            expect(incoming.sessionId).toBe(activeSessionId);
            expect(incoming.senderRole).toBe('customer');
            done();
          });

          // 4. Customer emits message
          clientCustomer.emit('chat:message', {
            sessionId: activeSessionId,
            message: testMsg,
          });
        });
      });
    });
  });

  it('Trigger chatbot FAQ automated response', async () => {
    // Close prior session so a fresh waiting session is initialized without agent
    await ChatSession.update({ status: 'closed' }, { where: { customer_id: customerUser.id } });

    await new Promise((resolve) => {
      // 1. Customer initiates a new unassigned session
      clientCustomer.emit('chat:join', { subject: 'Return Policy Inquiry' }, (ack) => {
        expect(ack.success).toBe(true);
        const unassignedSessionId = ack.sessionId;
        const question = 'What is your return policy?';

        // 2. Set up listener specifically for chatbot response
        const messageHandler = (incoming) => {
          if (incoming.senderRole === 'bot') {
            expect(incoming.sessionId).toBe(unassignedSessionId);
            expect(incoming.message).toContain('30 days of delivery');
            clientCustomer.off('chat:message', messageHandler);
            resolve();
          }
        };

        clientCustomer.on('chat:message', messageHandler);

        // 3. Emit question on unassigned session to trigger chatbot fallback
        clientCustomer.emit('chat:message', {
          sessionId: unassignedSessionId,
          message: question,
        });
      });
    });
  });

  it('Cleanly disconnect client and free socket memory', (done) => {
    const customerSocketId = clientCustomer.id;
    expect(io.sockets.sockets.has(customerSocketId)).toBe(true);

    clientCustomer.on('disconnect', () => {
      // Short delay for server to process disconnect event
      setTimeout(() => {
        expect(io.sockets.sockets.has(customerSocketId)).toBe(false);
        done();
      }, 50);
    });

    clientCustomer.disconnect();
  });
});
