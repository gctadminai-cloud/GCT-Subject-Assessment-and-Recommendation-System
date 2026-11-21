const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { supabase } = require('../config/supabase');

async function main() {
  // Find all academic_records with any variant of 8888
  const { data: arRows, error } = await supabase
    .from('academic_records')
    .select('id, student_id, subject_id, term, status')
    .or('student_id.ilike.%8888%')
    .limit(30);

  if (error) { console.error('Error:', error.message); return; }
  console.log(`Academic records with 8888 in student_id: ${(arRows || []).length}`);
  (arRows || []).forEach(r => {
    console.log(`  student_id="${r.student_id}" subject_id="${r.subject_id}" term="${r.term}" year_level=${r.year_level}`);
  });

  // Also check grade_records
  const { data: grRows, error: grErr } = await supabase
    .from('grade_records')
    .select('id, student_id, subject, year_level, semester, academic_year')
    .or('student_id.ilike.%8888%')
    .limit(30);

  if (grErr) { console.error('GR Error:', grErr.message); return; }
  console.log(`\nGrade records with 8888 in student_id: ${(grRows || []).length}`);
  (grRows || []).slice(0, 5).forEach(r => {
    console.log(`  student_id="${r.student_id}" subject="${r.subject}" year_level=${r.year_level} sem="${r.semester}" ay="${r.academic_year}"`);
  });
}

main().catch(console.error);
