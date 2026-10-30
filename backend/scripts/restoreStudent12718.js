require('dotenv').config();
const bcrypt = require('bcryptjs');
const { supabase } = require('../config/supabase');
const allGrades = require('./data/grades.js');

async function restore() {
  console.log('=== Restoring Student 12718 (AREVALO, MARK LESTER) ===');
  const now = new Date().toISOString();

  // 1. Restore Student in `students` table
  console.log('1. Restoring student in students table...');
  const { data: stData, error: stErr } = await supabase.from('students').upsert([
    {
      id: 'student-12718',
      student_id: '12718',
      full_name: 'AREVALO, MARK LESTER',
      email: '12718@student.gct.edu.ph',
      program: 'BSIT',
      year_level: 2,
      status: 'approved',
      verified: true,
      created_at: now
    }
  ], { onConflict: 'student_id' }).select();
  if (stErr) console.error('Student upsert error:', stErr);
  else console.log('✓ Student restored in students table:', stData?.[0]?.student_id);

  // 2. Restore Account in `accounts` table
  console.log('2. Restoring student login in accounts table...');
  const studentHash = await bcrypt.hash('password123', 10);
  const { error: accErr } = await supabase.from('accounts').upsert([
    {
      id: 'acc-12718',
      student_id: '12718',
      username: '12718',
      password_hash: studentHash,
      role: 'student',
      status: 'approved',
      created_at: now
    }
  ], { onConflict: 'username' });
  if (accErr) console.error('Account upsert error:', accErr);
  else console.log("✓ Student account restored in accounts table (username: '12718')");

  // 3. Restore Profile in `profiles` table
  console.log('3. Restoring student in profiles table...');
  const { error: profErr } = await supabase.from('profiles').upsert([
    {
      id: 'acc-12718',
      email: '12718@student.gct.edu.ph',
      full_name: 'AREVALO, MARK LESTER',
      role: 'student',
      approval_status: 'approved',
      created_at: now
    }
  ], { onConflict: 'email' });
  if (profErr) console.error('Profile upsert error:', profErr);
  else console.log('✓ Student profile restored in profiles table');

  // 4. Restore Grades in `grade_records` table
  console.log('4. Extracting grades for 12718...');
  const list = Array.isArray(allGrades) ? allGrades : (allGrades.default || allGrades.grades || []);
  const st12718Grades = list.filter(g => String(g[0]).includes('12718') || String(g[1]).toUpperCase().includes('AREVALO'));
  console.log(`Found ${st12718Grades.length} grade records to restore.`);

  if (st12718Grades.length > 0) {
    const rowsToInsert = st12718Grades.map(g => ({
      student_id: '12718',
      last_name: g[1] || 'AREVALO',
      first_name: g[2] || 'MARK LESTER',
      full_name: g[3] || 'AREVALO, MARK LESTER',
      course: g[4] || 'BSIT',
      year_level: Number(g[5]) || 1,
      semester: g[6] || 'First',
      academic_year: g[7] || '2025-2026',
      subject: g[8],
      grade: g[9] !== null ? Number(g[9]) : null,
      units: Number(g[10]) || 3,
      raw_grade: String(g[11] || g[9] || ''),
      needs_review: Boolean(g[12]),
      created_at: now
    }));

    // Delete any old remnants first to ensure clean state
    await supabase.from('grade_records').delete().eq('student_id', '12718');

    const { data: insertedGrades, error: grErr } = await supabase.from('grade_records').insert(rowsToInsert).select();
    if (grErr) console.error('Grade records insert error:', grErr);
    else console.log(`✓ Inserted ${insertedGrades?.length || rowsToInsert.length} records into grade_records table.`);
  }

  // 5. Verify restored state
  const { data: checkSt } = await supabase.from('students').select('*').eq('student_id', '12718');
  const { data: checkGr } = await supabase.from('grade_records').select('*').eq('student_id', '12718');
  console.log('\n=== VERIFICATION RESULT ===');
  console.log('Students count:', checkSt?.length, checkSt?.[0]?.full_name);
  console.log('Grade records count:', checkGr?.length);
  console.log('Sample subjects restored:', checkGr?.slice(0, 5).map(g => `${g.subject} (${g.grade})`).join(', '));
}

restore()
  .then(() => {
    console.log('Restore completed successfully!');
    process.exit(0);
  })
  .catch(err => {
    console.error('Restore error:', err);
    process.exit(1);
  });
