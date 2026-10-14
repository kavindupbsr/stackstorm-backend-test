const express = require('express');
const ChatController = require('../controllers/chat.controller');
const authenticate = require('../middleware/authenticate');

const router = express.Router();

// Public automated chatbot query endpoint
router.post('/bot-query', ChatController.queryBot);
router.post('/faq', ChatController.queryBot);

// Authenticated session & history endpoints
router.use(authenticate);

router.get('/history', ChatController.getHistory);
router.post('/sessions/:sessionId/close', ChatController.closeSession);

module.exports = router;
