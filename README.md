# GCT Subject Assessment and Recommendation System
**Garcia College of Technology (GCT)** — Automated Prerequisite Evaluation, Human-in-the-Loop Recommendation Approval & Grounded AI Academic Advising.

---

## 🚀 Overview

The **GCT Subject Assessment and Recommendation System** automates the manual curriculum prerequisite evaluation process for Garcia College of Technology students:
1. **Rule-Based Assessment Engine**: An isolated, pure-function expert system (`/backend/services/assessmentEngine.js`) that compares student grades against curriculum prerequisites to determine subject completion (`passed`/`failed`), unlocks eligible subjects, recommends retakes, and evaluates overall enrollment eligibility ($\le 3$ failed prerequisite subjects).
2. **Human-in-the-Loop Recommendation Approvals**: Assessment recommendations enter a `pending_review` state and are routed to Registrar Staff for review before being released to students.
3. **Grounded AI Academic Advisor**: An interactive chatbot powered by the **Google Gemini API** that retrieves the student's exact academic records, passed/failed subjects, and approved recommendations to provide natural language Q&A.
4. **Role-Based Access Control (RBAC)**: Distinct dashboards and API permissions for **Students**, **Registrar Staff**, and **Registrar Admin**.

---

## 🛠️ Tech Stack

- **Frontend**: React (v18+), Vite, TypeScript, Lucide Icons, Custom Glassmorphism CSS Design System.
- **Backend**: Node.js, Express.js REST API, RBAC Middleware, Isolated Assessment Engine, Google Gemini API SDK.
- **Database & Auth**: Supabase (PostgreSQL + Supabase Auth).
- **Unit Testing**: Vitest test runner.

---

## 📁 Project Structure

```
/
├── backend/
│   ├── config/
│   │   └── supabase.js             # Supabase JS client setup
│   ├── controllers/                # API route handlers
│   │   ├── assessmentController.js # Assessment engine runner
│   │   ├── authController.js       # Signup & me endpoints
│   │   ├── chatbotController.js    # Grounded Gemini AI advisor
│   │   ├── curriculumController.js # Subjects & prerequisites CRUD
│   │   ├── recordsController.js    # Student grade encoding
│   │   ├── recommendationController.js # Human review approval flow
│   │   ├── reportController.js     # Analytics & reports
│   │   ├── settingsController.js   # Passing grade & threshold settings
│   │   ├── staffController.js      # Staff accounts management
│   │   └── studentController.js    # Student registration approvals
│   ├── middleware/
│   │   └── authMiddleware.js       # JWT & requireRole RBAC gating
│   ├── routes/                     # Express REST routes
│   ├── services/
│   │   └── assessmentEngine.js     # Pure isolated expert system
│   ├── tests/
│   │   └── assessmentEngine.test.js # Vitest unit tests
│   ├── server.js                   # Express application entrypoint
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/             # Navbar & ChatbotWidget
│   │   ├── context/                # AuthContext & role switcher
│   │   ├── pages/                  # Student, Staff & Admin Dashboards
│   │   ├── App.tsx
│   │   └── index.css               # Global GCT design tokens & styles
│   └── package.json
├── supabase/
│   └── schema.sql                  # PostgreSQL DDL, RLS policies & seed data
├── DECISIONS.md                    # Architectural & business logic decisions
├── README.md                       # Setup & execution instructions
└── .env.example                    # Environment variable template
```

---

## 📦 Setup & Running Instructions

### 1. Database Setup (Supabase)
Run `/supabase/schema.sql` inside your Supabase SQL Editor to create all required tables (`profiles`, `students`, `subjects`, `prerequisites`, `academic_records`, `recommendations`, `settings`, `chat_logs`), configure Row Level Security (RLS) policies, and seed default BSIT curriculum subjects & settings.

### 2. Environment Variables Configuration
Copy `.env.example` to `.env` in both backend and frontend root:

```bash
# Backend Environment (.env or process environment)
PORT=5000
SUPABASE_URL=https://your-supabase-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
GEMINI_API_KEY=your-google-gemini-api-key

# Frontend Environment (.env)
VITE_API_BASE_URL=http://localhost:5000/api
VITE_SUPABASE_URL=https://your-supabase-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### 3. Run Backend API Server & Unit Tests

```bash
# Navigate to backend directory
cd backend

# Run isolated assessment engine unit tests
npm test

# Start the Express API server (runs on http://localhost:5000)
npm start
```

### 4. Run Frontend React Web Application

```bash
# Navigate to frontend directory
cd frontend

# Start the Vite development server
npm run dev
```

Open your browser to `http://localhost:5173`.

---

## 👥 Demo Accounts & One-Click Role Switcher

- **Student**: Student Portal (BSIT 2nd/3rd Year) — View grades, eligibility status, approved recommendations, AI academic chatbot.
- **Registrar Staff**: `Maria Santos` — Approve pending student signups, encode student grades, run assessment engine, review/approve recommendations, view analytics.
- **Registrar Admin**: `Dr. Roberto Reyes` — All staff capabilities plus curriculum subjects & prerequisite mapper, institutional threshold settings, and staff account management.

---

## 🧪 Unit Testing

Run unit tests for the deterministic assessment engine:
```bash
cd backend
npm test
```
Verifies happy path prerequisite unlocking, failed prerequisite retake recommendations, and overall enrollment eligibility thresholds.
