const ChatService = require('../services/chat.service');
const ChatbotService = require('../services/chatbot.service');
const { ChatSession } = require('../models');
const { logger } = require('../config/logger');

/**
 * Registers real-time customer and agent live chat event handlers on a socket connection.
 *
 * @param {import('socket.io').Server} io
 * @param {import('socket.io').Socket} socket
 */
const registerChatHandlers = (io, socket) => {
  const { user } = socket;

  /**
   * Event: chat:join
   * Customer initiates or resumes a chat session; agents join an existing session.
   */
  socket.on('chat:join', async (data, callback) => {
    try {
      const payload = data || {};
      let session = null;

      if (user.role === 'customer') {
        session = await ChatService.getOrCreateSession(user.id, payload.subject);
      } else if (payload.sessionId) {
        session = await ChatSession.findByPk(payload.sessionId);
        if (session && !session.agent_id && (user.role === 'support_agent' || user.role === 'admin')) {
          session = await ChatService.assignAgent(session.id, user.id);
        }
      }

      if (!session) {
        const errorMsg = 'Chat session could not be established';
        if (typeof callback === 'function') callback({ success: false, error: errorMsg });
        socket.emit('chat:error', { message: errorMsg });
        return;
      }

      const roomName = `session:${session.id}`;
      socket.join(roomName);

      const joinPayload = {
        sessionId: session.id,
        status: session.status,
        agentId: session.agent_id,
        customerId: session.customer_id,
      };

      socket.emit('chat:joined', joinPayload);
      socket.to(roomName).emit('chat:user_joined', {
        userId: user.id,
        role: user.role,
        sessionId: session.id,
      });

      if (typeof callback === 'function') {
        callback({ success: true, ...joinPayload });
      }
    } catch (error) {
      logger.error(`[CHAT] Error joining chat session: ${error.message}`);
      if (typeof callback === 'function') {
        callback({ success: false, error: error.message });
      }
      socket.emit('chat:error', { message: error.message });
    }
  });

  /**
   * Event: chat:message
   * Persists message to PostgreSQL and broadcasts to the session room.
   */
  socket.on('chat:message', async (data, callback) => {
    try {
      const payload = data || {};
      const { sessionId, message } = payload;
      if (!sessionId || !message) {
        const err = 'Both sessionId and message are required';
        if (typeof callback === 'function') callback({ success: false, error: err });
        socket.emit('chat:error', { message: err });
        return;
      }

      const savedMessage = await ChatService.saveMessage({
        sessionId,
        senderId: user.id,
        senderRole: user.role,
        message,
      });

      const messagePayload = {
        id: savedMessage.id,
        sessionId: savedMessage.session_id,
        senderId: savedMessage.sender_id,
        senderRole: savedMessage.sender_role,
        message: savedMessage.message,
        createdAt: savedMessage.created_at,
      };

      // Broadcast to all participants in the session room (including sender)
      io.to(`session:${sessionId}`).emit('chat:message', messagePayload);

      if (typeof callback === 'function') {
        callback({ success: true, data: messagePayload });
      }

      // If customer sent message and no agent is assigned yet, invoke chatbot fallback
      if (user.role === 'customer') {
        const session = await ChatSession.findByPk(sessionId);
        if (session && !session.agent_id) {
          const botResult = await ChatbotService.generateReply(message);
          if (botResult.isEscalation) {
            session.subject = 'Human Escalation Requested';
            await session.save();
          }

          const botMsg = await ChatService.saveMessage({
            sessionId,
            senderId: user.id,
            senderRole: 'bot',
            message: botResult.reply,
          });

          const botPayload = {
            id: botMsg.id,
            sessionId: botMsg.session_id,
            senderId: botMsg.sender_id,
            senderRole: 'bot',
            message: botMsg.message,
            createdAt: botMsg.created_at,
            intent: botResult.intent,
          };

          io.to(`session:${sessionId}`).emit('chat:message', botPayload);
        }
      }
    } catch (error) {
      logger.error(`[CHAT] Error handling chat message: ${error.message}`);
      if (typeof callback === 'function') {
        callback({ success: false, error: error.message });
      }
      socket.emit('chat:error', { message: error.message });
    }
  });

  /**
   * Event: chat:typing
   * Broadcasts typing indicators to counterpart without writing to database.
   */
  socket.on('chat:typing', (data) => {
    const payload = data || {};
    const { sessionId, isTyping } = payload;
    if (!sessionId) return;

    socket.to(`session:${sessionId}`).emit('chat:typing', {
      userId: user.id,
      role: user.role,
      sessionId,
      isTyping: Boolean(isTyping),
    });
  });

  /**
   * Event: chat:leave
   * Leaves the session room.
   */
  socket.on('chat:leave', (data, callback) => {
    const payload = data || {};
    const { sessionId } = payload;
    if (sessionId) {
      const roomName = `session:${sessionId}`;
      socket.leave(roomName);
      socket.to(roomName).emit('chat:user_left', {
        userId: user.id,
        role: user.role,
        sessionId,
      });
    }

    if (typeof callback === 'function') {
      callback({ success: true });
    }
  });
};

module.exports = registerChatHandlers;
