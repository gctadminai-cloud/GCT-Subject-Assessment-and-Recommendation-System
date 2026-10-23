const express = require('express');
const router = express.Router();
const {
  getStaffAccounts,
  createStaffAccount,
  updateStaffStatus,
  deleteStaffAccount
} = require('../controllers/staffController');
const { authenticate, requireRole } = require('../middleware/authMiddleware');

// Admin manages registrar/staff accounts
router.get('/', authenticate, requireRole('registrar_admin'), getStaffAccounts);
router.post('/', authenticate, requireRole('registrar_admin'), createStaffAccount);
router.put('/:id/status', authenticate, requireRole('registrar_admin'), updateStaffStatus);
router.delete('/:id', authenticate, requireRole('registrar_admin'), deleteStaffAccount);

module.exports = router;
