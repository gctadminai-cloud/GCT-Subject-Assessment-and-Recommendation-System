require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { normalizeSubjCode } = require('../utils/subjectNormalizer.js');
const { buildBSITCurriculum } = require('../utils/bsitCurriculum.js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// ===== Replicate curriculumData.ts logic but in Node =====
function termKey(yearLevel, semester) { return `${yearLevel}-${semester}`; }

function isDrop(g) {
  if (g.status === 'dropped' || g.status === 'Drop') return true;
  if (g.raw_grade === '9' || g.raw_grade === 9 || g.grade === 9 || String(g.raw_grade).toUpperCase() === 'DRP') return true;
  return false;
}
function isPassed(g) {
  if (isDrop(g)) return false;
  if (g.status === 'passed' || g.status === 'Pass' || g.status === 'Completed') return true;
  const n = Number(g.grade);
  if (!Number.isFinite(n)) return false;
  return n > 0 && n <= 3.0;
}
function isFail(g) { return !isDrop(g) && !isPassed(g); }

function gradeRecencyRank(g) {
  const yr = Number(String(g.term || '').split('-')[0] || String(g.academic_year || '').split('-')[0] || 0);
  let semR = 0;
  const t = String(g.term || '').toLowerCase();
  if (t.includes('1st')) semR = 1; else if (t.includes('2nd')) semR = 2; else if (t.includes('summer')) semR = 3;
  const s2 = Number(g.semester) || 0;
  const sem = Math.max(semR, s2);
  const created = g.created_at || g.createdAt || '';
  return (yr * 100) + (sem * 10) + (created ? new Date(created).getTime() % 1000 : 0);
}
function sortGradeAttemptsNewestFirst(list) { return [...list].sort((a, b) => gradeRecencyRank(b) - gradeRecencyRank(a)); }

async function main() {
  const TARGET = '10526';
  const { data: students } = await supabase.from('students').select('*').or(`id.eq.${TARGET},student_id.eq.${TARGET}`);
  const student = students?.[0];
  if (!student) { console.log('❌ Student not found'); process.exit(1); }

  // Fetch both grade_records + academic_records
  const [{ data: gradeRows }, { data: acRecs }] = await Promise.all([
    supabase.from('grade_records').select('*').in('student_id', [student.id, student.student_id]),
    supabase.from('academic_records').select('*').in('student_id', [student.id, student.student_id])
  ]);

  // Merge grades — normalize codes
  const grades = [];
  gradeRows?.forEach(g => {
    let ay = String(g.academic_year || '').trim();
    if (!ay) {
      const base = 2024 - (5 - Number(g.year_level || 1));
      ay = `${base}-${base + 1}`;
    }
    const semStr = String(g.semester || '').toLowerCase();
    let semester = 0;
    if (semStr.includes('first') || semStr === '1') semester = 1;
    else if (semStr.includes('second') || semStr === '2') semester = 2;
    else if (semStr.includes('summer') || semStr === '3') semester = 3;
    else semester = Number(g.semester) || 0;

    const label = semester === 1 ? '1st' : semester === 2 ? '2nd' : semester === 3 ? 'Summer' : '1st';
    grades.push({
      id: g.id, code: g.subject, subject: g.subject,
      term: `${ay} ${label} Sem`,
      academic_year: ay, semester,
      grade: g.grade, raw_grade: g.raw_grade,
      status: (g.raw_grade === '9' || g.grade === 9) ? 'dropped'
             : ((g.grade === 5 || g.raw_grade === '5' || (Number.isFinite(Number(g.grade)) && Number(g.grade) > 3.0)) ? 'failed' : 'passed'),
      createdAt: g.created_at
    });
  });
  acRecs?.forEach(r => {
    grades.push({
      id: r.id, code: r.subject_id, subject: r.subject_id,
      term: r.term, academic_year: r.term?.split(' ')[0] || '',
      semester: String(r.term || '').includes('2nd') ? 2 : String(r.term || '').includes('Summer') ? 3 : 1,
      grade: r.grade, raw_grade: r.grade,
      status: r.status === 'Failed' ? 'failed' : (r.status === 'Dropped' ? 'dropped' : 'passed'),
      createdAt: r.created_at
    });
  });

  // Now replicate generateCurriculumRecommendations
  const curriculumDefs = buildBSITCurriculum();
  const studentYear = Math.min(4, Math.max(1, Number(student.year_level) || 1));
  const hasExplicitSemester = student.semester !== undefined && student.semester !== null && String(student.semester).trim() !== '';
  const explicitSemester = hasExplicitSemester ? Number(student.semester) : NaN;

  console.log('🎯 INIT:', { name: student.full_name, studentYear, hasExplicitSemester, explicitSemester });

  // Enrichment synthetic passes (just like frontend)
  const gradesByCode = new Map();
  for (const g of grades) {
    const norm = normalizeSubjCode(g.code);
    if (!gradesByCode.has(norm)) gradesByCode.set(norm, []);
    gradesByCode.get(norm).push(g);
  }

  const enrichmentTerms = [];
  for (let y = 1; y <= studentYear; y++) {
    const sems = (y < studentYear) ? [1, 2] : [1];
    for (const s of sems) enrichmentTerms.push(termKey(y, s));
  }
  const enrichmentPasses = new Set();
  for (const t of enrichmentTerms) {
    for (const c of curriculumDefs) {
      if (termKey(c.yearLevel, c.semester) === t) {
        const norm = normalizeSubjCode(c.code);
        if (!gradesByCode.has(norm)) enrichmentPasses.add(norm);
      }
    }
  }
  console.log('🧪 Enrichment:', enrichmentTerms.length, 'terms,', enrichmentPasses.size, 'synthetic passed codes');

  // Determine passedCodes & activeDeficiencies
  const passedCodes = new Set([...enrichmentPasses]);
  const activeDeficiencies = [];
  const failedAttempts = [];

  for (const [norm, attempts] of gradesByCode.entries()) {
    const sortedA = sortGradeAttemptsNewestFirst(attempts);
    const hasPass = sortedA.some(a => isPassed(a));
    if (hasPass) { passedCodes.add(norm); continue; }
    const latestAttempt = sortedA[0];
    if (isFail(latestAttempt) || isDrop(latestAttempt)) {
      activeDeficiencies.push({ code: latestAttempt.code, grade: latestAttempt.grade, status: isDrop(latestAttempt) ? 'dropped' : 'failed', attempts: sortedA });
      failedAttempts.push({ code: latestAttempt.code });
    }
  }
  console.log('🩺 Active deficiencies:', activeDeficiencies.length, '— should be ZERO for Chin-Chin');
  activeDeficiencies.forEach(d => console.log('   ', d.code, d.grade, d.status));

  // ==== Determine targetYear/targetSemester ====
  function hasAttendedFullTerm(yearLevel, semester) {
    const termSubjects = curriculumDefs.filter(c => c.yearLevel === yearLevel && c.semester === semester);
    if (termSubjects.length === 0) return false;
    return termSubjects.every(ts => {
      const norm = normalizeSubjCode(ts.code);
      return passedCodes.has(norm) || activeDeficiencies.some(d => normalizeSubjCode(d.code) === norm);
    });
  }

  let targetYear = studentYear;
  let targetSemester = hasExplicitSemester && Number.isFinite(explicitSemester) ? Math.min(2, Math.max(1, explicitSemester)) : 1;
  console.log('🎯 INIT target:', targetYear, 'Yr', targetSemester, 'Sem');

  // Check Y3 S1 specifically:
  const y3s1Subjects = curriculumDefs.filter(c => c.yearLevel === 3 && c.semester === 1);
  console.log('\n🔎 Check 3rd Yr 1st Sem attended (all', y3s1Subjects.length, 'subjects):');
  y3s1Subjects.forEach(c => {
    const norm = normalizeSubjCode(c.code);
    const gp = passedCodes.has(norm);
    const def = activeDefinitions? false : false;
    const ad = activeDefinitions? false : false;
    console.log('  ', c.code.padEnd(10), '| passedCodes?', gp, '| have_grades?', gradesByCode.has(norm));
  });
  console.log('  hasAttendedFullTerm(Y3 S1) =', hasAttendedFullTerm(3,1));
  console.log('  hasAttendedFullTerm(Y3 S2) =', hasAttendedFullTerm(3,2));
  console.log('  hasAttendedFullTerm(Y2 S1) =', hasAttendedFullTerm(2,1));
  console.log('  hasAttendedFullTerm(Y2 S2) =', hasAttendedFullTerm(2,2));

  // Advancement loop (max 2 steps):
  for (let step = 0; step < 2; step++) {
    if (!hasAttendedFullTerm(targetYear, targetSemester)) break;
    if (targetSemester === 1) {
      targetSemester = 2;
    } else {
      if (targetYear < 4) { targetYear += 1; targetSemester = 1; }
      else break;
    }
    console.log(`  👉 Advancement step ${step + 1}: → ${targetYear} Yr ${targetSemester} Sem`);
  }

  console.log('\n🏁 FINAL TARGET:', targetYear, 'Yr', targetSemester, 'Sem');

  // Now compute recommendations
  const targetTerm = termKey(targetYear, targetSemester);
  const targetSubjects = curriculumDefs.filter(c => termKey(c.yearLevel, c.semester) === targetTerm);
  const regular = []; const blocked = []; const retakes = activeDeficiencies.slice();

  function isAvailable(c) {
    if (c.prereq === 'None' || !c.prereq) return true;
    const prNorm = normalizeSubjCode(c.prereq);
    const def = activeDeficiencies.find(d => normalizeSubjCode(d.code) === prNorm);
    if (def) return false;
    if (passedCodes.has(prNorm)) return true;
    const prSubj = curriculumDefs.find(x => normalizeSubjCode(x.code) === prNorm);
    if (!prSubj) return false;
    return (prSubj.yearLevel < c.yearLevel) || (prSubj.yearLevel === c.yearLevel && prSubj.semester < c.semester);
  }

  targetSubjects.forEach(c => {
    if (!isAvailable(c)) {
      const prNorm = normalizeSubjCode(c.prereq);
      const neededSubj = curriculumDefs.find(x => normalizeSubjCode(x.code) === prNorm);
      blocked.push({ ...c, reason: `Prerequisite ${neededSubj?.code || c.prereq} blocked (not passed)` });
    } else regular.push(c);
  });

  console.log('\n=================== RECOMMENDATION RESULTS ===================');
  console.log('RETAKE REQUIRED (' + retakes.length + '):');
  retakes.forEach(r => console.log('  🔴', r.code, r.grade, r.status));
  console.log('\nREGULAR (unlocked for ' + targetYear + 'Yr-' + targetSemester + 'Sem):', regular.length);
  regular.forEach(r => console.log('  🟢', r.code.padEnd(10), r.title, '| units:', r.units, '| prereq:', r.prereq));
  console.log('\nBLOCKED:', blocked.length);
  blocked.forEach(b => console.log('  ⚫', b.code, '-', b.reason));
  console.log('\nTotal units recommend:', (regular.reduce((s, c) => s + Number(c.units || 0), 0)));
  console.log('✅ done');
  process.exit(0);
}
main();
