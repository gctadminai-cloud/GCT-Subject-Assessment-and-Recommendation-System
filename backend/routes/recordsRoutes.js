const express = require('express');
const router = express.Router();
const { getAcademicRecords, createOrUpdateRecord, batchUpdateRecords, deleteRecord } = require('../controllers/recordsController');
const { authenticate, requireRole } = require('../middleware/authMiddleware');

// Get academic records (Student reads own; Staff/Admin reads all/filtered)
router.get('/', authenticate, getAcademicRecords);

// Staff/Admin encode or update single grade record
router.post('/', authenticate, requireRole('registrar_staff', 'registrar_admin'), createOrUpdateRecord);
router.put('/', authenticate, requireRole('registrar_staff', 'registrar_admin'), createOrUpdateRecord);

// Staff/Admin delete grade record (deletes from both grade_records & academic_records in Supabase)
router.delete('/:id', authenticate, requireRole('registrar_staff', 'registrar_admin'), deleteRecord);
router.delete('/', authenticate, requireRole('registrar_staff', 'registrar_admin'), deleteRecord);

// Batch encode grade records (Staff, Admin, Chatbot)
router.post('/batch', authenticate, batchUpdateRecords);

module.exports = router;
