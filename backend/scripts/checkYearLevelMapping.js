const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { supabase } = require('../config/supabase');

function normalizeSubjCode(str) {
  if (!str) return '';
  return String(str).replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

async function main() {
  // Fetch subjects to build codeMap (same as recordsController does)
  const { data: subjects } = await supabase.from('subjects').select('id, code, title, year_level, semester, program');
  
  const subjectsMap = new Map();
  const codeMap = new Map();
  (subjects || []).forEach(s => {
    subjectsMap.set(s.id, s);
    if (s.code) {
      codeMap.set(s.code.toLowerCase().trim(), s);
      const norm = normalizeSubjCode(s.code);
      codeMap.set(norm, s);
    }
    if (s.title) {
      codeMap.set(s.title.toLowerCase().trim(), s);
      const titleNorm = normalizeSubjCode(s.title);
      codeMap.set(titleNorm, s);
    }
  });

  console.log(`Subjects loaded: ${(subjects||[]).length}, codeMap size: ${codeMap.size}`);

  // Fetch academic_records for student 8888
  const { data: arRows } = await supabase
    .from('academic_records')
    .select('id, student_id, subject_id, term, status, grade')
    .or('student_id.ilike.%8888%');

  console.log(`\nAcademic records: ${(arRows||[]).length}`);
  
  // Test lookup for each record (same logic as recordsController lines 250-285)
  (arRows || []).forEach(r => {
    const sub = subjectsMap.get(r.subject_id) || codeMap.get((r.subject_id || '').toLowerCase().trim());
    const subNorm = (sub?.code || r.subject_id || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const year_level = Number(r.year_level || sub?.year_level || 1);
    const semester = sub?.semester || 1;
    
    if (!sub) {
      console.log(`  ❌ NO MATCH: subject_id="${r.subject_id}" → year_level defaults to 1`);
    } else {
      console.log(`  ✅ "${r.subject_id}" → code="${sub.code}" year_level=${year_level} sem=${semester} term="${r.term}"`);
    }
  });

  // Also show what grade_records return for year_level
  const { data: grRows } = await supabase
    .from('grade_records')
    .select('student_id, subject, year_level, semester, academic_year')
    .or('student_id.ilike.%8888%')
    .order('academic_year');

  console.log(`\nGrade records: ${(grRows||[]).length}`);
  // Check if year_level in grade_records has correct data
  const yr2Records = (grRows||[]).filter(r => r.year_level === 2);
  const yr1Records = (grRows||[]).filter(r => r.year_level === 1);
  console.log(`  Year 1 records: ${yr1Records.length}`);
  console.log(`  Year 2 records: ${yr2Records.length}`);
  yr2Records.forEach(r => {
    console.log(`    "${r.subject}" year_level=${r.year_level} sem="${r.semester}" ay="${r.academic_year}"`);
  });
}

main().catch(console.error);

