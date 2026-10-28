const express = require('express');
const router = express.Router();
const {
  loginUser,
  sendRegistrationOtpHandler,
  registerStudent,
  checkStudentStatus,
  getMe,
  forgotPassword,
  verifyOtp,
  resetPasswordWithOtp
} = require('../controllers/authController');
const { authenticate } = require('../middleware/authMiddleware');

// POST /api/auth/login (Unified login for all roles)
router.post('/login', loginUser);

// POST /api/auth/forgot-password (Request 6-digit OTP to user's registered email)
router.post('/forgot-password', forgotPassword);

// POST /api/auth/verify-otp (Verify 6-digit OTP code before entering new password)
router.post('/verify-otp', verifyOtp);

// POST /api/auth/reset-password (Verify OTP and reset password)
router.post('/reset-password', resetPasswordWithOtp);

// GET /api/auth/check-student/:studentId (Check First-Time vs Returning status and fetch student DB record)
router.get('/check-student/:studentId', checkStudentStatus);

// POST /api/auth/send-registration-otp (Request 6-digit OTP sent to Gmail for student registration)
router.post('/send-registration-otp', sendRegistrationOtpHandler);

// POST /api/auth/register (Student self-registration with manual info + Gmail OTP)
router.post('/register', registerStudent);

// GET /api/auth/me (Returns active authenticated user profile & student record)
router.get('/me', authenticate, getMe);

module.exports = router;
