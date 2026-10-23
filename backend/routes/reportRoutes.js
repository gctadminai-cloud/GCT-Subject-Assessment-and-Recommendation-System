const express = require('express');
const router = express.Router();
const { getAcademicProgressReport, getEnrollmentSummaryReport } = require('../controllers/reportController');
const { authenticate, requireRole } = require('../middleware/authMiddleware');

// Admin access reports
router.get('/academic-progress', authenticate, requireRole('registrar_admin'), getAcademicProgressReport);
router.get('/enrollment-summary', authenticate, requireRole('registrar_admin'), getEnrollmentSummaryReport);

module.exports = router;
