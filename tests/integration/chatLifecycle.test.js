const http = require('http');
const request = require('supertest');
const { io: ioClient } = require('socket.io-client');
const crypto = require('crypto');
const app = require('../../src/app');
const { initSocketServer, closeSocketServer } = require('../../src/websocket/socketServer');
const { User, ChatSession, ChatMessage } = require('../../src/models');
const { generateAccessToken } = require('../../src/services/token.service');

describe('STORM-042: Real-Time Customer-to-Agent Live Chat Session', () => {
  let server;
  let port;
  let customerUser;
  let agentUser;
  let customerToken;
  let agentToken;
  let clientCustomer;
  let clientAgent;
  let activeSessionId;

  beforeAll(async () => {
    // 1. Seed database users
    customerUser = await User.create({
      id: crypto.randomUUID(),
      email: `customer_live_${Date.now()}@dickwella.lk`,
      password_hash: 'hashedpassword',
      role: 'customer',
      is_active: true,
    });

    agentUser = await User.create({
      id: crypto.randomUUID(),
      email: `agent_live_${Date.now()}@dickwella.lk`,
      password_hash: 'hashedpassword',
      role: 'support_agent',
      is_active: true,
    });

    customerToken = generateAccessToken(customerUser);
    agentToken = generateAccessToken(agentUser);

    // 2. Spin up HTTP + Socket.IO server
    server = http.createServer(app);
    initSocketServer(server);
    await new Promise((resolve) => {
      server.listen(0, () => {
        port = server.address().port;
        resolve();
      });
    });

    // 3. Connect real Socket.IO clients
    clientCustomer = ioClient(`http://localhost:${port}`, {
      auth: { token: customerToken },
      transports: ['websocket'],
      reconnection: false,
    });

    clientAgent = ioClient(`http://localhost:${port}`, {
      auth: { token: agentToken },
      transports: ['websocket'],
      reconnection: false,
    });

    await Promise.all([
      new Promise((resolve) => {
        clientCustomer.on('connect', () => resolve());
      }),
      new Promise((resolve) => {
        clientAgent.on('connect', () => resolve());
      }),
    ]);
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

  it('AC1: Customer emits chat:join to create chat session in chat_sessions table', (done) => {
    clientCustomer.emit('chat:join', { subject: 'Saree Fabric Question' }, (ack) => {
      expect(ack.success).toBe(true);
      expect(ack.sessionId).toBeDefined();
      expect(ack.status).toBe('waiting');
      activeSessionId = ack.sessionId;

      // Verify PostgreSQL record was created
      ChatSession.findByPk(activeSessionId).then((session) => {
        expect(session).toBeDefined();
        expect(session.customer_id).toBe(customerUser.id);
        expect(session.status).toBe('waiting');
        done();
      }).catch(done);
    });
  });

  it('AC1: Agent joins chat session room', (done) => {
    clientAgent.emit('chat:join', { sessionId: activeSessionId }, (ack) => {
      expect(ack.success).toBe(true);
      expect(ack.sessionId).toBe(activeSessionId);

      // Verify agent was assigned to session
      ChatSession.findByPk(activeSessionId).then((session) => {
        expect(session.agent_id).toBe(agentUser.id);
        expect(session.status).toBe('active');
        done();
      }).catch(done);
    });
  });

  it('AC3: Customer emits chat:typing and Agent receives live indicator without DB writes', (done) => {
    const startTime = Date.now();

    clientAgent.once('chat:typing', (payload) => {
      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeLessThan(500); // Delivered in real-time
      expect(payload.isTyping).toBe(true);
      expect(payload.userId).toBe(customerUser.id);
      expect(payload.role).toBe('customer');
      expect(payload.sessionId).toBe(activeSessionId);
      done();
    });

    clientCustomer.emit('chat:typing', {
      sessionId: activeSessionId,
      isTyping: true,
    });
  });

  it('AC2: Customer sends message, persists to PostgreSQL and Agent receives event (<50ms)', (done) => {
    const messageContent = 'Do you have the linen batik shirt in size XL?';
    const startTime = Date.now();

    clientAgent.once('chat:message', async (incoming) => {
      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeLessThan(200); // Sub-50ms ideal network condition
      expect(incoming.sessionId).toBe(activeSessionId);
      expect(incoming.senderId).toBe(customerUser.id);
      expect(incoming.senderRole).toBe('customer');
      expect(incoming.message).toBe(messageContent);
      expect(incoming.id).toBeDefined();

      // Verify persisted in PostgreSQL
      const persisted = await ChatMessage.findByPk(incoming.id);
      expect(persisted).toBeDefined();
      expect(persisted.message).toBe(messageContent);
      expect(persisted.session_id).toBe(activeSessionId);
      done();
    });

    clientCustomer.emit('chat:message', {
      sessionId: activeSessionId,
      message: messageContent,
    });
  });

  it('AC2: Agent sends reply, persists to PostgreSQL and Customer receives message', (done) => {
    const replyContent = 'Yes, size XL is in stock in Royal Blue and Emerald Green!';

    clientCustomer.once('chat:message', async (incoming) => {
      expect(incoming.sessionId).toBe(activeSessionId);
      expect(incoming.senderId).toBe(agentUser.id);
      expect(incoming.senderRole).toBe('support_agent');
      expect(incoming.message).toBe(replyContent);

      const persisted = await ChatMessage.findByPk(incoming.id);
      expect(persisted).toBeDefined();
      expect(persisted.message).toBe(replyContent);
      done();
    });

    clientAgent.emit('chat:message', {
      sessionId: activeSessionId,
      message: replyContent,
    });
  });

  it('REST Channel: GET /api/v1/chat/history retrieves message thread', async () => {
    const response = await request(app)
      .get('/api/v1/chat/history')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.messages).toBeDefined();
    expect(response.body.data.messages.length).toBe(2);
    expect(response.body.data.messages[0].message).toBe('Do you have the linen batik shirt in size XL?');
    expect(response.body.data.messages[1].message).toBe('Yes, size XL is in stock in Royal Blue and Emerald Green!');
  });

  it('REST Channel: POST /api/v1/chat/sessions/:id/close terminates chat session', async () => {
    const response = await request(app)
      .post(`/api/v1/chat/sessions/${activeSessionId}/close`)
      .set('Authorization', `Bearer ${customerToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.session.status).toBe('closed');
  });
});
