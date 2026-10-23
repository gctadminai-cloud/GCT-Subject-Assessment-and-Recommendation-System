const express = require('express');
const router = express.Router();
const { getSettings, updateSetting, getAcademicYears, addAcademicYear, deleteAcademicYear } = require('../controllers/settingsController');
const { authenticate, requireRole } = require('../middleware/authMiddleware');

// Get system settings
router.get('/', authenticate, getSettings);

// Admin update setting (e.g. passing threshold)
router.put('/', authenticate, requireRole('registrar_admin'), updateSetting);

// Get available academic years
router.get('/academic-years', authenticate, getAcademicYears);

// Registrar admin add new academic year
router.post('/academic-years', authenticate, requireRole('registrar_admin'), addAcademicYear);

// Registrar admin delete academic year (only if no records exist)
router.delete('/academic-years/:academic_year', authenticate, requireRole('registrar_admin'), deleteAcademicYear);

module.exports = router;
