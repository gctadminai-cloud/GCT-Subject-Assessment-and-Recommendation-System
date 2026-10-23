const express = require('express');
const router = express.Router();
const { queryChatbot } = require('../controllers/chatbotController');
const { optionalAuthenticate } = require('../middleware/authMiddleware');

// POST /api/chatbot/query (Grounded Academic Q&A - Supports Students, Staff & Guest/Login Visitors)
router.post('/query', optionalAuthenticate, queryChatbot);

module.exports = router;
