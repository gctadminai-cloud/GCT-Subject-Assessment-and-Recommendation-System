/**
 * Fix student 8888's year_level from 3 → 2.
 * They only completed 2nd Year 1st Semester, so they are a 2nd year student.
 * Run once: node backend/scripts/fixStudent8888YearLevel.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { supabase } = require('../config/supabase');

async function main() {
  const STUDENT_ID = '8888';
  const CORRECT_YEAR_LEVEL = 2;
  const CORRECT_SEMESTER = 1; // completed 1st sem of 2nd year

  // 1. Check current state
  const { data: before, error: fetchErr } = await supabase
    .from('students')
    .select('student_id, full_name, year_level')
    .eq('student_id', STUDENT_ID)
    .limit(1);

  if (fetchErr) {
    console.error('Error fetching student:', fetchErr.message);
    process.exit(1);
  }

  if (!before || before.length === 0) {
    console.error(`Student ${STUDENT_ID} not found in students table.`);
    process.exit(1);
  }

  const current = before[0];
  console.log(`BEFORE: student_id=${current.student_id}, name=${current.full_name}, year_level=${current.year_level}`);

  if (current.year_level === CORRECT_YEAR_LEVEL) {
    console.log(`✅ Student ${STUDENT_ID} already has year_level=${CORRECT_YEAR_LEVEL}. No change needed.`);
    process.exit(0);
  }

  // 2. Apply correction
  const updatePayload = { year_level: CORRECT_YEAR_LEVEL };
  // Only set semester if the column exists; some schemas store it separately
  // updatePayload.semester = CORRECT_SEMESTER;

  const { data: updated, error: updateErr } = await supabase
    .from('students')
    .update(updatePayload)
    .eq('student_id', STUDENT_ID)
    .select('student_id, full_name, year_level');

  if (updateErr) {
    console.error('Error updating student:', updateErr.message);
    process.exit(1);
  }

  const after = updated?.[0];
  console.log(`AFTER:  student_id=${after?.student_id}, name=${after?.full_name}, year_level=${after?.year_level}`);
  console.log(`✅ Student ${STUDENT_ID} year_level corrected from ${current.year_level} → ${CORRECT_YEAR_LEVEL}.`);
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
