const request = require('supertest');
const crypto = require('crypto');
const app = require('../../../src/app');
const ChatbotService = require('../../../src/services/chatbot.service');
const { Order, User } = require('../../../src/models');

describe('STORM-043: ChatbotService & Bot Query API Tests', () => {
  let testUser;
  let testOrder;

  beforeAll(async () => {
    testUser = await User.create({
      id: crypto.randomUUID(),
      email: `bot_test_${Date.now()}@dickwella.lk`,
      password_hash: 'hashedpassword',
      role: 'customer',
      is_active: true,
    });

    testOrder = await Order.create({
      id: crypto.randomUUID(),
      order_number: 'DFC-2026-999',
      customer_id: testUser.id,
      order_status: 'shipped',
      payment_status: 'paid',
      total_amount: 12500.0,
      currency: 'LKR',
      shipping_address_snapshot: { city: 'Matara' },
    });
  });

  afterAll(async () => {
    await Order.destroy({ where: { id: testOrder.id } });
    await User.destroy({ where: { id: testUser.id } });
  });

  describe('AC1: Rule-Based Intent Evaluation', () => {
    it('should evaluate return_policy intent', () => {
      const res = ChatbotService.evaluateIntent('What is your return policy?');
      expect(res.intent).toBe('return_policy');
      expect(res.reply).toContain('30 days of delivery');
      expect(res.isEscalation).toBe(false);
    });

    it('should evaluate store_location intent', () => {
      const res = ChatbotService.evaluateIntent('Where is your store located?');
      expect(res.intent).toBe('store_location');
      expect(res.reply).toContain('Main Street, Dickwella');
    });

    it('should evaluate store_hours intent', () => {
      const res = ChatbotService.evaluateIntent('What are your opening hours?');
      expect(res.intent).toBe('store_hours');
      expect(res.reply).toContain('Monday through Saturday');
    });

    it('should evaluate delivery_info intent', () => {
      const res = ChatbotService.evaluateIntent('How long does delivery take?');
      expect(res.intent).toBe('delivery_info');
      expect(res.reply).toContain('islandwide delivery');
    });

    it('should evaluate payment_methods intent', () => {
      const res = ChatbotService.evaluateIntent('Can I pay with cash on delivery?');
      expect(res.intent).toBe('payment_methods');
      expect(res.reply).toContain('Cash on Delivery');
    });

    it('should prompt for order number when generic order tracking question is asked', () => {
      const res = ChatbotService.evaluateIntent('Where is my order?');
      expect(res.intent).toBe('order_tracking_prompt');
      expect(res.reply).toContain('DFC order number');
    });

    it('should fallback to default reply for unknown intent', () => {
      const res = ChatbotService.evaluateIntent('Tell me a bedtime story about elephants');
      expect(res.intent).toBe('unknown');
      expect(res.reply).toContain('automated assistant');
    });
  });

  describe('AC3: Human Escalation Intent', () => {
    it('should flag session for human agent escalation when customer says human or agent', () => {
      const res = ChatbotService.evaluateIntent('I want to speak with a human agent');
      expect(res.intent).toBe('human_escalation');
      expect(res.isEscalation).toBe(true);
      expect(res.reply).toContain('escalating your request to a live support agent');
    });
  });

  describe('AC2: Order Tracking Status Query', () => {
    it('should parse DFC invoice format and query real order from database', async () => {
      const reply = await ChatbotService.generateReply('Please track DFC-2026-999');
      expect(reply.intent).toBe('order_tracking');
      expect(reply.orderNumber).toBe('DFC-2026-999');
      expect(reply.reply).toContain('Order DFC-2026-999 is currently SHIPPED');
      expect(reply.reply).toContain('Payment status: PAID');
    });

    it('should return helpful error message when order number does not exist', async () => {
      const reply = await ChatbotService.generateReply('track order DFC-2026-000');
      expect(reply.intent).toBe('order_tracking');
      expect(reply.reply).toContain('could not find an order with number DFC-2026-000');
    });
  });

  describe('REST Channel: POST /api/v1/chat/bot-query', () => {
    it('should return automated response for valid message', async () => {
      const response = await request(app)
        .post('/api/v1/chat/bot-query')
        .send({ message: 'Where is your store located?' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.reply).toContain('Main Street, Dickwella');
      expect(response.body.data.intent).toBe('store_location');
    });

    it('should reject request missing message parameter with 400', async () => {
      const response = await request(app)
        .post('/api/v1/chat/bot-query')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });
});
