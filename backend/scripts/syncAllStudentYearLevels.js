require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { supabase } = require('../config/supabase');

async function syncAllStudentYearLevels() {
  console.log('=== Syncing All Student Year Levels from Grade Records ===');

  // 1. Fetch all students
  const { data: students, error: sErr } = await supabase
    .from('students')
    .select('id, student_id, full_name, year_level');

  if (sErr) {
    console.error('Error fetching students:', sErr);
    process.exit(1);
  }
  console.log(`Fetched ${students.length} students from Supabase.`);

  // 2. Fetch all grade records (paginated)
  let allGrades = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data: page, error: grErr } = await supabase
      .from('grade_records')
      .select('student_id, year_level, semester')
      .range(from, from + pageSize - 1);

    if (grErr) {
      console.error('Error fetching grade records:', grErr);
      process.exit(1);
    }
    allGrades.push(...(page || []));
    if (!page || page.length < pageSize) break;
    from += pageSize;
  }
  console.log(`Fetched ${allGrades.length} total grade records from Supabase.`);

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

  // 4. Compute and update each student
  let updatedCount = 0;
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
    const sem2Counts = new Map();
    let hasSummerYear3 = false;

    stGrades.forEach(g => {
      const y = Number(g.year_level || 1);
      if (Number.isFinite(y) && y >= 1 && y <= 4 && y > maxYear) {
        maxYear = y;
      }
      const isSem2 = String(g.semester).toLowerCase().includes('second') || String(g.semester) === '2';
      const isSummer = String(g.semester).toLowerCase().includes('summer') || String(g.semester) === '3';
      if (isSem2 && Number.isFinite(y)) {
        sem2Counts.set(y, (sem2Counts.get(y) || 0) + 1);
      }
      if (isSummer && y === 3) {
        hasSummerYear3 = true;
      }
    });

    let calculatedYear = maxYear;
    // Year 1 -> 2: completing 2nd sem of Year 1
    if ((sem2Counts.get(1) || 0) >= 3) {
      calculatedYear = Math.max(calculatedYear, 2);
    }
    // Year 2 -> 3: completing 2nd sem of Year 2
    if ((sem2Counts.get(2) || 0) >= 3) {
      calculatedYear = Math.max(calculatedYear, 3);
    }
    // Year 3 -> 4: requires completing 3rd Year Summer OR taking Year 4 subjects (maxYear >= 4).
    // Completing 3rd Year 2nd Sem keeps the student in 3rd Year because Summer is still required!
    if (hasSummerYear3 || maxYear >= 4) {
      calculatedYear = Math.max(calculatedYear, 4);
    }
    calculatedYear = Math.min(4, Math.max(1, calculatedYear));

    const currentYear = Number(st.year_level || 1);
    if (currentYear !== calculatedYear) {
      const { error: upErr } = await supabase
        .from('students')
        .update({ year_level: calculatedYear })
        .eq('id', st.id);

      if (upErr) {
        console.error(`Failed to update student ${st.student_id}:`, upErr);
      } else {
        updatedCount++;
        changes.push({
          id: st.student_id,
          name: st.full_name,
          oldYear: currentYear,
          newYear: calculatedYear,
          gradesCount: stGrades.length
        });
      }
    } else {
      unchangedCount++;
    }
  }

  console.log(`\n=== Sync Results ===`);
  console.log(`Updated: ${updatedCount} students`);
  console.log(`Unchanged: ${unchangedCount} students`);
  console.log('\nSample Updates:');
  changes.forEach(c => {
    console.log(`- Student ${c.id} (${c.name}): Year ${c.oldYear} -> Year ${c.newYear} (Grades: ${c.gradesCount})`);
  });

  // Check student 12310 specifically
  const { data: st12310 } = await supabase
    .from('students')
    .select('student_id, full_name, year_level')
    .or('student_id.eq.12310,student_id.eq.GCT-12310');
  console.log('\nVerification of Student 12310:', st12310);

  // Check student 12718 specifically
  const { data: st12718 } = await supabase
    .from('students')
    .select('student_id, full_name, year_level')
    .or('student_id.eq.12718,student_id.eq.GCT-12718');
  console.log('Verification of Student 12718:', st12718);
}

syncAllStudentYearLevels()
  .then(() => {
    console.log('\nSync completed successfully!');
    process.exit(0);
  })
  .catch(err => {
    console.error('Fatal sync error:', err);
    process.exit(1);
  });
