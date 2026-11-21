/**
 * fixYearLevels.js
 * One-shot script to recompute and correct year levels for all students.
 * Uses distinct-semester-term logic (not row count) to avoid inflating year level.
 * Run: node backend/scripts/fixYearLevels.js
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { supabase } = require('../config/supabase');

async function fixYearLevels() {
  console.log('=== Fixing Student Year Levels (distinct-term logic) ===\n');

  // 1. Fetch all students
  const { data: students, error: sErr } = await supabase
    .from('students')
    .select('id, student_id, full_name, year_level');

  if (sErr) { console.error('Error fetching students:', sErr); process.exit(1); }
  console.log(`Fetched ${students.length} students.\n`);

  // 2. Fetch all grade records (paginated), including academic_year for distinct-term logic
  let allGrades = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data: page, error: grErr } = await supabase
      .from('grade_records')
      .select('student_id, year_level, semester, academic_year')
      .range(from, from + pageSize - 1);
    if (grErr) { console.error('Error fetching grade records:', grErr); process.exit(1); }
    allGrades.push(...(page || []));
    if (!page || page.length < pageSize) break;
    from += pageSize;
  }
  console.log(`Fetched ${allGrades.length} total grade records.\n`);

  // 3. Map grades by student ID variants
  const gradesByStudent = new Map();
  allGrades.forEach(g => {
    if (!g.student_id) return;
    const sid = String(g.student_id).trim();
    const clean = sid.replace(/^GCT-/i, '');
    if (!gradesByStudent.has(sid)) gradesByStudent.set(sid, []);
    gradesByStudent.get(sid).push(g);
    if (clean !== sid) {
      if (!gradesByStudent.has(clean)) gradesByStudent.set(clean, []);
      gradesByStudent.get(clean).push(g);
    }
  });

  // 4. Compute correct year level for each student and update if wrong
  let fixedCount = 0;
  let unchangedCount = 0;
  const changes = [];

  for (const st of students) {
    const sid = String(st.student_id || '').trim();
    const clean = sid.replace(/^GCT-/i, '');
    const stGrades = gradesByStudent.get(sid) || gradesByStudent.get(clean) || [];

    if (stGrades.length === 0) {
      unchangedCount++;
      continue;
    }

    let maxYear = 1;
    // Track DISTINCT (academic_year + semester) terms per year level for 2nd-sem advancement
    const sem2TermsSeen = new Map(); // year -> Set of "ay|sem" strings
    let hasSummerYear3 = false;

    stGrades.forEach(g => {
      const y = Number(g.year_level || 1);
      if (Number.isFinite(y) && y >= 1 && y <= 4 && y > maxYear) maxYear = y;
      const semStr = String(g.semester || '').toLowerCase().trim();
      const isSem2 = semStr.includes('second') || semStr === '2' || semStr.includes('2nd');
      const isSummer = semStr.includes('summer') || semStr === '3';
      if (isSem2 && Number.isFinite(y)) {
        // Key = "academic_year|semester_string" — same term across many subjects = same key
        const termKey = `${(g.academic_year || '').trim()}|${semStr}`;
        if (!sem2TermsSeen.has(y)) sem2TermsSeen.set(y, new Set());
        sem2TermsSeen.get(y).add(termKey);
      }
      if (isSummer && y === 3) hasSummerYear3 = true;
    });

    const sem2TermCount = (y) => sem2TermsSeen.has(y) ? sem2TermsSeen.get(y).size : 0;
    let calculatedYear = maxYear;
    if (hasSummerYear3 || maxYear >= 4) calculatedYear = Math.max(calculatedYear, 4);
    calculatedYear = Math.min(4, Math.max(1, calculatedYear));

    const currentYear = Number(st.year_level || 1);
    if (currentYear !== calculatedYear) {
      const { error: upErr } = await supabase
        .from('students')
        .update({ year_level: calculatedYear })
        .eq('id', st.id);

      if (upErr) {
        console.error(`  ERROR updating ${sid}:`, upErr.message);
      } else {
        fixedCount++;
        changes.push(`  ${st.full_name || sid} (${sid}): Year ${currentYear} -> Year ${calculatedYear}`);
        console.log(`  FIXED: ${st.full_name || sid} (${sid}) — Year ${currentYear} → Year ${calculatedYear}`);
        console.log(`         sem2 distinct terms at year1=${sem2TermCount(1)}, year2=${sem2TermCount(2)}, maxYear=${maxYear}`);
      }
    } else {
      unchangedCount++;
    }
  }

  // Also clear the in-memory cache so the Student Directory reflects changes immediately
  if (global._cachedStudentSummaries !== undefined) {
    global._cachedStudentSummaries = null;
    global._cachedStudentSummariesTime = 0;
  }

  console.log(`\n=== Done ===`);
  console.log(`Fixed: ${fixedCount} students`);
  console.log(`Unchanged: ${unchangedCount} students`);
  if (changes.length > 0) {
    console.log('\nChanges made:');
    changes.forEach(c => console.log(c));
  }
  process.exit(0);
}

fixYearLevels().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
