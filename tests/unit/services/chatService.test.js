const crypto = require('crypto');
const ChatService = require('../../../src/services/chat.service');
const { User, ChatSession, ChatMessage } = require('../../../src/models');

describe('ChatService Unit Tests', () => {
  let customerUser;
  let agentUser;
  let otherCustomerUser;

  beforeAll(async () => {
    customerUser = await User.create({
      id: crypto.randomUUID(),
      email: `chat_cust_${Date.now()}@dickwella.lk`,
      password_hash: 'hashedpassword',
      role: 'customer',
      is_active: true,
    });

    agentUser = await User.create({
      id: crypto.randomUUID(),
      email: `chat_agent_${Date.now()}@dickwella.lk`,
      password_hash: 'hashedpassword',
      role: 'support_agent',
      is_active: true,
    });

    otherCustomerUser = await User.create({
      id: crypto.randomUUID(),
      email: `chat_other_${Date.now()}@dickwella.lk`,
      password_hash: 'hashedpassword',
      role: 'customer',
      is_active: true,
    });
  });

  afterAll(async () => {
    await ChatMessage.destroy({ where: {} });
    await ChatSession.destroy({ where: {} });
    await User.destroy({
      where: { id: [customerUser.id, agentUser.id, otherCustomerUser.id] },
    });
  });

  it('should create a new session with status waiting when none exists', async () => {
    const session = await ChatService.getOrCreateSession(customerUser.id, 'Sizing Help');
    expect(session).toBeDefined();
    expect(session.customer_id).toBe(customerUser.id);
    expect(session.status).toBe('waiting');
    expect(session.subject).toBe('Sizing Help');
  });

  it('should reuse existing waiting session for same customer', async () => {
    const session1 = await ChatService.getOrCreateSession(customerUser.id);
    const session2 = await ChatService.getOrCreateSession(customerUser.id);
    expect(session1.id).toBe(session2.id);
  });

  it('should assign a support agent to the session and update status to active', async () => {
    const session = await ChatService.getOrCreateSession(customerUser.id);
    const updated = await ChatService.assignAgent(session.id, agentUser.id);
    expect(updated.agent_id).toBe(agentUser.id);
    expect(updated.status).toBe('active');
  });

  it('should throw 404 when assigning agent to non-existent session', async () => {
    await expect(
      ChatService.assignAgent(crypto.randomUUID(), agentUser.id)
    ).rejects.toThrow('Chat session not found');
  });

  it('should persist a chat message and update session updated_at', async () => {
    const session = await ChatService.getOrCreateSession(customerUser.id);
    const msg = await ChatService.saveMessage({
      sessionId: session.id,
      senderId: customerUser.id,
      senderRole: 'customer',
      message: 'Hello, is the linen saree available in Blue?',
    });

    expect(msg).toBeDefined();
    expect(msg.session_id).toBe(session.id);
    expect(msg.sender_id).toBe(customerUser.id);
    expect(msg.message).toBe('Hello, is the linen saree available in Blue?');
    expect(msg.sender_role).toBe('customer');
  });

  it('should throw 400 when saving empty message', async () => {
    const session = await ChatService.getOrCreateSession(customerUser.id);
    await expect(
      ChatService.saveMessage({
        sessionId: session.id,
        senderId: customerUser.id,
        senderRole: 'customer',
        message: '   ',
      })
    ).rejects.toThrow('Message content cannot be empty');
  });

  it('should retrieve chat history for customer owning session', async () => {
    const session = await ChatService.getOrCreateSession(customerUser.id);
    const history = await ChatService.getChatHistory({
      sessionId: session.id,
      userId: customerUser.id,
      role: 'customer',
    });

    expect(history.session).toBeDefined();
    expect(history.session.id).toBe(session.id);
    expect(history.messages.length).toBeGreaterThanOrEqual(1);
  });

  it('should reject access to chat history when customer does not own session', async () => {
    const session = await ChatService.getOrCreateSession(customerUser.id);
    await expect(
      ChatService.getChatHistory({
        sessionId: session.id,
        userId: otherCustomerUser.id,
        role: 'customer',
      })
    ).rejects.toThrow('You are not authorized to view this chat history');
  });

  it('should close an active chat session', async () => {
    const session = await ChatService.getOrCreateSession(customerUser.id);
    const closed = await ChatService.closeSession(session.id, customerUser.id, 'customer');
    expect(closed.status).toBe('closed');
  });
});
