/**
 * seedAll.js - loads EVERYTHING from the Excel files into Supabase.
 *   - Registrar Admin + Staff accounts (from .env)
 *   - 250 students (students + accounts + profiles), original passwords bcrypt-hashed
 *   - 11,374 grade rows -> grade_records
 *
 * Data is embedded in ./data/users.js and ./data/grades.js (no Excel read at runtime).
 * Safe to re-run: everything is upserted, nothing is duplicated.
 *
 * Usage (from /backend):  node scripts/seedAll.js            (real seed)
 *                         node scripts/seedAll.js --dry-run  (checks data only, no DB)
 *
 * This script talks to Supabase DIRECTLY. It does NOT use config/supabase.js, because that
 * file silently falls back to an in-memory fake DB - which would make a seed look successful
 * while writing nothing to Supabase.
 */
const users = require('./data/users');
const grades = require('./data/grades');

const DRY = process.argv.includes('--dry-run');
const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

if (DRY) {
  const flagged = grades.filter(g => g[12]).length;
  console.log(`DRY RUN OK: ${users.length} students, ${grades.length} grade rows (${flagged} flagged needs_review)`);
  process.exit(0);
}

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { createClient } = require('@supabase/supabase-js');

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || SUPABASE_URL.includes('your-supabase-project')) {
  console.error('STOP: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in backend/.env first.');
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

async function must(label, promise) {
  const { error } = await promise;
  if (error) { console.error(`FAILED ${label}: ${error.message}`); process.exit(1); }
}

async function seedRegistrar() {
  const now = new Date().toISOString();
  const adminU = process.env.REGISTRAR_ADMIN_USERNAME || 'registrar_admin';
  const adminP = process.env.REGISTRAR_ADMIN_PASSWORD || 'AdminGCT2026!';
  await must('accounts (registrar)', supabase.from('accounts').upsert([
    { id: 'acc-admin-1', student_id: null, username: adminU, password_hash: await bcrypt.hash(adminP, 10), role: 'registrar_admin', status: 'approved', created_at: now },
  ], { onConflict: 'username' }));
  await must('profiles (registrar)', supabase.from('profiles').upsert([
    { id: 'demo-admin-id', email: `${adminU}@gct.edu.ph`, role: 'registrar_admin', full_name: 'System Administrator', approval_status: 'approved' },
  ], { onConflict: 'email' }));
  console.log(`ok  registrar admin '${adminU}' (System Administrator)`);
}

async function seedStudents() {
  const now = new Date().toISOString();
  const students = [], accounts = [], profiles = [];
  for (const [sid, password, last, first, course, yearLevel] of users) {
    const fullName = `${last}, ${first}`;
    students.push({ id: `student-${sid}`, student_id: sid, full_name: fullName, program: course, year_level: yearLevel, section: 'A', schedule: 'Schedule 1', status: 'approved', verified: true, created_at: now });
    accounts.push({ id: `acc-${sid}`, student_id: sid, username: sid, password_hash: bcrypt.hashSync(password, 10), role: 'student', status: 'approved', bulk_imported: true, created_at: now });
    profiles.push({ id: `student-${sid}`, email: `${sid}@student.gct.edu.ph`, role: 'student', full_name: fullName, approval_status: 'approved', created_at: now });
  }
  for (const b of chunk(students, 100)) await must('students', supabase.from('students').upsert(b, { onConflict: 'student_id' }));
  for (const b of chunk(accounts, 100)) await must('accounts', supabase.from('accounts').upsert(b, { onConflict: 'username' }));
  for (const b of chunk(profiles, 100)) await must('profiles', supabase.from('profiles').upsert(b, { onConflict: 'email' }));
  console.log(`ok  ${students.length} students + accounts + profiles`);
}

async function seedGrades() {
  const rows = grades.map(([student_id, last_name, first_name, full_name, course, year_level, semester, academic_year, subject, grade, units, raw_grade, needs_review]) =>
    ({ student_id, last_name, first_name, full_name, course, year_level, semester, academic_year, subject, grade, units, raw_grade, needs_review }));
  let done = 0;
  for (const b of chunk(rows, 500)) {
    await must('grade_records', supabase.from('grade_records').upsert(b, { onConflict: 'student_id,subject,academic_year,semester' }));
    done += b.length;
    process.stdout.write(`\r    grades ${done}/${rows.length}`);
  }
  console.log(`\nok  ${rows.length} grade rows`);
}

(async () => {
  console.log('Seeding Supabase at', SUPABASE_URL);
  await seedRegistrar();
  await seedStudents();
  await seedGrades();
  console.log('\nDONE. Run: node scripts/verifyDb.js');
})();
