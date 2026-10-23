const express = require('express');
const router = express.Router();
const multer = require('multer');
const { loginUser, registerStudent, checkStudentStatus, getMe, forgotPassword, verifyOtp, resetPasswordWithOtp } = require('../controllers/authController');
const { authenticate } = require('../middleware/authMiddleware');

// Multer memory storage for in-memory processing before upload to Supabase / local storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5 MB per file
  },
  fileFilter: (req, file, cb) => {
    if (['image/jpeg', 'image/png'].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(null, false);
    }
  }
});

const uploadFields = upload.fields([
  { name: 'id_front', maxCount: 1 },
  { name: 'id_back', maxCount: 1 },
  { name: 'selfie', maxCount: 1 }
]);

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

// POST /api/auth/register (Student self-registration with ID photos & selfie)
router.post('/register', uploadFields, registerStudent);

// GET /api/auth/me (Returns active authenticated user profile & student record)
router.get('/me', authenticate, getMe);

module.exports = router;
