/**
 * Trace exactly what the assessment engine computes for student 8888.
 * Run: node backend/scripts/traceStudent8888Engine.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { supabase } = require('../config/supabase');
const { evaluateStudent, sortGradesNewestFirst, parseTermRank } = require('../services/assessmentEngine');

async function main() {
  const STUDENT_ID = '8888';

  const { data: students } = await supabase.from('students').select('*').eq('student_id', STUDENT_ID).limit(1);
  const student = students?.[0];
  if (!student) { console.error('Student not found'); process.exit(1); }
  console.log('STUDENT ROW:', JSON.stringify(student, null, 2));

  const { data: gradeRecs } = await supabase.from('grade_records').select('*')
    .or(`student_id.eq.${STUDENT_ID},student_id.eq.GCT-${STUDENT_ID}`);
  console.log('\nGRADE_RECORDS count:', gradeRecs?.length || 0);
  (gradeRecs || []).forEach(g => console.log(` - ${g.subject} | year_level=${g.year_level} | sem=${g.semester} | ay=${g.academic_year} | grade=${g.grade}`));

  const { data: academicRecs } = await supabase.from('academic_records').select('*')
    .or(`student_id.eq.${STUDENT_ID},student_id.eq.GCT-${STUDENT_ID}`);
  console.log('\nACADEMIC_RECORDS count:', academicRecs?.length || 0);
  (academicRecs || []).forEach(r => console.log(` - ${r.subject_id} | term=${r.term} | grade=${r.grade} | status=${r.status}`));

  const { data: curriculumSubjects } = await supabase.from('subjects').select('*').eq('program', student.program || 'BSIT');
  const { data: prerequisites } = await supabase.from('prerequisites').select('*');
  const { data: aySetting } = await supabase.from('settings').select('value').eq('key', 'activeAcademicYear').limit(1);
  const activeAcademicYear = aySetting?.[0]?.value || '2026-2027';

  const semNumeric = (raw) => {
    const s = String(raw || '').toLowerCase();
    if (s.includes('2nd') || s === '2' || s.includes('second')) return 2;
    if (s.includes('summer')) return 3;
    return 1;
  };

  const rawHistorical = (gradeRecs || []).map(g => {
    const semN = semNumeric(g.semester);
    const ay = String(g.academic_year || '').trim() || '2023-2024';
    const termLabel = `${ay} ${semN === 2 ? '2nd' : (semN === 3 ? 'Summer' : '1st')} Sem`;
    return {
      id: `gr-${g.id}`,
      student_id: g.student_id,
      code: g.subject, subject: g.subject,
      grade: g.grade, raw_grade: g.raw_grade,
      status: (g.raw_grade === '9' || g.grade === 9) ? 'dropped' : ((g.grade === 5 || g.raw_grade === '5') ? 'failed' : 'passed'),
      academic_year: ay, semester: semN,
      year_level: Number(g.year_level) || null,
      term: termLabel
    };
  });

  const rawAcademic = (academicRecs || []).map(r => ({
    ...r,
    academic_year: r.academic_year || (r.term ? r.term.match(/\d{4}-\d{4}/)?.[0] : null) || '2025-2026',
    semester: r.semester || semNumeric(r.term),
    term: r.term || '2025-2026 1st Sem'
  }));

  const studentGrades = sortGradesNewestFirst([...rawHistorical, ...rawAcademic]);
  console.log('\nMERGED GRADES (newest first):');
  studentGrades.forEach(g => {
    const r = parseTermRank(g);
    console.log(` - ${g.code || g.subject_id} | term=${g.term} | ay=${g.academic_year} | sem=${g.semester} | year_level=${g.year_level} | grade=${g.grade} | status=${g.status} | rank=${JSON.stringify(r)}`);
  });

  const result = evaluateStudent({
    studentGrades,
    curriculumSubjects: curriculumSubjects || [],
    prerequisites: prerequisites || [],
    studentInfo: { year_level: student.year_level, semester: student.semester, program: student.program },
    activeAcademicYear
  });

  console.log('\n=== ENGINE RESULT ===');
  console.log('catalogTerm:', JSON.stringify(result.catalogTerm));
  console.log('targetTerm:', JSON.stringify(result.targetTerm));
  console.log('latestRecordAnchor:', JSON.stringify(result.latestRecordAnchor));
  console.log('enrichmentApplied:', JSON.stringify(result.enrichmentApplied));
  console.log('summary:', JSON.stringify(result.summary));
  console.log('activeAcademicYear:', result.activeAcademicYear);

  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });

