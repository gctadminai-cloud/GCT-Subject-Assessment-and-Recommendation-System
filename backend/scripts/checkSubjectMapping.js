const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { supabase } = require('../config/supabase');

// Normalize subject code similar to backend logic
function normalizeSubjCode(str) {
  if (!str) return '';
  return String(str).replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

async function main() {
  // Get academic_records for student 8888 to see subject_ids
  const { data: arRows } = await supabase
    .from('academic_records')
    .select('subject_id, term, year_level')
    .or('student_id.eq.8888,student_id.eq.GCT-8888')
    .order('term');

  console.log('=== ACADEMIC_RECORDS subject_ids ===');
  (arRows || []).forEach(r => {
    console.log(`  subject_id="${r.subject_id}" term="${r.term}" year_level=${r.year_level}`);
  });

  // Get subjects table
  const { data: subjects } = await supabase
    .from('subjects')
    .select('id, code, title, year_level, semester, program');

  console.log(`\n=== SUBJECTS TABLE (${(subjects || []).length} rows) ===`);
  
  // Try to match the 2nd Year subjects for student 8888
  const year2SubjectIds = (arRows || []).filter(r => r.term && r.term.includes('2026-2027')).map(r => r.subject_id);
  
  console.log('\n=== Matching 2nd Year subject_ids to subjects table ===');
  year2SubjectIds.forEach(sid => {
    const norm = normalizeSubjCode(sid);
    const match = (subjects || []).find(s => {
      const cNorm = normalizeSubjCode(s.code);
      const tNorm = normalizeSubjCode(s.title);
      return cNorm === norm || tNorm === norm;
    });
    if (match) {
      console.log(`  ✅ "${sid}" → code="${match.code}" year_level=${match.year_level} sem=${match.semester}`);
    } else {
      console.log(`  ❌ "${sid}" → NO MATCH in subjects table`);
    }
  });

  // Also show the subjects table for BSIT 2nd year
  console.log('\n=== BSIT 2nd Year subjects in DB ===');
  (subjects || []).filter(s => s.year_level === 2 && s.program === 'BSIT').forEach(s => {
    console.log(`  code="${s.code}" title="${s.title}" year_level=${s.year_level} sem=${s.semester}`);
  });
}

main().catch(console.error);
