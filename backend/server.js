const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { supabase } = require('./config/supabase');
const { initWeeklyResetCron } = require('./cron/weeklyReset');
const authRoutes = require('./routes/authRoutes');
const studentRoutes = require('./routes/studentRoutes');
const recordsRoutes = require('./routes/recordsRoutes');
const assessmentRoutes = require('./routes/assessmentRoutes');
const recommendationRoutes = require('./routes/recommendationRoutes');
const reportRoutes = require('./routes/reportRoutes');
const chatbotRoutes = require('./routes/chatbotRoutes');
const curriculumRoutes = require('./routes/curriculumRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const staffRoutes = require('./routes/staffRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// CORS Security Configuration
app.use(cors({
  origin: true,
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// API Routes
app.use('/api', authRoutes);           // POST /api/login, POST /api/register
app.use('/api/auth', authRoutes);      // POST /api/auth/login, POST /api/auth/register, GET /api/auth/check-student/:id
app.use('/api/students', studentRoutes);
app.use('/api/academic-records', recordsRoutes);
app.use('/api/assessment', assessmentRoutes);
app.use('/api/recommendations', recommendationRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/chatbot', chatbotRoutes);
app.use('/api/curriculum', curriculumRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/staff-accounts', staffRoutes);
app.use('/api/staff', staffRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    system: 'GCT Subject Assessment & Recommendation System API',
    institution: 'Garcia College of Technology',
    timestamp: new Date().toISOString()
  });
});

// --- DEBUG: inspect raw DB values for a student ---
app.get('/api/debug/student/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const { data: st } = await supabase.from('students')
      .select('student_id, year_level, full_name, program').eq('student_id', id);
    const { data: gr } = await supabase.from('grade_records')
      .select('student_id, subject, year_level, semester, academic_year, grade')
      .eq('student_id', id).limit(100);
    res.json({ students_table: st, grade_records: gr });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- ADMIN FIX: directly set year_level for a student in both tables ---
app.post('/api/admin/fix-year/:id/:year', async (req, res) => {
  try {
    const id = req.params.id;
    const yr = Math.min(4, Math.max(1, Number(req.params.year)));
    if (!Number.isFinite(yr)) return res.status(400).json({ error: 'Invalid year' });
    const { error: se } = await supabase.from('students').update({ year_level: yr }).eq('student_id', id);
    const { error: ge } = await supabase.from('grade_records').update({ year_level: yr }).eq('student_id', id);
    global._cachedStudentSummaries = null;
    global._cachedStudentSummariesTime = 0;
    res.json({ ok: true, student_id: id, year_level: yr, students_error: se?.message, grade_records_error: ge?.message });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- ADMIN FIX ALL: set year_level=2 for all students currently showing year_level=3 ---
app.post('/api/admin/fix-all-year3-to-2', async (req, res) => {
  try {
    const { data: wrong } = await supabase.from('students').select('student_id, year_level, full_name').eq('year_level', 3);
    if (!wrong || wrong.length === 0) return res.json({ ok: true, fixed: 0, message: 'No year_level=3 students found' });
    const ids = wrong.map(s => s.student_id);
    const { error: se } = await supabase.from('students').update({ year_level: 2 }).in('student_id', ids);
    const { error: ge } = await supabase.from('grade_records').update({ year_level: 2 }).in('student_id', ids);
    global._cachedStudentSummaries = null;
    global._cachedStudentSummariesTime = 0;
    res.json({ ok: true, fixed: ids.length, students_updated: ids, students_error: se?.message, grade_records_error: ge?.message });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Global 404
app.use((req, res) => {
  res.status(404).json({ error: `Endpoint '${req.method} ${req.url}' not found` });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled API Error:', err.message);
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

/**
 * Startup fix: correct students.year_level in the DB where it was wrongly overwritten.
 * Reads grade_records.year_level (which stores the student's enrolment year per subject row,
 * set from the uploaded Excel) and uses the MINIMUM year found across all records for
 * each student — because the minimum year is what the student was enrolled in when records
 * were first uploaded, before any curriculum-year inflation.
 * Falls back to the existing students.year_level if grade_records are ambiguous.
 */
async function fixStudentYearLevelsOnStartup() {
  // Disabled: grade_records.year_level cannot be trusted for student year level
  // (old records may have curriculum subject years stored there).
  // The students.year_level is set directly during upload from the Excel file.
  // The /api/admin/fix-year/:id/:year endpoint can be used for manual correction.
  console.log('[Startup] Year level auto-fix disabled (students.year_level is authoritative).');
}


if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL) {
  // Start weekly student accounts reset cron (every Monday at 12:00 AM)
  initWeeklyResetCron();

  app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`  GCT Assessment REST API running on port ${PORT}`);
    console.log(`  Health Check: http://localhost:${PORT}/api/health`);
    console.log(`====================================================`);

    // Fix any incorrect year levels in the background after server is ready
    fixStudentYearLevelsOnStartup();
  });
}

module.exports = app;
