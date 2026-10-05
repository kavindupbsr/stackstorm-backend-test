const { Op } = require('sequelize');
const { ChatSession, ChatMessage, User } = require('../models');
const ApiError = require('../utils/ApiError');
const { logger } = require('../config/logger');

/**
 * Service managing chat sessions and message persistence in PostgreSQL.
 */
class ChatService {
  /**
   * Retrieves or creates a chat session for a customer.
   *
   * @param {string} customerId
   * @param {string} [subject]
   * @returns {Promise<ChatSession>}
   */
  static async getOrCreateSession(customerId, subject = 'Customer Inquiry') {
    let session = await ChatSession.findOne({
      where: {
        customer_id: customerId,
        status: {
          [Op.in]: ['waiting', 'active'],
        },
      },
      order: [['created_at', 'DESC']],
    });

    if (!session) {
      session = await ChatSession.create({
        customer_id: customerId,
        status: 'waiting',
        subject: subject || 'Customer Inquiry',
      });
      logger.info(`[CHAT] Created new chat session ${session.id} for customer ${customerId}`);
    }

    return session;
  }

  /**
   * Assigns a support agent to an active or waiting chat session.
   *
   * @param {string} sessionId
   * @param {string} agentId
   * @returns {Promise<ChatSession>}
   */
  static async assignAgent(sessionId, agentId) {
    const session = await ChatSession.findByPk(sessionId);
    if (!session) {
      throw ApiError.notFound('Chat session not found');
    }

    session.agent_id = agentId;
    session.status = 'active';
    await session.save();

    logger.info(`[CHAT] Assigned agent ${agentId} to chat session ${sessionId}`);
    return session;
  }

  /**
   * Persists a chat message to PostgreSQL.
   *
   * @param {object} params
   * @param {string} params.sessionId
   * @param {string} params.senderId
   * @param {string} params.senderRole
   * @param {string} params.message
   * @returns {Promise<ChatMessage>}
   */
  static async saveMessage({ sessionId, senderId, senderRole = 'customer', message }) {
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      throw ApiError.badRequest('Message content cannot be empty');
    }

    const session = await ChatSession.findByPk(sessionId);
    if (!session) {
      throw ApiError.notFound('Chat session not found');
    }

    const chatMessage = await ChatMessage.create({
      session_id: sessionId,
      sender_id: senderId,
      sender_role: senderRole,
      message: message.trim(),
      is_read: false,
    });

    // Touch session updated_at
    await session.changed('updated_at', true);
    await session.save();

    return chatMessage;
  }

  /**
   * Retrieves messages for a chat session with access control.
   *
   * @param {object} params
   * @param {string} [params.sessionId]
   * @param {string} params.userId
   * @param {string} params.role
   * @returns {Promise<{ session: ChatSession|null, messages: ChatMessage[] }>}
   */
  static async getChatHistory({ sessionId, userId, role }) {
    let session = null;

    if (sessionId) {
      session = await ChatSession.findByPk(sessionId, {
        include: [
          { model: User, as: 'customer', attributes: ['id', 'email'] },
          { model: User, as: 'agent', attributes: ['id', 'email'] },
        ],
      });

      if (!session) {
        throw ApiError.notFound('Chat session not found');
      }

      // Check ownership if caller is customer
      if (role === 'customer' && session.customer_id !== userId) {
        throw ApiError.forbidden('You are not authorized to view this chat history');
      }
    } else {
      // Find latest session for this user
      session = await ChatSession.findOne({
        where: { customer_id: userId },
        order: [['created_at', 'DESC']],
        include: [
          { model: User, as: 'customer', attributes: ['id', 'email'] },
          { model: User, as: 'agent', attributes: ['id', 'email'] },
        ],
      });
    }

    if (!session) {
      return { session: null, messages: [] };
    }

    const messages = await ChatMessage.findAll({
      where: { session_id: session.id },
      order: [['created_at', 'ASC']],
    });

    return { session, messages };
  }

  /**
   * Closes a chat session.
   *
   * @param {string} sessionId
   * @param {string} userId
   * @param {string} role
   * @returns {Promise<ChatSession>}
   */
  static async closeSession(sessionId, userId, role) {
    const session = await ChatSession.findByPk(sessionId);
    if (!session) {
      throw ApiError.notFound('Chat session not found');
    }

    if (role === 'customer' && session.customer_id !== userId) {
      throw ApiError.forbidden('You are not authorized to close this chat session');
    }

    session.status = 'closed';
    await session.save();
    return session;
  }
}

module.exports = ChatService;
