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

// Middleware: Allows Registrar Admin OR Vercel Cron invocation
const allowAdminOrCron = (req, res, next) => {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers['authorization'];
  const isVercelCron = req.headers['x-vercel-cron'] === '1' || (cronSecret && authHeader === `Bearer ${cronSecret}`);

  if (isVercelCron) {
    return next();
  }

  return authenticate(req, res, () => {
    return requireRole('registrar_admin')(req, res, next);
  });
};

// Weekly student password reset (Admin or Vercel Cron)
router.all('/trigger-weekly-reset', allowAdminOrCron, triggerWeeklyReset);

// Weekly student password reset early reminder notice (Admin or Vercel Cron)
router.all('/trigger-weekly-reset-notice', allowAdminOrCron, triggerWeeklyResetNotice);

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

