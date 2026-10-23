const express = require('express');
const cors = require('cors');
require('dotenv').config();

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

// Global 404
app.use((req, res) => {
  res.status(404).json({ error: `Endpoint '${req.method} ${req.url}' not found` });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled API Error:', err.message);
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

if (process.env.NODE_ENV !== 'test') {
  // Start weekly student accounts reset cron (every Monday at 12:00 AM)
  initWeeklyResetCron();

  app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`  GCT Assessment REST API running on port ${PORT}`);
    console.log(`  Health Check: http://localhost:${PORT}/api/health`);
    console.log(`====================================================`);
  });
}

module.exports = app;
