const { Order } = require('../models');
const faqRules = require('../config/faqRules.json');
const { logger } = require('../config/logger');

/**
 * Service managing automated rule-based chatbot evaluation, FAQ responses,
 * and order status lookups for Dickwella Fashion Corner.
 */
class ChatbotService {
  /**
   * Evaluates the customer's message intent using rule-based keyword and regex matching.
   *
   * @param {string} message
   * @returns {{ intent: string, reply: string, orderNumber?: string, isEscalation: boolean }}
   */
  static evaluateIntent(message) {
    if (!message || typeof message !== 'string') {
      return {
        intent: 'unknown',
        reply: faqRules.default_reply,
        isEscalation: false,
      };
    }

    const trimmed = message.trim();
    const normalized = trimmed.toLowerCase();

    // 1. Check for Order Tracking Intent with DFC invoice pattern
    const orderMatch = trimmed.match(/DFC-[\w-]+/i);
    if (orderMatch) {
      const orderNumber = orderMatch[0].toUpperCase();
      return {
        intent: 'order_tracking',
        orderNumber,
        reply: `Checking status for order ${orderNumber}...`,
        isEscalation: false,
      };
    }

    // 2. Check general "where is my order" or "track order" without explicit DFC number
    if (
      normalized.includes('where is my order') ||
      normalized.includes('track my order') ||
      normalized.includes('order status')
    ) {
      return {
        intent: 'order_tracking_prompt',
        reply:
          'To track your order, please provide your DFC order number (for example: DFC-2026-104).',
        isEscalation: false,
      };
    }

    // 3. Match against configured FAQ rules
    for (const rule of faqRules.rules) {
      const matched = rule.patterns.some((pattern) => {
        const pLower = pattern.toLowerCase();
        // Match either exact phrase inclusion or word-boundary match
        return normalized.includes(pLower);
      });

      if (matched) {
        return {
          intent: rule.intent,
          reply: rule.reply,
          isEscalation: rule.intent === 'human_escalation',
        };
      }
    }

    // 4. Default / Fallback response
    return {
      intent: 'unknown',
      reply: faqRules.default_reply,
      isEscalation: false,
    };
  }

  /**
   * Generates a complete automated chatbot reply, querying PostgreSQL if order tracking is requested.
   *
   * @param {string} message
   * @returns {Promise<{ intent: string, reply: string, orderNumber?: string, isEscalation: boolean }>}
   */
  static async generateReply(message) {
    const evaluation = ChatbotService.evaluateIntent(message);

    // If order tracking with specific order number
    if (evaluation.intent === 'order_tracking' && evaluation.orderNumber) {
      try {
        const order = await Order.findOne({
          where: { order_number: evaluation.orderNumber },
        });

        if (!order) {
          return {
            intent: 'order_tracking',
            orderNumber: evaluation.orderNumber,
            reply: `We could not find an order with number ${evaluation.orderNumber}. Please verify the order number on your invoice receipt and try again.`,
            isEscalation: false,
          };
        }

        let statusText = `Order ${order.order_number} is currently ${order.order_status.toUpperCase()}. Payment status: ${order.payment_status.toUpperCase()}.`;
        if (order.delivered_at) {
          const dateStr = new Date(order.delivered_at).toLocaleDateString('en-GB');
          statusText += ` Package was delivered on ${dateStr}.`;
        }

        return {
          intent: 'order_tracking',
          orderNumber: evaluation.orderNumber,
          reply: statusText,
          isEscalation: false,
        };
      } catch (err) {
        logger.error(`[CHATBOT] Error querying order status: ${err.message}`);
        return {
          intent: 'order_tracking',
          orderNumber: evaluation.orderNumber,
          reply: `There was a temporary issue looking up order ${evaluation.orderNumber}. Please try again shortly or type 'human' to speak with an agent.`,
          isEscalation: false,
        };
      }
    }

    return evaluation;
  }
}

// Export both class and standalone evaluateIntent function for direct convenience
module.exports = ChatbotService;
module.exports.evaluateIntent = ChatbotService.evaluateIntent;
module.exports.generateReply = ChatbotService.generateReply;
