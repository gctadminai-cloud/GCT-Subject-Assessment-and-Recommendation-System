const express = require('express');
const router = express.Router();
const { getRecommendations, approveRecommendation, rejectRecommendation } = require('../controllers/recommendationController');
const { authenticate, requireRole } = require('../middleware/authMiddleware');

// Get recommendations (Student sees approved for self; Staff/Admin sees all)
router.get('/', authenticate, getRecommendations);

// Staff/Admin approve recommendation
router.put('/:id/approve', authenticate, requireRole('registrar_staff', 'registrar_admin'), approveRecommendation);

// Staff/Admin reject recommendation
router.put('/:id/reject', authenticate, requireRole('registrar_staff', 'registrar_admin'), rejectRecommendation);

module.exports = router;
