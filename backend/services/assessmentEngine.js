/**
 * GCT Assessment and Recommendation Engine
 * Isolated Rule-Based Expert System Module
 *
 * Deterministic evaluation logic comparing student grades against curriculum prerequisites.
 */

/**
 * Normalize subject code to canonical form for comparison across DB/Excel records.
 * Lowercase + remove non-alphanumeric characters + known aliases.
 */
function normalizeSubjCode(raw) {
  if (!raw) return '';
  const r = String(raw || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const aliases = new Map([
    ['math1it', 'math1'], ['math1cs', 'math1'], ['mathematicsinthemodernworld', 'math1'],
    ['mathinthemodernworld', 'math1'], ['modernmathematics', 'math1'],
    ['co', 'co1'], ['co1', 'co1'], ['collegeorientation', 'co1'], ['collegeorientation1', 'co1'],
    ['pe1', 'pe1'], ['pathfit1', 'pe1'], ['physicaleducation1', 'pe1'],
    ['pe2', 'pe2'], ['pathfit2', 'pe2'], ['physicaleducation2', 'pe2'],
    ['pe3', 'pe3'], ['pathfit3', 'pe3'], ['physicaleducation3', 'pe3'],
    ['pe4', 'pe4'], ['pathfit4', 'pe4'], ['physicaleducation4', 'pe4'],
    ['english1', 'engl1'], ['purposivecommunication', 'engl1'], ['english', 'engl1'],
    ['history1', 'histo1'], ['readingsinphilippinehistory', 'histo1'], ['philippinehistory', 'histo1'],
    ['understandingtheself', 'uts1'],
    ['introductiontocomputing', 'cc101'], ['introcomputing', 'cc101'],
    ['fundamentalsofprogramming', 'cc102'], ['computerprogramming1', 'cc102'], ['prog1', 'cc102'],
    ['computerprogramming2', 'cc103'], ['intermediateprogramming', 'cc103'], ['prog2', 'cc103'],
    ['applicationdevelopmentemergingtechnologies', 'cc104'], ['appdev', 'cc104'],
    ['datastructuresandalgorithms', 'cc105'], ['datastructures', 'cc105'],
    ['informationmanagement1', 'cc106'], ['informationmanagement', 'cc106'],
    ['informationmanagement2', 'it4'],
    ['environmentalscience', 'sts2'],
    ['sciencetechnologyandsociety', 'sts1'],
    ['thecontemporaryworld', 'cw1'], ['contemporaryworld', 'cw1'],
    ['artappreciation', 'hum1'],
    ['philosophyhumanities2', 'hum2'], ['philosophy', 'hum2'],
    ['nationalservicetrainingprogram1', 'nstp1'], ['cwts1', 'nstp1'], ['rotc1', 'nstp1'],
    ['nationalservicetrainingprogram2', 'nstp2'], ['cwts2', 'nstp2'], ['rotc2', 'nstp2'],
    ['technopreneurship', 'ttrep1'],
    ['networking1', 'it3'], ['networking2', 'it8'],
    ['discretemathematics', 'it7'], ['discretestructures', 'it7'],
    ['linearalgebra', 'math4'], ['linearalgebraandprobability', 'math4'],
    ['thesiswriting1', 'ths1'], ['thesiswriting2', 'ths2'],
    ['capstoneproject1', 'cp1'], ['capstoneproject2', 'cp2'], ['capstone1', 'cp1'], ['capstone2', 'cp2'],
    ['onthejobtraining', 'ojtit'], ['onthejobtrainingit', 'ojtit'], ['onthejobtrainingcs', 'ojtcs'],
    ['ethics', 'ethics1'], ['ethics1', 'ethics1'],
    ['filipino1', 'fili1'], ['kontekstwalisadongkomunikasyonsafilipino', 'fili1'],
    ['filipino2', 'fili2'], ['filipinosaibatibangdisiplina', 'fili2']
  ]);
  if (aliases.has(r)) return aliases.get(r);
  if (r.includes('mathematicsinthemodernworld') || r.includes('mathinthemodernworld')) return 'math1';
  if (r.includes('collegeorientation')) return 'co1';
  if (r.includes('purposivecommunication')) return 'engl1';
  if (r.includes('pathfit1') || r.includes('movementcompetency')) return 'pe1';
  if (r.includes('pathfit2') || r.includes('exercisebased')) return 'pe2';
  if (r.includes('pathfit3')) return 'pe3';
  if (r.includes('pathfit4')) return 'pe4';
  if (r.startsWith('rizal')) return 'rizal1';
  if (r.startsWith('ojt')) return r.includes('cs') ? 'ojtcs' : 'ojtit';
  return r;
}

/**
 * Parse a term string like "2024-2025 1st Sem" into sortable components.
 * Returns { yearStart, semRank } — higher = more recent.
 */
function parseTermRank(record) {
  const term = String(record.term || record.academic_year || record.termName || '').trim();
  const sem = String(record.semester || '');
  const yearMatch = term.match(/(\d{4})/);
  let yearStart = yearMatch ? parseInt(yearMatch[1], 10) : 0;
  if (!yearStart && record.year_level) {
    yearStart = 2024 - (5 - (Number(record.year_level) || 1));
  }
  let semRank = 1;
  if (/2nd|second|sem 2|sem2|^2$/i.test(term) || /2nd|second|^2$/i.test(sem)) semRank = 2;
  if (/summer/i.test(term) || /summer|^3$/i.test(sem)) semRank = 3;
  const created = record.created_at ? new Date(record.created_at).getTime() : 0;
  return { yearStart, semRank, created };
}

/**
 * Sort grade records CHRONOLOGICALLY NEWEST FIRST.
 */
function sortGradesNewestFirst(grades) {
  return [...grades].sort((a, b) => {
    const ra = parseTermRank(a);
    const rb = parseTermRank(b);
    if (rb.yearStart !== ra.yearStart) return rb.yearStart - ra.yearStart;
    if (rb.semRank !== ra.semRank) return rb.semRank - ra.semRank;
    return rb.created - ra.created;
  });
}

function isMajorSubject(code, program = 'BSIT') {
  if (!code) return false;
  const norm = normalizeSubjCode(code);
  const prog = String(program || 'BSIT').toUpperCase();
  if (norm.startsWith('cc')) return true;
  if (prog === 'BSCS') return norm.startsWith('cs');
  return norm.startsWith('it');
}

function isCapstoneSubject(code) {
  if (!code) return false;
  const norm = normalizeSubjCode(code);
  return (
    norm === 'cp1' ||
    norm === 'cp2' ||
    norm === 'ths1' ||
    norm === 'ths2' ||
    norm.includes('capstone') ||
    norm.includes('thesis')
  );
}

function isOjtSubject(code) {
  if (!code) return false;
  const norm = normalizeSubjCode(code);
  return (
    norm.startsWith('ojt') ||
    norm.includes('practicum') ||
    norm.includes('internship')
  );
}

function isLapsedStudentFn(anchorAcademicYear, activeAcademicYear) {
  if (!anchorAcademicYear || !activeAcademicYear) return false;
  const anchorMatch = String(anchorAcademicYear).match(/(\d{4})/);
  const activeMatch = String(activeAcademicYear).match(/(\d{4})/);
  if (!anchorMatch || !activeMatch) return false;
  const anchorStart = parseInt(anchorMatch[1], 10);
  const activeStart = parseInt(activeMatch[1], 10);
  return (activeStart - anchorStart) >= 2;
}

/**
 * Compute which subjects are in the curriculum progression for
 * (yearLevel, semester) — used for synthetic passes & hasAttended checks.
 */
function subjectsInTerm(curriculumSubjects, yearLevel, semester) {
  return curriculumSubjects.filter(c =>
    Number(c.year_level) === Number(yearLevel) &&
    Number(c.semester) === Number(semester)
  );
}

/**
 * Core evaluator. IMPORTANT: accepts OPTIONAL student catalog info to compute
 * realistic target YEAR/SEMESTER progression (matching frontend logic).
 *
 * @param {Object} params
 * @param {Array} params.studentGrades
 * @param {Array} params.curriculumSubjects
 * @param {Array} params.prerequisites
 * @param {Object} [params.studentInfo] - { year_level, semester, program } (optional but HIGHLY recommended)
 * @param {number} [params.passingThreshold=75]
 * @param {number} [params.maxFailedPrereqs=3]
 */
function evaluateStudent({
  studentGrades = [],
  grades = null,
  curriculumSubjects = [],
  prerequisites = [],
  studentInfo = null,
  passingThreshold = 75,
  maxFailedPrereqs = 3,
  activeAcademicYear = '2026-2027'
}) {
  const effectiveGrades = Array.isArray(grades) && grades.length > 0 ? grades : studentGrades;
  const threshold = Number(passingThreshold) || 75;
  const maxFail = Number(maxFailedPrereqs) || 3;

  // ===== BUILD CURRICULUM LOOKUPS (by BOTH DB id AND normalized code) =====
  const byId = new Map();          // subj.id -> subj
  const byNorm = new Map();        // normalizeSubjCode(subj.code) -> subj
  curriculumSubjects.forEach(s => {
    byId.set(s.id, s);
    byId.set(String(s.id), s);
    byNorm.set(normalizeSubjCode(s.code), s);
    if (s.title) byNorm.set(normalizeSubjCode(s.title), s);
  });

  // ===== GRADE PROCESSING (NEWEST-FIRST + PASS-FOREVER + normalize to DB ID) =====
  const sortedGrades = sortGradesNewestFirst(effectiveGrades);
  const gradeMap = new Map();   // key = DB subject ID → { ...record, status }
  const passSeenNorm = new Set(); // normalized codes already cleared (FOREVER)
  const failSeenNorm = new Set(); // normalized codes where newest attempt is fail/drop

  sortedGrades.forEach(record => {
    const isDrop = record.status === 'dropped' || record.is_dropped ||
                   String(record.raw_grade) === '9' || String(record.grade) === '9' ||
                   String(record.raw_grade).toUpperCase() === 'DRP';

    // Grade value parsing: distinguish GWA Filipino scale 1-5 from percentage 60-100
    const rawGradeVal = (record.grade !== null && record.grade !== undefined && record.grade !== '')
      ? Number(record.grade)
      : (record.raw_grade !== null && record.raw_grade !== undefined && record.raw_grade !== '')
        ? Number(record.raw_grade)
        : NaN;
    const isPercentage = Number.isFinite(rawGradeVal) && rawGradeVal > 5.5;  // 60+ = percentage
    const isNumericGwa = Number.isFinite(rawGradeVal) && rawGradeVal > 0 && rawGradeVal <= 5.0;

    const hasFailStatus = record.status === 'failed' || String(record.grade) === '5' || String(record.raw_grade) === '5';
    const hasGwaFail = isNumericGwa && rawGradeVal > 3.0;   // GWA 4,5 = failed in PH scale
    const hasPctFail = isPercentage && rawGradeVal < threshold;  // percentage below passing threshold
    const isFail = !isDrop && (hasFailStatus || hasGwaFail || hasPctFail);

    let computedStatus = record.status || 'passed';
    if (isDrop) {
      computedStatus = 'dropped';
    } else if (isFail) {
      computedStatus = 'failed';
    } else if (Number.isFinite(rawGradeVal) && rawGradeVal > 0) {
      if (isPercentage) {
        computedStatus = rawGradeVal >= threshold ? 'passed' : 'failed';
      } else {
        // GWA (1-5) or passed percentage
        computedStatus = rawGradeVal <= 3.0 ? 'passed' : 'failed';
      }
    }

    // Resolve subject: BOTH by explicit DB id (if any), code, and title (supports Excel imports)
    const explicitId = String(record.subject_id || record.subjectId || '');
    const rawCode = String(record.code || record.subject || '');
    const rawTitle = String(record.title || record.subject_title || '');
    const rawNorm = normalizeSubjCode(rawCode);
    const rawTitleNorm = normalizeSubjCode(rawTitle);
    const matchSubj = byId.get(explicitId) || byNorm.get(rawNorm) || byNorm.get(rawTitleNorm) ||
                      byId.get(rawCode) || byId.get(rawNorm) || (rawTitle && byId.get(rawTitle));

    if (!matchSubj) return; // unknown subject, ignore (no way to match to curriculum/prereqs)

    const dbId = matchSubj.id;
    const norm = normalizeSubjCode(matchSubj.code) || rawNorm || `db:${String(dbId)}`;

    // RULE: PASS FOREVER WINS (once passed in any term, stay passed)
    if (computedStatus === 'passed') {
      passSeenNorm.add(norm);
      gradeMap.set(dbId, { ...record, subject_id: dbId, code: matchSubj.code, status: 'passed' });
      return;
    }
    // If a previous NEWER pass already cleared this subject → discard this old failure.
    if (passSeenNorm.has(norm)) return;

    // Only keep the FIRST (newest, since we sorted desc) non-pass per DB id / normalized code.
    if (!gradeMap.has(dbId)) {
      failSeenNorm.add(norm);
      gradeMap.set(dbId, { ...record, subject_id: dbId, code: matchSubj.code, status: computedStatus });
    }
  });

  // Detect if grade records have real term metadata
  let hasRealTermInfo = false;
  let latestYearStart = 0;
  let latestSemRank = 0;
  let latestAyStr = null;
  let latestTermRecords = [];

  effectiveGrades.forEach(g => {
    const r = parseTermRank(g);
    if (r.yearStart > 0 || g.term || g.academic_year || g.year_level || g.semester) {
      hasRealTermInfo = true;
    }
    if (r.yearStart > latestYearStart || (r.yearStart === latestYearStart && r.semRank > latestSemRank)) {
      latestYearStart = r.yearStart;
      latestSemRank = r.semRank;
      latestAyStr = String(g.academic_year || g.term || '').match(/\d{4}-\d{4}/)?.[0] || null;
      latestTermRecords = [g];
    } else if (r.yearStart === latestYearStart && r.semRank === latestSemRank) {
      latestTermRecords.push(g);
    }
  });

  let anchorYear = NaN;
  let anchorSem = NaN;
  let anchorAcademicYear = latestAyStr;
  const hasGradeRecords = Boolean(hasRealTermInfo && latestTermRecords.length > 0);
  if (hasGradeRecords) {
    anchorSem = latestSemRank === 3 ? 3 : (latestSemRank === 2 ? 2 : 1);
    const yrsInTerm = latestTermRecords
      .map(r => {
        if (Number.isFinite(Number(r.year_level))) return Number(r.year_level);
        const sMatch = byId.get(String(r.subject_id || r.subjectId || '')) ||
                       byNorm.get(normalizeSubjCode(r.code || r.subject || ''));
        return sMatch ? Number(sMatch.year_level) : NaN;
      })
      .filter(y => Number.isFinite(y) && y >= 1 && y <= 4);
    if (yrsInTerm.length > 0) {
      anchorYear = Math.max(...yrsInTerm);
    }
  }

  const catalogYearRaw = studentInfo && Number.isFinite(Number(studentInfo.year_level)) ? Number(studentInfo.year_level) : NaN;
  const catalogSemRaw = studentInfo && studentInfo.semester !== undefined && studentInfo.semester !== null ? Number(studentInfo.semester) : NaN;
  
  // Effective year level:
  const effectiveAnchorYear = Number.isFinite(anchorYear) && anchorYear >= 1 
    ? Math.max(anchorYear, Number.isFinite(catalogYearRaw) ? catalogYearRaw : 1) 
    : (Number.isFinite(catalogYearRaw) ? Math.min(4, Math.max(1, catalogYearRaw)) : 1);

  // Effective semester:
  // If catalog year is higher than anchorYear (e.g. catalog year 2, but grades were only up to year 1),
  // then the student is starting the new catalog year at catalogSemRaw (or 1)!
  let effectiveAnchorSem = 1;
  if (Number.isFinite(catalogYearRaw) && Number.isFinite(anchorYear) && catalogYearRaw > anchorYear) {
    effectiveAnchorSem = Number.isFinite(catalogSemRaw) && catalogSemRaw >= 1 && catalogSemRaw <= 3 ? catalogSemRaw : 1;
  } else if (Number.isFinite(anchorSem) && anchorSem >= 1 && anchorSem <= 3) {
    effectiveAnchorSem = anchorSem;
  } else if (Number.isFinite(catalogSemRaw) && catalogSemRaw >= 1 && catalogSemRaw <= 3) {
    effectiveAnchorSem = catalogSemRaw;
  }
  const isLapsedStudent = isLapsedStudentFn(anchorAcademicYear, activeAcademicYear);

  // ===== STUDENT CATALOG + SYNTHETIC PASSES + TARGET TERM ADVANCEMENT =====
  const catalogYear = effectiveAnchorYear;
  const catalogSem = effectiveAnchorSem;
  // Build passedCodes set from actual gradeMap
  const passedCodes = new Set();
  gradeMap.forEach((rec, dbId) => { if (rec.status === 'passed') passedCodes.add(normalizeSubjCode(rec.code)); });

  // Synthetic passes: GROUNDED IN GRADE RECORD ANCHOR (effectiveAnchorYear/effectiveAnchorSem)
  // Only synthesize strictly PRIOR terms so the current target term requires real grades or recommendations
  const enrichmentTerms = [];
  for (let y = 1; y < effectiveAnchorYear; y++) {
    enrichmentTerms.push([y, 1]);
    enrichmentTerms.push([y, 2]);
  }
  if (effectiveAnchorSem === 2) {
    enrichmentTerms.push([effectiveAnchorYear, 1]);
  }
  const syntheticPass = new Set();
  enrichmentTerms.forEach(([y, s]) => {
    subjectsInTerm(curriculumSubjects, y, s).forEach(subj => {
      const norm = normalizeSubjCode(subj.code);
      if (!passedCodes.has(norm) && !failSeenNorm.has(norm)) {
        syntheticPass.add(norm);
        passedCodes.add(norm);
      }
    });
  });

  // now rebuild gradeMap to include synthetic passes (not_taken → passed for synthetic)
  curriculumSubjects.forEach(subj => {
    const norm = normalizeSubjCode(subj.code);
    if (syntheticPass.has(norm) && !gradeMap.has(subj.id)) {
      gradeMap.set(subj.id, {
        subject_id: subj.id, code: subj.code, status: 'passed',
        notes: 'synthetic (enrollment progression grounding)',
        grade: null, raw_grade: null
      });
    }
  });

  // Build passed DB IDs (for prereqMap lookups)
  const passedSubjectIds = new Set();
  const failedSubjectIds = new Set();
  gradeMap.forEach((rec, dbId) => {
    if (rec.status === 'passed') {
      passedSubjectIds.add(dbId);
      const mSubj = byId.get(dbId);
      if (mSubj) passedSubjectIds.add(mSubj.id);
    } else if (rec.status === 'failed' || rec.status === 'dropped') {
      failedSubjectIds.add(dbId);
    }
  });

  // isTermFullyPassed: student has passed 100% of the subjects in that curriculum term
  function isTermFullyPassed(yearLevel, semester) {
    const term = subjectsInTerm(curriculumSubjects, yearLevel, semester);
    if (term.length === 0) return false;
    return term.every(subj => {
      const norm = normalizeSubjCode(subj.code);
      return passedCodes.has(norm);
    });
  }

  function advanceTerm(y, s) {
    if (s === 1) return { year_level: y, semester: 2 };
    if (s === 2 && y === 3) return { year_level: 3, semester: 3 }; // 3rd Year has required Summer
    if (s === 2) return y < 4 ? { year_level: y + 1, semester: 1 } : null;
    if (s === 3) return y < 4 ? { year_level: y + 1, semester: 1 } : null;
    return null;
  }

  // Compute target (year, semester) from latest attended term + advancement to upcoming term
  let targetYear = catalogYear;
  let targetSemester = Number.isFinite(catalogSem) ? catalogSem : 1;

  // If the student already attended/enrolled in this anchor term (grades exist for it),
  // they advance to the NEXT semester (the upcoming term to enroll in).
  const hasAttendedAnchorTerm = (hasGradeRecords && anchorYear === catalogYear && anchorSem === (Number.isFinite(catalogSem) ? catalogSem : 1)) ||
    subjectsInTerm(curriculumSubjects, catalogYear, Number.isFinite(catalogSem) ? catalogSem : 1).some(subj => gradeMap.has(subj.id));

  if (hasAttendedAnchorTerm) {
    const next = advanceTerm(catalogYear, targetSemester);
    if (next) {
      targetYear = next.year_level;
      targetSemester = next.semester;
    }
  }

  // Continue advancing forward as long as subsequent terms were also 100% completed
  while (targetYear <= 4) {
    if (isTermFullyPassed(targetYear, targetSemester)) {
      const next = advanceTerm(targetYear, targetSemester);
      if (!next) break;
      targetYear = next.year_level;
      targetSemester = next.semester;
    } else {
      break;
    }
  }

  // ===== SUBJECT STATUSES =====
  const subjectStatuses = curriculumSubjects.map(subj => {
    const rec = gradeMap.get(subj.id);
    return {
      subject_id: subj.id, code: subj.code, title: subj.title, units: subj.units,
      year_level: subj.year_level, semester: subj.semester,
      grade: rec && rec.grade !== undefined ? rec.grade : null,
      status: rec ? rec.status : 'not_taken'
    };
  });

  // ===== PREREQ MAP =====
  const prereqMap = new Map();
  prerequisites.forEach(p => {
    if (!prereqMap.has(p.subject_id)) prereqMap.set(p.subject_id, []);
    prereqMap.get(p.subject_id).push(p.prerequisite_subject_id);
  });

  // ===== ACTIVE DEFICIENCIES (RETAKES) =====
  const activeDeficiencies = [];
  const seenDefNorms = new Set();
  failedSubjectIds.forEach(dbId => {
    const subj = byId.get(dbId);
    if (!subj) return;
    const norm = normalizeSubjCode(subj.code);
    if (seenDefNorms.has(norm)) return;
    if (passSeenNorm.has(norm) || passedCodes.has(norm)) return;  // safeguard: if later clear happened, skip
    seenDefNorms.add(norm);
    activeDeficiencies.push({ subj, dbId, rec: gradeMap.get(dbId) });
  });
  activeDeficiencies.sort((a, b) =>
    (Number(a.subj.year_level) - Number(b.subj.year_level)) || (Number(a.subj.semester) - Number(b.subj.semester))
  );

  // Helper: given a curriculum subject row, are ALL prereqs satisfied?
  function prereqsSatisfied(subj) {
    const reqs = prereqMap.get(subj.id) || [];
    const standardOk = reqs.every(prId => {
      if (passedSubjectIds.has(prId)) return true;
      const prSubj = byId.get(prId);
      if (prSubj && passedCodes.has(normalizeSubjCode(prSubj.code))) return true;
      return false;
    });
    if (!standardOk) return false;

    // Institutional Capstone Rule: Capstone 1/2 or Thesis 1/2 requires ZERO deficiencies in all Year 1-3 Major Subjects
    if (isCapstoneSubject(subj.code)) {
      const studentProg = studentInfo?.program || 'BSIT';
      const hasUnpassedMajor = activeDeficiencies.some(({ subj: dSubj }) => {
        const yLevel = Number(dSubj.year_level || 1);
        if (yLevel > 3) return false;
        return isMajorSubject(dSubj.code, studentProg);
      });
      if (hasUnpassedMajor) return false;
    }

    // Institutional OJT Rule: OJT requires ZERO deficiencies in all Major Subjects across all years
    if (isOjtSubject(subj.code)) {
      const studentProg = studentInfo?.program || 'BSIT';
      const hasUnpassedMajor = activeDeficiencies.some(({ subj: dSubj }) => {
        return isMajorSubject(dSubj.code, studentProg);
      });
      if (hasUnpassedMajor) return false;
    }

    return true;
  }

  // ===== RECOMMENDATIONS =====
  const studentProg = studentInfo?.program || 'BSIT';
  const progClean = String(studentProg).toUpperCase();
  const programSubs = curriculumSubjects.filter(s => {
    if (!s.program) return true;
    const sp = String(s.program).toUpperCase();
    return progClean.includes('CS') ? sp.includes('CS') : sp.includes('IT');
  });

  const rawRecommended = [];
  const recommendedIds = new Set();
  const recommendedNormCodes = new Set();

  activeDeficiencies.forEach(({ subj, dbId, rec }) => {
    const norm = normalizeSubjCode(subj.code);
    // Only recommend retakes in the SAME semester offering as the failed subject!
    if (Number(subj.semester) === Number(targetSemester)) {
      if (recommendedIds.has(dbId) || recommendedNormCodes.has(norm)) return;
      rawRecommended.push({
        subject_id: subj.id,
        code: subj.code,
        title: subj.title,
        units: subj.units,
        year_level: subj.year_level,
        semester: subj.semester,
        reason: 'retake',
        notes: `Must retake subject (Latest Grade: ${rec?.grade ?? rec?.raw_grade ?? 'Failed/Dropped'}, Status: ${rec?.status ?? 'failed'})`
      });
      recommendedIds.add(dbId);
      recommendedNormCodes.add(norm);
    }
  });

  // 2. REGULAR SUBJECTS (next-in-progression for TARGET TERM): every subj in target term that isn't passed and has prereqs ok
  const targetTermSubs = subjectsInTerm(programSubs, targetYear, targetSemester);
  targetTermSubs.forEach(subj => {
    const norm = normalizeSubjCode(subj.code);
    if (passedCodes.has(norm)) return;
    if (recommendedIds.has(subj.id) || recommendedNormCodes.has(norm)) return;
    const reqs = prereqMap.get(subj.id) || [];
    if (!prereqsSatisfied(subj)) {
      const reqCodes = reqs.map(pId => byId.get(pId)?.code || pId).join(', ');
      const isCapstone = isCapstoneSubject(subj.code);
      const isOjt = isOjtSubject(subj.code);
      const unpassedCapstoneMajors = isCapstone ? activeDeficiencies.filter(({ subj: dSubj }) => {
        const yLevel = Number(dSubj.year_level || 1);
        if (yLevel > 3) return false;
        return isMajorSubject(dSubj.code, studentProg);
      }).map(d => d.subj.code) : [];
      const unpassedOjtMajors = isOjt ? activeDeficiencies.filter(({ subj: dSubj }) => {
        return isMajorSubject(dSubj.code, studentProg);
      }).map(d => d.subj.code) : [];

      let notes;
      if (unpassedCapstoneMajors.length > 0) {
        notes = `Blocked: Cannot take Capstone while having unpassed 1st-3rd Year major subjects (${unpassedCapstoneMajors.join(', ')})`;
      } else if (unpassedOjtMajors.length > 0) {
        notes = `Blocked: Cannot take OJT while having unpassed major subjects (${unpassedOjtMajors.join(', ')})`;
      } else {
        notes = `Prerequisites not satisfied yet (${reqCodes || 'unknown'}) — complete retakes first`;
      }

      rawRecommended.push({
        subject_id: subj.id,
        code: subj.code,
        title: subj.title,
        units: subj.units,
        year_level: subj.year_level,
        semester: subj.semester,
        reason: 'blocked',
        notes
      });
      recommendedIds.add(subj.id);
      recommendedNormCodes.add(norm);
      return;
    }
    const reqCodes = reqs
      .map(pId => byId.get(pId)?.code)
      .filter(Boolean);
    let unlockNotes = reqCodes.length > 0
      ? `Prerequisites satisfied (${reqCodes.join(', ')})`
      : `Ready for ${targetYear} Year • ${targetSemester === 1 ? '1st' : targetSemester === 2 ? '2nd' : 'Summer'} Sem enrollment`;
    if (isOjtSubject(subj.code)) {
      unlockNotes = 'Prerequisites satisfied (All Major Subjects cleared with 0 Deficiencies)';
    }

    rawRecommended.push({
      subject_id: subj.id,
      code: subj.code,
      title: subj.title,
      units: subj.units,
      year_level: subj.year_level,
      semester: subj.semester,
      reason: 'unlocked',
      notes: unlockNotes
    });
    recommendedIds.add(subj.id);
    recommendedNormCodes.add(norm);
  });

  // Final deduplication pass: guarantee zero duplicates by normalized subject code
  const recommendedSubjects = [];
  const finalSeenCodes = new Set();
  for (const item of rawRecommended) {
    const norm = normalizeSubjCode(item.code);
    if (!finalSeenCodes.has(norm)) {
      finalSeenCodes.add(norm);
      recommendedSubjects.push(item);
    }
  }

  // 3. Back-fill: if target term was fully enrolled, also recommend Summer if applicable (no filter yet)
  // (already handled by MAX_ADVANCEMENT). If there are retakes AND target term is future,
  // make sure retakes come first before regular target-term subjects (we already sorted by reason order).

  // ===== ELIGIBILITY & SUMMARY =====
  let failedPrereqCount = 0;
  failedSubjectIds.forEach(dbId => {
    const isPrereqForOther = Array.from(prereqMap.values()).some(list => list.includes(dbId));
    if (isPrereqForOther) failedPrereqCount++;
  });

  const eligibility = failedPrereqCount > maxFail ? 'not_eligible' : 'eligible';

  const totalPassed = subjectStatuses.filter(s => s.status === 'passed').length;
  const totalFailed = activeDeficiencies.length;
  const totalRecommendedUnits = recommendedSubjects.reduce((s, r) => s + Number(r.units || 0), 0);
  const totalRegular = recommendedSubjects.filter(r => r.reason === 'unlocked').length;
  const totalRetake = recommendedSubjects.filter(r => r.reason === 'retake').length;
  const totalBlocked = recommendedSubjects.filter(r => r.reason === 'blocked').length;

  const formattedActiveDeficiencies = activeDeficiencies.map(({ subj, rec }) => ({
    subject_id: subj.id,
    code: subj.code,
    title: subj.title,
    units: subj.units,
    year_level: subj.year_level,
    semester: subj.semester,
    grade: rec?.grade ?? rec?.raw_grade ?? null,
    status: rec?.status ?? 'failed',
    term: rec?.term || rec?.academic_year || null
  }));

  return {
    subjectStatuses,
    eligibility,
    recommendedSubjects,
    activeDeficiencies: formattedActiveDeficiencies,
    targetTerm: { year_level: targetYear, semester: targetSemester },
    catalogTerm: { year_level: catalogYear, semester: Number.isFinite(catalogSem) ? catalogSem : 1 },
    enrichmentApplied: { syntheticPassCount: syntheticPass.size, terms: enrichmentTerms.length },
    summary: {
      totalPassed,
      totalFailed,
      totalRetake,
      totalRegular,
      totalBlocked,
      totalRecommended: recommendedSubjects.length,
      totalRecommendedUnits,
      failedPrereqCount,
      passingThreshold: threshold,
      maxFailedPrereqs: maxFail
    },
    latestRecordAnchor: {
      year_level: effectiveAnchorYear,
      semester: effectiveAnchorSem,
      academic_year: anchorAcademicYear,
      hasGradeRecords
    },
    isLapsedStudent,
    activeAcademicYear
  };
}

module.exports = {
  evaluateStudent,
  parseTermRank,
  sortGradesNewestFirst,
  normalizeSubjCode,
  isLapsedStudentFn
};
