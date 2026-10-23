import { describe, it, expect } from 'vitest';
import { evaluateStudent } from '../services/assessmentEngine.js';

describe('Assessment Engine Unit Tests', () => {
  const curriculumSubjects = [
    { id: 'sub-1', code: 'IT 101', title: 'Intro to Computing', units: 3, year_level: 1, semester: 1 },
    { id: 'sub-2', code: 'IT 102', title: 'Computer Programming 1', units: 3, year_level: 1, semester: 1 },
    { id: 'sub-3', code: 'IT 103', title: 'Computer Programming 2', units: 3, year_level: 1, semester: 2 },
    { id: 'sub-4', code: 'IT 201', title: 'Database Management', units: 3, year_level: 2, semester: 1 }
  ];

  const prerequisites = [
    { subject_id: 'sub-3', prerequisite_subject_id: 'sub-2' }, // IT 103 requires IT 102
    { subject_id: 'sub-4', prerequisite_subject_id: 'sub-1' }  // IT 201 requires IT 101
  ];

  it('should recommend unlocked subjects when prerequisites are passed (Happy Path)', () => {
    const studentGrades = [
      { subject_id: 'sub-1', grade: 85, status: 'passed' },
      { subject_id: 'sub-2', grade: 90, status: 'passed' }
    ];

    const result = evaluateStudent({
      studentGrades,
      curriculumSubjects,
      prerequisites,
      // Student has completed 1st year, ready for 2nd year 1st sem
      // (so target = Y2S1, includes IT 201, NOT Y1S2 IT 103 anymore)
      studentInfo: { year_level: 2, semester: 1 },
      passingThreshold: 75,
      maxFailedPrereqs: 3
    });

    expect(result.eligibility).toBe('eligible');
    expect(result.summary.totalFailed).toBe(0);

    // Target Y2S1: only IT 201 is in the target term (and not passed yet, prereq ok)
    const recommendedCodes = result.recommendedSubjects.map(s => s.code);
    expect(recommendedCodes).toContain('IT 201');
    // IT 103 is 1st Yr 2nd Sem — would be in a different term if we target 2nd year
    // Now also test student who just finished Y1S1 → target should be Y1S2 (IT 103 unlocked)
    const s2Result = evaluateStudent({
      studentGrades,
      curriculumSubjects,
      prerequisites,
      studentInfo: { year_level: 1, semester: 1 },
      passingThreshold: 75,
      maxFailedPrereqs: 3
    });
    const codes2 = s2Result.recommendedSubjects.map(s => s.code);
    expect(codes2).toContain('IT 103');
    expect(s2Result.recommendedSubjects.every(s => s.reason === 'unlocked')).toBe(true);
  });

  it('should recommend retake when student fails a subject below passing threshold', () => {
    const studentGrades = [
      { subject_id: 'sub-1', grade: 80, status: 'passed' },
      { subject_id: 'sub-2', grade: 65, status: 'failed' } // Failed threshold 75
    ];

    const result = evaluateStudent({
      studentGrades,
      curriculumSubjects,
      prerequisites,
      // Yr 1 Sem 1 enrolled catalog: default. Has IT 101 pass, IT 102 fail.
      // -> Y1S1 not fully attended (IT 102 failed), target stays Y1S1.
      // But to test cross-term, use higher catalog to see next semester blocked properly
      studentInfo: { year_level: 1, semester: 1 },
      passingThreshold: 75,
      maxFailedPrereqs: 3
    });

    expect(result.eligibility).toBe('eligible');
    expect(result.summary.totalFailed).toBe(1);

    // IT 102 is a 1st Sem subject. In Year 1 Sem 2, it is NOT offered (will be retaken next AY 1st Sem).
    const retakeInSem2 = result.recommendedSubjects.find(s => s.code === 'IT 102');
    expect(retakeInSem2).toBeUndefined();

    // IT 103 (Yr 1 Sem 2) requires IT 102 -> BLOCKED because IT 102 was failed
    const it103InSem2 = result.recommendedSubjects.find(s => s.code === 'IT 103');
    expect(it103InSem2?.reason).toBe('blocked');

    // When the student reaches Year 2 Sem 1 (next academic year, same semester 1):
    // IT 102 IS offered and recommended for retake!
    const nextAySem1Result = evaluateStudent({
      studentGrades: [
        { subject_id: 'sub-1', grade: 85 },  // passed (>= threshold 75)
        { subject_id: 'sub-2', grade: 65 }   // failed in 1st sem
      ],
      curriculumSubjects,
      prerequisites,
      studentInfo: { year_level: 2, semester: 1 },
      passingThreshold: 75,
      maxFailedPrereqs: 3
    });
    // Retake (IT 102 = 1st sem subject) is recommended in Year 2 Sem 1
    const s1Retake = nextAySem1Result.recommendedSubjects.find(s => s.code === 'IT 102');
    expect(s1Retake).toBeDefined();
    expect(s1Retake?.reason).toBe('retake');

    // IT 201 (Yr 2 Sem 1) requires IT 101 (passed) -> UNLOCKED
    const it201 = nextAySem1Result.recommendedSubjects.find(s => s.code === 'IT 201');
    expect(it201).toBeDefined();
    expect(it201?.reason).toBe('unlocked');
  });

  it('should flag student as not_eligible when failed prerequisite count exceeds threshold', () => {
    const customPrereqs = [
      { subject_id: 'sub-3', prerequisite_subject_id: 'sub-1' },
      { subject_id: 'sub-4', prerequisite_subject_id: 'sub-2' }
    ];

    const studentGrades = [
      { subject_id: 'sub-1', grade: 60 }, // Failed prereq 1
      { subject_id: 'sub-2', grade: 50 }  // Failed prereq 2
    ];

    const result = evaluateStudent({
      studentGrades,
      curriculumSubjects,
      prerequisites: customPrereqs,
      studentInfo: { year_level: 2, semester: 1 },
      passingThreshold: 75,
      maxFailedPrereqs: 1 // Max 1 allowed
    });

    expect(result.eligibility).toBe('not_eligible');
    expect(result.summary.failedPrereqCount).toBe(2);
  });

  it('should correctly apply PASS-FOREVER rule: old failure MUST be cleared by later retake pass (Chin-Chin scenario)', () => {
    const chinChinGrades = [
      // OLD: AY 2023-2024 2nd sem FAIL
      { code: 'IT 103', grade: 5, raw_grade: '5', status: 'failed', term: '2023-2024 2nd Sem', academic_year: '2023-2024', semester: 2 },
      // RETAKE: AY 2024-2025 2nd sem → PASSED
      { code: 'IT 103', grade: 2, raw_grade: '2', status: 'passed', term: '2024-2025 2nd Sem', academic_year: '2024-2025', semester: 2 },
      // Y1S1 prerequisites pass
      { subject_id: 'sub-1', grade: 85, status: 'passed' },
      { subject_id: 'sub-2', grade: 90, status: 'passed' }
    ];

    const result = evaluateStudent({
      studentGrades: chinChinGrades,
      curriculumSubjects,
      prerequisites,
      studentInfo: { year_level: 2, semester: 1 },
      passingThreshold: 75,
      maxFailedPrereqs: 3
    });

    // IT 103 = PASS → NO retake for IT 103!
    const retakes = result.recommendedSubjects.filter(s => s.reason === 'retake');
    expect(retakes.find(r => r.code === 'IT 103')).toBeUndefined();
    expect(result.summary.totalFailed).toBe(0);

    // IT 201 (Y2S1 target) prereq = IT 101 (sub-1) → PASSED, so unlocked
    const it201 = result.recommendedSubjects.find(s => s.code === 'IT 201');
    expect(it201).toBeDefined();
    expect(it201?.reason).toBe('unlocked');
  });

  it('should ADVANCE target term correctly when current catalog term is fully completed', () => {
    // Scenario: Catalog Yr 1 Sem 1 (default, first sem only)
    // Student has completed ALL of Y1S1 (IT 101, IT 102 passed) and ALL of Y1S2 (IT 103 passed)
    // → target should advance TO Y2S1
    const grades = [
      { subject_id: 'sub-1', grade: 85 },
      { subject_id: 'sub-2', grade: 88 },
      { subject_id: 'sub-3', grade: 90 } // IT 103 - Y1S2
    ];

    const result = evaluateStudent({
      studentGrades: grades,
      curriculumSubjects,
      prerequisites,
      // Catalog says Yr 1 / Sem 1 but everything done
      studentInfo: { year_level: 1, semester: 1 },
      passingThreshold: 75,
      maxFailedPrereqs: 3
    });

    // Expected target: Yr 2 Sem 1
    expect(result.targetTerm).toEqual({ year_level: 2, semester: 1 });

    // Target subject = IT 201 (only subject in Y2S1)
    const recommendedCodes = result.recommendedSubjects.map(s => s.code);
    expect(recommendedCodes).toContain('IT 201');
    expect(result.summary.totalRegular).toBe(1);
    expect(result.summary.totalRetake).toBe(0);
  });

  it('should recommend eligible next-semester regular subjects, block prerequisites, and defer retakes to next AY same semester', () => {
    const extendedCurriculum = [
      { id: 'sub-1', code: 'IT 101', title: 'Intro to Computing', units: 3, year_level: 1, semester: 1 },
      { id: 'sub-2', code: 'IT 102', title: 'Computer Programming 1', units: 3, year_level: 1, semester: 1 },
      { id: 'sub-3', code: 'IT 103', title: 'Computer Programming 2', units: 3, year_level: 1, semester: 2 },
      { id: 'sub-4', code: 'CW 1', title: 'Contemporary World', units: 3, year_level: 1, semester: 2 },
      { id: 'sub-5', code: 'IT 201', title: 'Data Structures', units: 3, year_level: 2, semester: 1 }
    ];
    const extendedPrereqs = [
      { subject_id: 'sub-3', prerequisite_subject_id: 'sub-2' }, // IT 103 requires IT 102
      { subject_id: 'sub-5', prerequisite_subject_id: 'sub-1' }  // IT 201 requires IT 101
    ];

    // Student took Y1S1: passed IT 101, failed IT 102
    const grades = [
      { subject_id: 'sub-1', grade: 85, status: 'passed' },
      { subject_id: 'sub-2', grade: 60, status: 'failed' }
    ];

    // --- Scenario A: Enrolling in Year 1 Sem 2 ---
    const resultY1S2 = evaluateStudent({
      studentGrades: grades,
      curriculumSubjects: extendedCurriculum,
      prerequisites: extendedPrereqs,
      studentInfo: { year_level: 1, semester: 1 },
      passingThreshold: 75,
      maxFailedPrereqs: 3
    });

    // Target term should advance to Year 1 Sem 2
    expect(resultY1S2.targetTerm).toEqual({ year_level: 1, semester: 2 });

    // IT 102 is a 1st-sem course -> NOT offered in 2nd semester recommendations
    const it102InSem2 = resultY1S2.recommendedSubjects.find(s => s.code === 'IT 102');
    expect(it102InSem2).toBeUndefined();

    // But it remains an active deficiency!
    expect(resultY1S2.activeDeficiencies.some(d => d.code === 'IT 102')).toBe(true);

    // CW 1 (Year 1 Sem 2) is unlocked (no prerequisites)
    const cw1 = resultY1S2.recommendedSubjects.find(s => s.code === 'CW 1');
    expect(cw1).toBeDefined();
    expect(cw1?.reason).toBe('unlocked');

    // IT 103 (Year 1 Sem 2) is blocked because IT 102 failed
    const it103 = resultY1S2.recommendedSubjects.find(s => s.code === 'IT 103');
    expect(it103).toBeDefined();
    expect(it103?.reason).toBe('blocked');

    // --- Scenario B: When enrolling in next academic year, 1st Semester (Year 2 Sem 1) ---
    const resultY2S1 = evaluateStudent({
      studentGrades: [
        ...grades,
        { subject_id: 'sub-4', grade: 88, status: 'passed' } // passed CW 1 in Y1S2
      ],
      curriculumSubjects: extendedCurriculum,
      prerequisites: extendedPrereqs,
      studentInfo: { year_level: 2, semester: 1 },
      passingThreshold: 75,
      maxFailedPrereqs: 3
    });

    // IT 102 IS offered this semester (1st Sem) -> recommended as retake!
    const it102InY2S1 = resultY2S1.recommendedSubjects.find(s => s.code === 'IT 102');
    expect(it102InY2S1).toBeDefined();
    expect(it102InY2S1?.reason).toBe('retake');

    // IT 201 is unlocked because IT 101 passed
    const it201 = resultY2S1.recommendedSubjects.find(s => s.code === 'IT 201');
    expect(it201).toBeDefined();
    expect(it201?.reason).toBe('unlocked');
  });
});
