require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { evaluateStudent, sortGradesNewestFirst, parseTermRank } = require('../services/assessmentEngine');
const { getPassingThreshold, getMaxFailedPrereqs } = require('../controllers/settingsController');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const TARGET = '10526';

async function main() {
  // 1. Student
  const { data: students } = await supabase.from('students').select('*').or(`id.eq.${TARGET},student_id.eq.${TARGET}`).limit(1);
  const student = students[0];
  console.log('Student:', student?.full_name, 'Yr', student?.year_level, 'Sem', student?.semester || '(not set)');

  // 2. Grades
  const cleanSId = String(student.student_id || student.id).replace(/^GCT-/i, '');
  const [{ data: historical }, { data: academic }] = await Promise.all([
    supabase.from('grade_records').select('*').or(`student_id.eq.${student.student_id},student_id.eq.${cleanSId},student_id.eq.GCT-${cleanSId}`),
    supabase.from('academic_records').select('*').or(`student_id.eq.${student.id},student_id.eq.${student.student_id}`)
  ]);
  console.log('Historical grades:', historical.length, 'Academic records:', academic.length);

  const semNumeric = (raw) => {
    const s = String(raw || '').toLowerCase();
    if (s.includes('2nd') || s === '2' || s.includes('second')) return 2;
    if (s.includes('summer')) return 3;
    return 1;
  };
  const rawHistorical = historical.map(g => {
    const semN = semNumeric(g.semester);
    const ay = String(g.academic_year || '').trim() || (g.year_level ? `${2024 - (5 - Number(g.year_level))}-${2025 - (5 - Number(g.year_level))}` : '2023-2024');
    return {
      id: `gr-${g.id}`, code: g.subject, subject: g.subject,
      grade: g.grade, raw_grade: g.raw_grade,
      status: (g.raw_grade === '9' || g.grade === 9) ? 'dropped' : ((g.grade === 5 || g.raw_grade === '5') ? 'failed' : 'passed'),
      academic_year: ay, semester: semN, year_level: Number(g.year_level) || null,
      term: `${ay} ${semN === 2 ? '2nd' : (semN === 3 ? 'Summer' : '1st')} Sem`
    };
  });
  const rawAcademic = academic.map(r => ({
    ...r, academic_year: r.academic_year || (r.term ? r.term.match(/\d{4}-\d{4}/)?.[0] : null) || '2025-2026',
    semester: r.semester || semNumeric(r.term), term: r.term || '2025-2026 1st Sem'
  }));
  const studentGrades = sortGradesNewestFirst([...rawHistorical, ...rawAcademic]);
  console.log('Total normalized grade rows:', studentGrades.length);

  // 3. Curriculum + prereqs
  const { data: curriculumSubjects } = await supabase
    .from('subjects').select('*').eq('program', student.program || 'BSIT').order('year_level').order('semester');
  const { data: prerequisites } = await supabase.from('prerequisites').select('*');
  console.log('Curriculum subjects:', curriculumSubjects.length, 'Prerequisite pairs:', prerequisites.length);

  // 4. Run evaluation
  const passingThreshold = await getPassingThreshold();
  const maxFailedPrereqs = await getMaxFailedPrereqs();
  const ev = evaluateStudent({
    studentGrades, curriculumSubjects, prerequisites, passingThreshold, maxFailedPrereqs
  });

  // ====== DIAGNOSTICS ======
  console.log('\n========= DIAGNOSTICS =========');
  console.log('SubjectStatuses total:', ev.subjectStatuses.length);
  console.log('Summary totals:', ev.summary);

  // Sample: What was found for CC 103, CC 104, Hum 2, NSTP 2, CW 1, STS 1, PE 2, Hum 1 (the retakes)
  const retakeCodes = ['CC 103', 'CC 104', 'Hum 2', 'NSTP 2', 'CW 1', 'STS 1', 'PE 2', 'Hum 1', 'IT 9', 'Math 4', 'IT 15'];
  console.log('\nPer-subject grades in gradeMap vs engine final:');
  retakeCodes.forEach(code => {
    const inGrades = studentGrades.filter(g => g.code === code);
    console.log(`  ${code.padEnd(10)} — grades:`, inGrades.map(g => `${g.term}=${g.status}(${g.grade})`).join(', '));
    const statusSubj = ev.subjectStatuses.find(s => s.code === code);
    console.log(`              engine final: ${statusSubj?.status} grade=${statusSubj?.grade}`);
  });

  // What subject_id types are used in the engine maps
  const gradeMapKeys = []; const failSet = new Set(); const passSet = new Set();
  const semN2 = (raw) => { const s = String(raw || '').toLowerCase(); if (s.includes('2nd') || s === '2' || s.includes('second')) return 2; if (s.includes('summer')) return 3; return 1; };
  const simSorted = sortGradesNewestFirst(studentGrades);
  const passSeenSet = new Set(); const gradeMap = new Map();
  simSorted.forEach(record => {
    const isDrop = record.status === 'dropped' || record.raw_grade === '9' || record.grade === 9 || String(record.raw_grade).toUpperCase() === 'DRP';
    const isFail = !isDrop && (record.status === 'failed' || record.grade === 5 || record.raw_grade === '5' || (record.grade !== null && Number(record.grade) > 3.0 && Number(record.grade) <= 5.0));
    let computedStatus = record.status || 'passed';
    if (isDrop) computedStatus = 'dropped'; else if (isFail) computedStatus = 'failed';
    else if (record.grade !== null && record.grade !== undefined && record.grade !== '') {
      const n = Number(record.grade); if (!Number.isNaN(n) && n <= 3.0) computedStatus = 'passed';
    }
    const key = record.subject_id || record.code || record.subject;
    if (computedStatus === 'passed') { passSeenSet.add(key); gradeMap.set(key, { ...record, status: computedStatus }); return; }
    if (passSeenSet.has(key)) return;
    if (!gradeMap.has(key)) gradeMap.set(key, { ...record, status: computedStatus });
  });
  gradeMap.forEach((r, k) => {
    if (r.status === 'passed') passSet.add(k); else failSet.add(k);
  });

  console.log('\ngradeMap key samples (5 pass + 5 fail):');
  console.log('  PASS keys:', [...passSet].slice(0, 5).map(k => String(k).slice(0, 20)).join(', '));
  console.log('  FAIL keys:', [...failSet].slice(0, 5).map(k => String(k).slice(0, 20)).join(', '));
  console.log('Total failed in gradeMap:', failSet.size);
  console.log('Total passed in gradeMap:', passSet.size);

  console.log('\nSubject sample — first 5 curriculum subject.id types:');
  curriculumSubjects.slice(0, 5).forEach(s => {
    console.log(`  subj.id=${String(s.id)} (typeof ${typeof s.id}) code=${s.code} Yr${s.year_level}S${s.semester}`);
  });

  // Now show all failedSubjectIds from engine that the subjectLookup CANNOT find
  console.log('\n==== Check: Failed subject ids from gradeMap FOUND in subjectLookup? ====');
  const lookup = new Map(curriculumSubjects.map(s => [s.id, s]));
  const lookupByCode = new Map(curriculumSubjects.map(s => [s.code, s]));
  let notFoundFail = 0; let foundFail = 0;
  failSet.forEach(fid => {
    const byId = lookup.get(fid);
    const byCode = lookupByCode.get(String(fid));
    if (byId) { console.log(`✅ foundById: ${fid} -> ${byId.code}`); foundFail++; }
    else if (byCode) { console.log(`⚠️  NOT BY ID, BUT BY CODE: key=${fid} exists in DB with subj.id=${String(byCode.id)} code=${byCode.code}`); notFoundFail++; }
    else { console.log(`❌ NOT FOUND: key=${fid} (no subject in curriculum matches)`); notFoundFail++; }
  });

  console.log('\n=========== RECOMMENDATION OUTPUT FROM ENGINE ==========');
  const retakeRecs = ev.recommendedSubjects.filter(r => r.reason === 'retake');
  const regularRecs = ev.recommendedSubjects.filter(r => r.reason === 'unlocked');
  console.log('RETAKE REQUIRED (should be 0):', retakeRecs.length);
  retakeRecs.forEach(r => console.log('  🔴', r.code, '-', r.title, '-', r.notes));
  console.log('\nREGULAR UNLOCKED:', regularRecs.length);
  regularRecs.slice(0, 20).forEach(r => console.log('  🟢', r.code.padEnd(10), r.title.padEnd(40), 'Yr', r.year_level, 'S', r.semester, '|', r.notes));
  console.log('\nTOTAL RECOMMENDED SUBJECTS (retake + regular):', ev.recommendedSubjects.length);

  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
