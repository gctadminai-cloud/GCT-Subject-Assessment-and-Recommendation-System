/**
 * Fast fix: bulk-update all year_level=3 students to year_level=2
 * in both students and grade_records tables in one shot.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  console.log('=== Quick Year Level Fix ===\n');

  // Show what year_level values exist in students table
  const { data: all } = await supabase
    .from('students')
    .select('student_id, full_name, year_level')
    .order('year_level');

  const counts = {};
  (all || []).forEach(s => {
    const y = s.year_level;
    counts[y] = (counts[y] || 0) + 1;
  });
  console.log('Current year_level distribution in students table:');
  Object.entries(counts).forEach(([y, c]) => console.log(`  Year ${y}: ${c} student(s)`));

  // Show specific students 2222, 4444, 8888
  const targets = (all || []).filter(s => ['2222','4444','8888'].includes(String(s.student_id)));
  console.log('\nTarget students (2222, 4444, 8888):');
  if (targets.length === 0) console.log('  (not found)');
  targets.forEach(s => console.log(`  ${s.student_id} | ${s.full_name} | year_level=${s.year_level}`));

  // Fix: set year_level=2 for all students currently at 3
  const year3Ids = (all || []).filter(s => Number(s.year_level) === 3).map(s => s.student_id);
  console.log(`\nStudents with year_level=3: ${year3Ids.length}`);

  if (year3Ids.length > 0) {
    // Fix students table in chunks of 500
    for (let i = 0; i < year3Ids.length; i += 500) {
      const chunk = year3Ids.slice(i, i + 500);
      const { error } = await supabase.from('students').update({ year_level: 2 }).in('student_id', chunk);
      if (error) console.error('  students fix error:', error.message);
      else console.log(`  Fixed students chunk ${i/500 + 1}: ${chunk.length} rows`);
    }

    // Fix grade_records table in chunks of 500
    for (let i = 0; i < year3Ids.length; i += 500) {
      const chunk = year3Ids.slice(i, i + 500);
      const { error } = await supabase.from('grade_records').update({ year_level: 2 }).in('student_id', chunk);
      if (error) console.error('  grade_records fix error:', error.message);
      else console.log(`  Fixed grade_records chunk ${i/500 + 1}: ${chunk.length} student IDs`);
    }
  }

  // Verify target students
  const { data: after } = await supabase
    .from('students')
    .select('student_id, full_name, year_level')
    .in('student_id', ['2222','4444','8888']);

  console.log('\n=== Verification after fix ===');
  if (!after || after.length === 0) {
    console.log('Students 2222, 4444, 8888 not found in DB.');
    console.log('They may have been deleted. Upload them again — the new code will set year_level correctly on upload.');
  } else {
    after.forEach(s => {
      const ok = Number(s.year_level) === 2 ? '✓ CORRECT' : '✗ WRONG';
      console.log(`  ${s.student_id} | ${s.full_name} | year_level=${s.year_level} ${ok}`);
    });
  }

  console.log('\nDone. Refresh the Student Directory page.');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });

