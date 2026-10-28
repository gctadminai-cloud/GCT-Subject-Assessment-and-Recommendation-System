const express = require('express');
const router = express.Router();
const {
  getAllStudents,
  getPendingVerifications,
  getStudentById,
  updateStudentApproval,
  createStudent,
  updateStudent,
  deleteStudent,
  serveLocalPhoto,
  triggerWeeklyReset,
  triggerWeeklyResetNotice
} = require('../controllers/studentController');
const { authenticate, requireRole } = require('../middleware/authMiddleware');

// Registrar view all students
router.get('/', authenticate, requireRole('registrar_staff', 'registrar_admin'), getAllStudents);

// Registrar view pending verifications queue
router.get('/pending', authenticate, requireRole('registrar_staff', 'registrar_admin'), getPendingVerifications);

// Manual trigger for weekly student password reset (Admin only)
router.post('/trigger-weekly-reset', authenticate, requireRole('registrar_admin'), triggerWeeklyReset);

// Manual trigger for weekly student password reset early reminder notice (Admin only)
router.post('/trigger-weekly-reset-notice', authenticate, requireRole('registrar_admin'), triggerWeeklyResetNotice);

// Serve local verification photo (Registrar only)
router.get('/photo/:folder/:filename', authenticate, requireRole('registrar_staff', 'registrar_admin'), serveLocalPhoto);

// View specific student
router.get('/:id', authenticate, getStudentById);

// Registrar approve / reject student verification (updates verified = true & account status = 'approved')
router.put('/:id/approval', authenticate, requireRole('registrar_staff', 'registrar_admin'), updateStudentApproval);
router.post('/:id/review', authenticate, requireRole('registrar_staff', 'registrar_admin'), updateStudentApproval);

// Registrar CRUD operations for students
router.post('/', authenticate, requireRole('registrar_staff', 'registrar_admin'), createStudent);
router.put('/:id', authenticate, requireRole('registrar_staff', 'registrar_admin'), updateStudent);
router.delete('/:id', authenticate, requireRole('registrar_staff', 'registrar_admin'), deleteStudent);

module.exports = router;

