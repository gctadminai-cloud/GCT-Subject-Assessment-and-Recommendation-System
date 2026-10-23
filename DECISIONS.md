# Architectural & Design Decisions

This document records the architectural, visual, and domain governance decisions made during the development of the **GCT Subject Assessment and Recommendation System** for Garcia College of Technology.

---

## 1. Unified 3-Dashboard Reference Layout & Visual Architecture

To achieve a consistent, state-of-the-art user experience across all user roles, all three dashboards (**Registrar Admin**, **Registrar Staff**, and **Student**) strictly replicate the 3-row reference dashboard mockup structure:

### A. Layout Structure (Applied Universally Across Every Page)
1. **Persistent Top Bar**: Full-width header positioned above main content to the right of the sidebar across **all sub-pages**.
   - Left: Hamburger toggle button + Page title (e.g., "Dashboard" / "Academic Records" / "Assessment Engine") & descriptive welcome subtitle.
   - Right: Date range picker pill (`May 15, 2026 – May 21, 2026`), Notification Bell with unread indicator badge, and User Account Chip (avatar circle + name + role label).
2. **Hover-to-Reveal Left Sidebar**:
   - Collapses into a thin edge (14px) with a small chevron handle.
   - Slides open to 270px on mouse hover, revealing role menu items.
   - Active navigation item highlighted with a solid rounded terracotta pill (`#8B6F47`) and white text.
   - Includes Demo Role Switcher box when expanded.
   - Pinned Logout button at the bottom below a divider.
3. **Page-Level Stat Cards Row**:
   - Top metric card row sitting below top bar on **every sub-page**.
   - Features soft warm-tinted pastel icon circles, large bold metrics, and trend indicator lines.
4. **Middle 3-Panel Row (Dashboard Home)**:
   - Panel 1: **Trend Line/Area Chart** with light gradient fill & curve data points.
   - Panel 2: **Donut Chart** with total count in center and side legend list displaying segment colors, counts, and percentages.
   - Panel 3: **Recent Activity Feed** with colored circular icons, bold event titles, and actor/timestamp subtext.
5. **Bottom 2-Panel Row**:
   - Panel 1 (Bottom-Left): **Data Table Card** featuring status pill badges, eye action button, and role-appropriate action trigger buttons.
   - Panel 2 (Bottom-Right): **Role-Appropriate Right Panel Card**:
     - *Admin*: **System Status Card** (Supabase DB, Supabase Auth, AI Engine, Gemini API, Backup).
     - *Staff*: **Staff Operational Health Card** (Grade Sync Engine, Recommendation Queue, Report Generator, Audit Log Sync).
     - *Student*: **Student Quick Links & Campus Announcements Card** (AI Chatbot, Grade Records, Prerequisite Roadmap, Enrollment News).
6. **Footer**: Centered copyright text (`© 2026 Garcia College of Technology. All rights reserved.`).

---

## 2. Registrar Staff Sub-Page Additions & Domain Separation

### A. Academic Records vs. Student Records Split
- **Academic Records (`academic_records`)**: Dedicated specifically to student grades, term histories, pass/fail status per subject, and grade encoding forms.
- **Student Records (`student_records`)**: Dedicated to student profiles, program/year level enrollments, sections, and roster management.

### B. Standalone Assessment Engine Page (`assessment`)
- Allows Registrar Staff to select a student, execute deterministic prerequisite evaluation live, view a detailed matrix of subject-by-subject prerequisite checks, inspect the `ELIGIBLE` / `NOT ELIGIBLE` banner, and push results directly to the `Recommendation Review Queue`.

---

## 3. Color Palette & Design Tokens

- **Main Page Background**: `#F5F1E8` (warm off-white / light beige).
- **Sidebar Background**: `#EDE4D3` (tan / deeper beige).
- **Cards**: `#FFFFFF` crisp white with soft warm drop shadow `0 4px 14px rgba(139, 111, 71, 0.08)` and border `#E6DDCB`.
- **Primary Accent / Active Pill**: `#8B6F47` (warm brown / terracotta) & `#B4784A`.
- **Soft Warm-Tinted Icon Backgrounds**:
  - Terracotta tint: `#F5EBE1`
  - Gold tint: `#FEF3C7`
  - Green tint: `#E6F4EA`
  - Blue tint: `#EFF6FF`
  - Red tint: `#FCE8E6`
- **Semantic Badges**:
  - Approved / Eligible / Passed: `#E6F4EA` bg, `#15803D` text.
  - Pending Review / In Progress: `#EFF6FF` bg, `#1D4ED8` text.
  - Returned / Attention: `#FEF3C7` bg, `#D97706` text.
  - Failed / Retake / Not Eligible: `#FCE8E6` bg, `#B91C1C` text.

---

## 4. Multi-Port Development Configuration

- **Student Portal**: `npm run dev:student` $\rightarrow$ `http://localhost:3000`
- **Registrar Staff Portal**: `npm run dev:staff` $\rightarrow$ `http://localhost:3001`
- **Registrar Admin Portal**: `npm run dev:admin` $\rightarrow$ `http://localhost:3002`

---

## 5. Legacy Excel Account Import & Weekly Reset Exemption

- **Source**: `USERS_updated.xlsx` (250 BSIT students: ID Number, Password, Last Name, First Name, Course).
- **`backend/scripts/seedStudentsFromExcel.js`**: all 250 records are embedded directly in the script (no spreadsheet read at runtime). Run once with `npm run seed:students-excel`. Creates one `students` row (verified = true, no ID photos required — official legacy data) and one `accounts` row (bcrypt-hashed original password, role `student`, status `approved`, `bulk_imported = true`) per student. Safe to re-run (upserts on `student_id` / `username`).
- **`accounts.bulk_imported`** (new column, default `false`): marks an account as seeded from the Excel import rather than created through the normal registration flow.
- **`backend/cron/weeklyReset.js`**: the Monday wipe of student accounts now adds `.eq('bulk_imported', false)`, so the 250 Excel-imported logins are never deleted — only accounts created through normal self-registration are swept weekly, same as before.
- **Default Registrar Admin**: already provided by `backend/scripts/seedRegistrar.js` (`npm run seed:registrar`), username/password from `REGISTRAR_ADMIN_USERNAME` / `REGISTRAR_ADMIN_PASSWORD` env vars (falls back to `registrar_admin` / `admin123` if unset). No change needed — this already satisfies "may default Registrar Admin account."
