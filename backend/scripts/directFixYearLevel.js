/**
 * Direct fix script: reads what's in the DB for affected students,
 * then sets year_level = 2 for all students currently stored as year 3
 * in BOTH the students table and grade_records.
 * Run with: node scripts/directFixYearLevel.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  console.log('=== Direct Year Level Fix ===\n');

  // 1. Show current state of ALL students
  const { data: allStudents, error: sErr } = await supabase
    .from('students')
    .select('student_id, full_name, year_level, program')
    .order('student_id');

  if (sErr) { console.error('Error reading students:', sErr.message); process.exit(1); }

  console.log('--- Current students table ---');
  allStudents.forEach(s => {
    console.log(`  ${s.student_id} | ${s.full_name} | Year ${s.year_level} | ${s.program}`);
  });

  // 2. Show grade_records year_level for each student
  console.log('\n--- grade_records year_level values ---');
  for (const s of allStudents) {
    const { data: gr } = await supabase
      .from('grade_records')
      .select('subject, year_level, semester, academic_year')
      .eq('student_id', s.student_id)
      .limit(5);
    if (gr && gr.length > 0) {
      const yrVals = [...new Set(gr.map(r => r.year_level))];
      console.log(`  ${s.student_id}: grade_records year_levels = [${yrVals.join(', ')}] (${gr.length} rows)`);
    }
  }

  // 3. Find students with year_level = 3
  const wrongStudents = allStudents.filter(s => Number(s.year_level) === 3);
  console.log(`\n--- Students with year_level=3: ${wrongStudents.length} ---`);
  wrongStudents.forEach(s => console.log(`  ${s.student_id} | ${s.full_name}`));

  if (wrongStudents.length === 0) {
    console.log('\nNo students with year_level=3 found. Checking if DB already correct...');
    console.log('Done.');
    return;
  }

  // 4. Fix students table
  const wrongIds = wrongStudents.map(s => s.student_id);
  console.log('\nFixing students table...');
  const { error: fixSErr } = await supabase
    .from('students')
    .update({ year_level: 2 })
    .in('student_id', wrongIds);
  if (fixSErr) console.error('  Error fixing students:', fixSErr.message);
  else console.log(`  Updated ${wrongIds.length} student(s) to year_level=2`);

  // 5. Fix grade_records table
  console.log('Fixing grade_records table...');
  const { error: fixGrErr } = await supabase
    .from('grade_records')
    .update({ year_level: 2 })
    .in('student_id', wrongIds);
  if (fixGrErr) console.error('  Error fixing grade_records:', fixGrErr.message);
  else console.log(`  Updated grade_records for ${wrongIds.length} student(s) to year_level=2`);

  // 6. Verify final state
  console.log('\n--- Verification: students table after fix ---');
  const { data: afterStudents } = await supabase
    .from('students')
    .select('student_id, full_name, year_level')
    .in('student_id', wrongIds);
  afterStudents?.forEach(s => {
    const ok = Number(s.year_level) === 2 ? '✓' : '✗ STILL WRONG';
    console.log(`  ${s.student_id} | ${s.full_name} | Year ${s.year_level} ${ok}`);
  });

  console.log('\nDone. Refresh the Student Directory page to see the fix.');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

