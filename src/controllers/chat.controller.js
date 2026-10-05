const ChatService = require('../services/chat.service');
const { successResponse } = require('../utils/responseFormatter');

/**
 * Controller handling chat history and session REST endpoints.
 */
class ChatController {
  /**
   * Retrieves message history for the customer's active or requested chat session.
   *
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   * @param {import('express').NextFunction} next
   */
  static async getHistory(req, res, next) {
    try {
      const { sessionId } = req.query;
      const { id: userId, role } = req.user;

      const data = await ChatService.getChatHistory({
        sessionId,
        userId,
        role,
      });

      return successResponse(res, data, 'Chat history retrieved successfully');
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Closes a chat session.
   *
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   * @param {import('express').NextFunction} next
   */
  static async closeSession(req, res, next) {
    try {
      const { sessionId } = req.params;
      const { id: userId, role } = req.user;

      const session = await ChatService.closeSession(sessionId, userId, role);
      return successResponse(res, { session }, 'Chat session closed successfully');
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = ChatController;
