const express = require('express');
const ChatController = require('../controllers/chat.controller');
const authenticate = require('../middleware/authenticate');

const router = express.Router();

// Enforce authentication on all chat endpoints
router.use(authenticate);

router.get('/history', ChatController.getHistory);
router.post('/sessions/:sessionId/close', ChatController.closeSession);

module.exports = router;
