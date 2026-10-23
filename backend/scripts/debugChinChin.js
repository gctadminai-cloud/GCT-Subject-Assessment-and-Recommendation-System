require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const TARGET = '10526';

(async () => {
  console.log('🔍 DEBUGGING STUDENT:', TARGET, '\n');

  // 1. Find the student
  const { data: students } = await supabase
    .from('students')
    .select('*')
    .or(`id.eq.${TARGET},student_id.eq.${TARGET},student_id.eq.GCT-${TARGET}`);

  console.log('📋 STUDENT RECORDS FOUND:', students?.length || 0);
  students?.forEach(s => {
    console.log('  -', s.id, '| student_id:', s.student_id, '| name:', s.full_name,
                '| program:', s.program, '| year:', s.year_level, '| section:', s.section, '| schedule:', s.schedule);
  });

  const allStudentIds = new Set();
  students?.forEach(s => {
    allStudentIds.add(String(s.id));
    allStudentIds.add(String(s.student_id));
    if (s.student_id) {
      allStudentIds.add(String(s.student_id).replace(/^GCT-/i, ''));
      allStudentIds.add('GCT-' + String(s.student_id).replace(/^GCT-/i, ''));
    }
  });
  allStudentIds.add(TARGET);
  allStudentIds.add('GCT-' + TARGET);
  console.log('\n🔎 Searching grades with IDs:', Array.from(allStudentIds).join(', '));

  // 2. grade_records (Excel imported historical grades)
  const { data: gradeRows } = await supabase
    .from('grade_records')
    .select('*')
    .in('student_id', Array.from(allStudentIds))
    .order('academic_year', { ascending: true })
    .order('semester', { ascending: true });

  console.log('\n===== GRADE_RECORDS (historical Excel import):', gradeRows?.length || 0, 'rows =====');
  const subjectsInGr = new Map();
  gradeRows?.forEach(g => {
    const key = String(g.subject || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    if (!subjectsInGr.has(key)) subjectsInGr.set(key, []);
    subjectsInGr.get(key).push({
      ay: g.academic_year, sem: g.semester, raw: g.raw_grade, grade: g.grade,
      status: (g.raw_grade === '9' || g.grade === 9) ? 'DRP'
             : ((g.raw_grade === '5' || g.grade === 5 || (g.grade !== null && Number(g.grade) > 3.0)) ? 'FAIL' : 'PASS'),
      full_name: g.full_name
    });
    console.log(`  [${g.academic_year} | Sem ${g.semester}] ${g.subject.padEnd(10)} | raw=${String(g.raw_grade).padEnd(4)} | grade=${g.grade} | yr_lvl=${g.year_level}`);
  });

  // 3. academic_records (manually entered records)
  const { data: acRecs } = await supabase
    .from('academic_records')
    .select('*')
    .in('student_id', Array.from(allStudentIds))
    .order('created_at', { ascending: true });

  console.log('\n===== ACADEMIC_RECORDS (manual entries):', acRecs?.length || 0, 'rows =====');
  acRecs?.forEach(r => {
    const key = String(r.subject_id || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    if (!subjectsInGr.has(key)) subjectsInGr.set(key, []);
    subjectsInGr.get(key).push({
      term: r.term, grade: r.grade, status: r.status, created_at: r.created_at
    });
    console.log(`  [term: ${r.term}] ${String(r.subject_id).padEnd(10)} | grade=${r.grade} | status=${r.status} | created=${r.created_at}`);
  });

  // 4. Per-subject summary with PASS FOREVER rule
  console.log('\n===== PER-SUBJECT FINAL STATUS (Pass wins FOREVER, newest non-pass used otherwise) =====');
  const summary = [];
  subjectsInGr.forEach((attempts, key) => {
    const hasPass = attempts.some(a => a.status === 'PASS');
    const newestFail = [...attempts].reverse().find(a => a.status !== 'PASS');
    summary.push({
      code: key,
      attemptsCount: attempts.length,
      finalStatus: hasPass ? 'PASS ✓' : (newestFail ? `${newestFail.status} ✗ (most recent: ${newestFail.ay || newestFail.term || '?'})` : '?'),
      hasPass,
      termOfFail: newestFail ? (newestFail.ay || newestFail.term) : null,
      gradeOfFail: newestFail ? (newestFail.grade || newestFail.raw) : null
    });
    console.log(`  ${key.padEnd(12)} | tries=${attempts.length} | FINAL: ${summary[summary.length - 1].finalStatus}`);
  });

  const activeDeficiencies = summary.filter(s => !s.hasPass && s.finalStatus.includes('FAIL'));
  console.log('\n📊 ACTIVE DEFICIENCIES (really-need-retake subjects):', activeDeficiencies.length);
  activeDeficiencies.forEach(d => console.log('  -', d.code, d.finalStatus, '| grade:', d.gradeOfFail, '| term:', d.termOfFail));

  // 5. Student's year level vs curriculum progression
  const student = students?.[0];
  if (student) {
    const sYr = Number(student.year_level) || 1;
    const sSem = student.semester && String(student.semester).trim() !== '' ? Number(student.semester) : NaN;
    console.log(`\n📚 STUDENT CURRICULUM STANDING:`, {
      name: student.full_name, program: student.program,
      catalog_year: sYr, catalog_semester: isNaN(sSem) ? '(not set — assumed 1st Sem default)' : sSem,
      section: student.section
    });
  }

  console.log('\n✅ Debug complete.');
  process.exit(0);
})();
