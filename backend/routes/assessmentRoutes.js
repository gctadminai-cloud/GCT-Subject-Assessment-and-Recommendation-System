const express = require('express');
const router = express.Router();
const { runAssessmentForStudent } = require('../controllers/assessmentController');
const { authenticate, requireRole } = require('../middleware/authMiddleware');

// Staff/Admin run assessment engine for a student
router.post('/run/:studentId', authenticate, requireRole('registrar_staff', 'registrar_admin'), runAssessmentForStudent);

module.exports = router;
