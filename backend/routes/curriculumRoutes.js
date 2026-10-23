const express = require('express');
const router = express.Router();
const {
  getSubjects,
  createSubject,
  updateSubject,
  deleteSubject,
  getPrerequisites,
  createPrerequisite,
  deletePrerequisite
} = require('../controllers/curriculumController');
const { authenticate, requireRole } = require('../middleware/authMiddleware');

// Subjects API
router.get('/subjects', authenticate, getSubjects);
router.post('/subjects', authenticate, requireRole('registrar_admin'), createSubject);
router.put('/subjects/:id', authenticate, requireRole('registrar_admin'), updateSubject);
router.delete('/subjects/:id', authenticate, requireRole('registrar_admin'), deleteSubject);

// Prerequisites API
router.get('/prerequisites', authenticate, getPrerequisites);
router.post('/prerequisites', authenticate, requireRole('registrar_admin'), createPrerequisite);
router.delete('/prerequisites/:id', authenticate, requireRole('registrar_admin'), deletePrerequisite);

module.exports = router;
