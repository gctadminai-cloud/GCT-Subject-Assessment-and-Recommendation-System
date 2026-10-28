import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRegistrarData, detectCurrentSemester } from './RegistrarDataContext';
import type { RecommendedSubjectItem, StudentRecommendationRecord, AcademicGrade } from './types';
import { exportOfficialAdvisingSlip } from '../utils/exportUtils';
import { AcademicYearSelector } from '../components/AcademicYearSelector';
import { SemesterSelector, type SemesterValue } from '../components/SemesterSelector';
import {
  generateCurriculumRecommendations,
  type CurriculumRecommendationAnalysis,
  normalizeSubjCode
} from '../utils/curriculumData';
import {
  Sparkles,
  Plus,
  Search,
  Check,
  BookOpen,
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  RotateCcw,
  Loader2
} from 'lucide-react';

interface RecommendationsModuleProps {
  initialStudentId?: string;
  initialSubTab?: string;
  initialSemester?: SemesterValue;
}

export const RecommendationsModule: React.FC<RecommendationsModuleProps> = ({
  initialStudentId,
  initialSemester
}) => {

  const {
    mockStudents,
    curriculumSubjects,
    studentRecommendations,
    setStudentRecommendations,
    mockAcademicGrades,
    fetchStudentGrades,
    showToast,
    activeAcademicYear,
    selectedAcademicYear,
    activeSemesterSetting
  } = useRegistrarData();

  // Institutional current semester fallback
  const institutionalCurrentSemester: SemesterValue = useMemo(() => {
    if (activeSemesterSetting === '1' || activeSemesterSetting === '2' || activeSemesterSetting === 'summer') {
      return activeSemesterSetting as SemesterValue;
    }
    return detectCurrentSemester();
  }, [activeSemesterSetting]);

  function matchStudentId(a?: string | null, b?: string | null): boolean {
    if (!a || !b) return false;
    if (a.toLowerCase() === b.toLowerCase()) return true;
    const ca = String(a).replace(/^student-/i, '').replace(/^acc-/i, '').replace(/^GCT-/i, '').toLowerCase().trim();
    const cb = String(b).replace(/^student-/i, '').replace(/^acc-/i, '').replace(/^GCT-/i, '').toLowerCase().trim();
    return ca === cb;
  }

  // Exclusive Subject Recommendation Term Selectors: Semester (1, 2, summer) & AY
  const [hasManualSemesterSelection, setHasManualSemesterSelection] = useState(false);
  const [selectedSemester, setSelectedSemester] = useState<SemesterValue>(institutionalCurrentSemester);
  const institutionalAy = selectedAcademicYear !== 'all' ? selectedAcademicYear : (activeAcademicYear || '2027-2028');

  // Active student selection state:
  // Starts empty if no initialStudentId was passed, showing "Search for Student" prompt as requested.
  const [selectedRecStudentId, setSelectedRecStudentId] = useState<string>(() => {
    return initialStudentId || '';
  });
  const [studentSearchInput, setStudentSearchInput] = useState('');
  const [studentFilterType, setStudentFilterType] = useState<'all' | 'deficiencies' | 'regular' | 'inactive'>('all');
  const [showSearchResultsDropdown, setShowSearchResultsDropdown] = useState(true);
  const searchBarContainerRef = useRef<HTMLDivElement>(null);

  // Dedicated loaded grades for currently selected student (strictly isolated per studentId)
  const [selectedStudentLoadedGrades, setSelectedStudentLoadedGrades] = useState<{
    studentId: string;
    grades: AcademicGrade[];
    isLoading: boolean;
  }>({ studentId: '', grades: [], isLoading: false });

  // Unified loading guard: True whenever a student is selected but their dedicated grades are still being loaded or not yet bound to active student
  const isGradesLoading = useMemo(() => {
    if (!selectedRecStudentId) return false;
    return (
      selectedStudentLoadedGrades.isLoading ||
      !matchStudentId(selectedStudentLoadedGrades.studentId, selectedRecStudentId)
    );
  }, [selectedRecStudentId, selectedStudentLoadedGrades.isLoading, selectedStudentLoadedGrades.studentId]);

  // Persist selected student to localStorage (or clear if empty)
  useEffect(() => {
    if (selectedRecStudentId) {
      localStorage.setItem('gct_active_rec_student_id', selectedRecStudentId);
    } else {
      localStorage.removeItem('gct_active_rec_student_id');
    }
  }, [selectedRecStudentId]);

  // Sync when navigating from AI Chatbot or external link
  useEffect(() => {
    if (initialStudentId) {
      setSelectedRecStudentId(initialStudentId);
    }
  }, [initialStudentId]);

  // Sync target semester when navigating from AI Chatbot
  useEffect(() => {
    if (initialSemester) {
      setSelectedSemester(initialSemester);
      setHasManualSemesterSelection(true);
    }
  }, [initialSemester]);

  // Automatically fetch complete real grades for selected student with strict cancellation & isolation
  useEffect(() => {
    if (!selectedRecStudentId) {
      setSelectedStudentLoadedGrades({ studentId: '', grades: [], isLoading: false });
      return;
    }

    let isCancelled = false;
    // Immediately isolate state to new student and clear previous student's grades
    setSelectedStudentLoadedGrades({
      studentId: selectedRecStudentId,
      grades: [],
      isLoading: true
    });

    fetchStudentGrades(selectedRecStudentId)
      .then(grades => {
        if (isCancelled) return;
        setSelectedStudentLoadedGrades({
          studentId: selectedRecStudentId,
          grades: grades || [],
          isLoading: false
        });
      })
      .catch(() => {
        if (isCancelled) return;
        setSelectedStudentLoadedGrades({
          studentId: selectedRecStudentId,
          grades: [],
          isLoading: false
        });
      });

    return () => {
      isCancelled = true;
    };
  }, [selectedRecStudentId]);

  // Add Subject Modal State
  const [showAddSubjectRecModal, setShowAddSubjectRecModal] = useState(false);
  const [addRecSelectedCatalogId, setAddRecSelectedCatalogId] = useState('');
  const [addRecRemark, setAddRecRemark] = useState('Regular Track Subject');

  // Active student info
  const studentInfo = useMemo(() => {
    if (!selectedRecStudentId) {
      return {
        name: '',
        student_id: '',
        program: 'BSIT',
        year: 1,
        section: '',
        schedule: '',
        id: ''
      };
    }
    const found = mockStudents.find(
      s => matchStudentId(s.student_id, selectedRecStudentId) || matchStudentId(s.id, selectedRecStudentId)
    );
    if (found) return found;
    return {
      name: 'Student',
      student_id: selectedRecStudentId || 'N/A',
      program: 'BSIT',
      year: 1,
      section: 'A',
      schedule: 'Schedule 1',
      id: selectedRecStudentId || 's-0'
    };
  }, [mockStudents, selectedRecStudentId]);

  // Fast O(1) indexed Map of grades grouped by student ID (prevents millions of loop iterations)
  const gradesByStudentMap = useMemo(() => {
    const map = new Map<string, AcademicGrade[]>();
    for (const g of mockAcademicGrades) {
      if (!g || !g.studentId) continue;
      const raw = String(g.studentId).toLowerCase().trim();
      const clean = raw.replace(/^student-/i, '').replace(/^acc-/i, '').replace(/^gct-/i, '').trim();
      if (!map.has(raw)) map.set(raw, []);
      map.get(raw)!.push(g);
      if (clean !== raw) {
        if (!map.has(clean)) map.set(clean, []);
        map.get(clean)!.push(g);
      }
    }
    return map;
  }, [mockAcademicGrades]);

  // Real grades for selected student — strictly scoped to active student
  const studentGrades = useMemo(() => {
    // If dedicated fetched grades match the active student ID, prioritize them
    if (
      selectedStudentLoadedGrades.studentId &&
      (matchStudentId(selectedStudentLoadedGrades.studentId, selectedRecStudentId) ||
        matchStudentId(selectedStudentLoadedGrades.studentId, studentInfo.student_id) ||
        matchStudentId(selectedStudentLoadedGrades.studentId, studentInfo.id)) &&
      selectedStudentLoadedGrades.grades.length > 0
    ) {
      return selectedStudentLoadedGrades.grades;
    }

    const cleanSel = String(selectedRecStudentId || '').replace(/^student-/i, '').replace(/^acc-/i, '').replace(/^gct-/i, '').toLowerCase().trim();
    const cleanSt = String(studentInfo.student_id || '').replace(/^student-/i, '').replace(/^acc-/i, '').replace(/^gct-/i, '').toLowerCase().trim();
    const fromMap = (cleanSel && gradesByStudentMap.get(cleanSel)) ||
      (cleanSt && gradesByStudentMap.get(cleanSt)) ||
      [];
    if (fromMap.length > 0) return fromMap;

    // Fall back strictly to mockAcademicGrades matching the active student ID
    return mockAcademicGrades.filter(
      g =>
        matchStudentId(g.studentId, selectedRecStudentId) ||
        matchStudentId(g.studentId, studentInfo.student_id) ||
        matchStudentId(g.studentId, studentInfo.id)
    );
  }, [selectedStudentLoadedGrades, mockAcademicGrades, selectedRecStudentId, studentInfo, gradesByStudentMap]);

  // Auto-detect the active semester for the student (adjusts automatically to 2nd semester if student is in 2nd semester)
  const autoDetectedSemester: SemesterValue = useMemo(() => {
    if (!selectedRecStudentId || mockStudents.length === 0 || isGradesLoading) {
      return selectedSemester || institutionalCurrentSemester;
    }
    const naturalAnalysis = generateCurriculumRecommendations(
      studentInfo as any,
      studentGrades,
      curriculumSubjects,
      institutionalAy,
      null // null = allow curriculum engine to naturally determine whether student is in 1st or 2nd sem
    );
    if (naturalAnalysis.targetSemester === 2) return '2';
    if (naturalAnalysis.targetSemester === 3) return 'summer';
    if (naturalAnalysis.targetSemester === 1) return '1';
    return institutionalCurrentSemester;
  }, [selectedRecStudentId, mockStudents.length, studentInfo, studentGrades, curriculumSubjects, institutionalAy, institutionalCurrentSemester, isGradesLoading, selectedSemester]);

  // Automatically adjust selectedSemester to what semester it currently is in
  useEffect(() => {
    if (!hasManualSemesterSelection && !isGradesLoading) {
      setSelectedSemester(autoDetectedSemester);
    }
  }, [autoDetectedSemester, hasManualSemesterSelection, isGradesLoading]);

  // When switching selected student, reset manual selection flag so the next student auto-adjusts
  useEffect(() => {
    setHasManualSemesterSelection(false);
  }, [selectedRecStudentId]);

  // Run curriculum analysis grounded strictly in database records & GCT curriculum
  const analysis: CurriculumRecommendationAnalysis = useMemo(() => {
    return generateCurriculumRecommendations(
      studentInfo as any,
      studentGrades,
      curriculumSubjects,
      institutionalAy,
      hasManualSemesterSelection ? selectedSemester : null
    );
  }, [studentInfo, studentGrades, curriculumSubjects, institutionalAy, selectedSemester, hasManualSemesterSelection]);

  const effectiveAy = useMemo(() => {
    if (selectedAcademicYear !== 'all') return selectedAcademicYear;
    return analysis.targetAcademicYear || activeAcademicYear || '2027-2028';
  }, [selectedAcademicYear, analysis.targetAcademicYear, activeAcademicYear]);

  // Check if we have manually customized/approved subjects in local state for THIS specific student, AY & semester
  const currentRecSubjects = useMemo(() => {
    const existingRec = studentRecommendations.find(
      r => (matchStudentId(r.studentId, selectedRecStudentId) || matchStudentId(r.studentId, studentInfo.student_id)) &&
        (r as any).semester === String(selectedSemester) &&
        (r as any).academicYear === effectiveAy &&
        (r as any).isCustomized === true
    );
    if (existingRec && existingRec.subjects.length > 0) {
      return existingRec.subjects;
    }
    return analysis.recommendedSubjects;
  }, [studentRecommendations, selectedRecStudentId, studentInfo.student_id, selectedSemester, effectiveAy, analysis.recommendedSubjects]);

  // Keep state synced so approvals and removals persist
  useEffect(() => {
    // Guard: Do NOT auto-save recommendations while grades for this student are still loading
    if (isGradesLoading) {
      return;
    }

    if (selectedRecStudentId && currentRecSubjects.length > 0) {
      setStudentRecommendations(prev => {
        const found = prev.find(
          r => (matchStudentId(r.studentId, selectedRecStudentId) || matchStudentId(r.studentId, studentInfo.student_id)) &&
            (r as any).semester === String(selectedSemester) &&
            (r as any).academicYear === effectiveAy
        );
        if (!found) {
          const newRec: StudentRecommendationRecord = {
            studentId: studentInfo.student_id,
            studentName: studentInfo.name,
            program: studentInfo.program,
            yearLevel: analysis.targetYear || studentInfo.year,
            section: studentInfo.section || 'A',
            schedule: studentInfo.schedule || 'Schedule 1',
            subjects: currentRecSubjects,
            academicYear: effectiveAy,
            semester: selectedSemester,
            isCustomized: false
          } as any;
          return [newRec, ...prev];
        }
        return prev;
      });
    }
  }, [selectedRecStudentId, currentRecSubjects, studentInfo, selectedSemester, effectiveAy, selectedStudentLoadedGrades]);

  // Unit calculations
  const totalRecommendedUnits = currentRecSubjects.reduce((sum, s) => sum + (s.totalUnits || 0), 0);
  const totalLecUnits = currentRecSubjects.reduce((sum, s) => sum + (s.lecUnits || 0), 0);
  const totalLabUnits = currentRecSubjects.reduce((sum, s) => sum + (s.labUnits || 0), 0);

  // 🎯 FIX: Compute display counts from CURRENTLY SHOWN recommendation subjects
  // (not just analysis.activeDeficiencies which may diverge from saved user edits)
  const displayedBreakdown = useMemo(() => {
    let retakeCount = 0;
    let regularCount = 0;
    currentRecSubjects.forEach(s => {
      const isRetake = (s.remarks && s.remarks.toLowerCase().includes('retake')) ||
        (s.prerequisites && s.prerequisites.toLowerCase().includes('retake')) ||
        analysis.activeDeficiencies.some(d => normalizeSubjCode(d.code) === normalizeSubjCode(s.code));
      if (isRetake) retakeCount++;
      else regularCount++;
    });
    return { retakeCount, regularCount };
  }, [currentRecSubjects, analysis.activeDeficiencies]);

  const displayedHasDeficiencies = displayedBreakdown.retakeCount > 0 || analysis.activeDeficiencies.length > 0;

  // Quick student list with search & filter — REALISTIC (up-to-date) deficiency detection
  // RULE: Group all of a student's grades by subject code first.
  //       A subject counts as deficient ONLY IF the student has NEVER passed it
  //       in ANY academic term (old failed grades that were later retaken + passed
  //       are NOT counted as backlogs anymore).
  const studentListOptions = useMemo(() => {
    return mockStudents.map(st => {
      // Find all grades belonging to this student via O(1) indexed map
      const cleanSt = String(st.student_id || st.id || '').replace(/^student-/i, '').replace(/^acc-/i, '').replace(/^gct-/i, '').toLowerCase().trim();
      const rawSid = String(st.student_id || '').toLowerCase().trim();
      const rawId = String(st.id || '').toLowerCase().trim();
      const stGrades = (cleanSt && gradesByStudentMap.get(cleanSt)) ||
        (rawSid && gradesByStudentMap.get(rawSid)) ||
        (rawId && gradesByStudentMap.get(rawId)) ||
        [];

      // If this student is currently selected and we have dedicated loaded grades, prioritize them
      const effectiveGrades = (
        selectedStudentLoadedGrades.studentId &&
        (matchStudentId(selectedStudentLoadedGrades.studentId, st.student_id) || matchStudentId(selectedStudentLoadedGrades.studentId, st.id)) &&
        selectedStudentLoadedGrades.grades.length > 0
      ) ? selectedStudentLoadedGrades.grades : stGrades;

      // Default to ground truth pre-computed on student record from backend
      let hasDeficiencies = (st as any).has_deficiencies ?? (st as any).hasDeficiencies ?? false;
      let deficiencyCount = (st as any).deficiency_count ?? (st as any).deficiencyCount ?? (hasDeficiencies ? 1 : 0);

      // If live grade records are loaded in state for this student, verify with real-time accuracy
      if (effectiveGrades.length > 0) {
        const bySubject = new Map<string, typeof effectiveGrades>();
        effectiveGrades.forEach(g => {
          const key = normalizeSubjCode(g.code || g.title || (g as any).subjectId || (g as any).subject_code || '');
          if (!key) return;
          if (!bySubject.has(key)) bySubject.set(key, []);
          bySubject.get(key)!.push(g);
        });

        let liveCount = 0;
        bySubject.forEach((attempts) => {
          const hasEverPassed = attempts.some(g => {
            const isDrop =
              g.status === 'dropped' ||
              g.isDropped === true ||
              g.rawGrade === '9' ||
              g.grade === 9 ||
              String(g.rawGrade || '').toUpperCase() === 'DRP';
            const isZero = g.grade === 0 || Number(g.grade) === 0 || g.rawGrade === '0' || g.rawGrade === '0.0' || String(g.rawGrade || '').trim() === '0';
            const num = Number(g.grade);
            return !isDrop && !isZero && !isNaN(num) && num >= 1.0 && num <= 3.0;
          });

          if (!hasEverPassed && attempts.length > 0) {
            const hasFailedOrDropped = attempts.some(g => {
              const isDrop =
                g.status === 'dropped' ||
                g.isDropped === true ||
                g.rawGrade === '9' ||
                g.grade === 9 ||
                String(g.rawGrade || '').toUpperCase() === 'DRP';
              const isZero = g.grade === 0 || Number(g.grade) === 0 || g.rawGrade === '0' || g.rawGrade === '0.0' || String(g.rawGrade || '').trim() === '0';
              const gNum = Number(g.grade);
              const rawNum = Number(g.rawGrade);
              const isFail =
                g.status === 'failed' ||
                isZero ||
                g.grade === 5 ||
                g.rawGrade === '5' ||
                g.rawGrade === '5.0' ||
                (g.grade !== null && g.grade !== undefined && !isNaN(gNum) && gNum > 3.0) ||
                (g.rawGrade !== null && g.rawGrade !== undefined && !isNaN(rawNum) && rawNum > 3.0);
              return isDrop || isFail || g.status !== 'not_taken';
            });

            if (hasFailedOrDropped) {
              liveCount++;
            }
          }
        });

        hasDeficiencies = liveCount > 0;
        deficiencyCount = liveCount;
      }

      // If this is the currently active student and real grades have loaded, lock in 100% agreement with analysis
      if (
        (matchStudentId(st.student_id, selectedRecStudentId) || matchStudentId(st.id, selectedRecStudentId)) &&
        !isGradesLoading &&
        analysis
      ) {
        hasDeficiencies = displayedHasDeficiencies;
        deficiencyCount = Math.max(analysis.activeDeficiencies.length, displayedBreakdown.retakeCount);
      }

      let effectiveYear = Number(st.year || 1);

      // If this is the currently active/selected student, sync directly with the official curriculum analysis targetYear
      if (
        (matchStudentId(st.student_id, selectedRecStudentId) || matchStudentId(st.id, selectedRecStudentId)) &&
        analysis &&
        analysis.targetYear
      ) {
        effectiveYear = Math.max(effectiveYear, analysis.targetYear);
      } else if (effectiveGrades.length > 0) {
        let maxTakenYear = 1;
        let sem2CountY1 = 0;
        let sem2CountY2 = 0;
        let hasSummerYear3 = false;

        effectiveGrades.forEach(g => {
          if (g.status === 'not_taken') return;
          const y = Number(g.yearLevel || (g as any).year_level);
          if (Number.isFinite(y) && y >= 1 && y <= 4 && y > maxTakenYear) {
            maxTakenYear = y;
          }
          const isSem2 = String(g.semester).toLowerCase().includes('second') || String(g.semester) === '2' || Boolean(g.term && /2nd|second/i.test(g.term));
          const isSummer = String(g.semester).toLowerCase().includes('summer') || String(g.semester) === '3' || Boolean(g.term && /summer/i.test(g.term));
          if (y === 1 && isSem2) sem2CountY1++;
          if (y === 2 && isSem2) sem2CountY2++;
          if (y === 3 && isSummer) hasSummerYear3 = true;
        });

        effectiveYear = maxTakenYear;
        // Year 1 -> 2: completing 2nd sem of Year 1
        if (sem2CountY1 >= 3) effectiveYear = Math.max(effectiveYear, 2);
        // Year 2 -> 3: completing 2nd sem of Year 2
        if (sem2CountY2 >= 3) effectiveYear = Math.max(effectiveYear, 3);
        // Year 3 -> 4: requires completing 3rd Year Summer OR taking Year 4 subjects
        // Completing 3rd Year 2nd Sem keeps the student in 3rd Year because Summer is still required!
        if (hasSummerYear3 || maxTakenYear >= 4) effectiveYear = Math.max(effectiveYear, 4);
        effectiveYear = Math.min(4, Math.max(1, effectiveYear));
      }

      // Track all academic years with grade records for this student
      const studentAys = new Set<string>();
      let latestStudentAy = '';
      let latestStudentAyYear = 0;
      effectiveGrades.forEach(g => {
        const ay = (g.academicYear || (g as any).academic_year || g.term?.match(/\d{4}-\d{4}/)?.[0] || '').trim();
        if (ay) {
          studentAys.add(ay);
          const startYr = parseInt(ay.split('-')[0] || '0', 10);
          if (startYr > latestStudentAyYear) {
            latestStudentAyYear = startYr;
            latestStudentAy = ay;
          }
        }
      });

      // 🎓 FINISHED 4TH YEAR DETECTION:
      // A student has finished 4th year if:
      // 1. Student status is explicitly 'graduated' or 'completed', or catalog standing > 4
      // 2. The student has passed culminating 4th year requirements:
      //    - BSIT: passed OJT-IT (or OJT) or passed all 4th year subjects (CP 2, IT E3, IT E4, IT E5, OJT-IT)
      //    - BSCS: passed OJT-CS (or OJT) or passed all 4th year subjects (CS 19, CS E4, THS 2, CS E5, OJT-CS)
      //    - Culminating 4th year 2nd sem subjects passed (e.g. OJT / Practicum / Capstone 2 + Y4 S2)
      let isFinished4thYear = (st as any).status === 'graduated' ||
        (st as any).status === 'completed' ||
        Number(st.year || (st as any).year_level || 1) > 4;

      if (!isFinished4thYear && effectiveGrades.length > 0) {
        const passedCodes = new Set<string>();
        let hasPassedY4S2 = false;

        effectiveGrades.forEach(g => {
          const isDrop =
            g.status === 'dropped' ||
            g.isDropped === true ||
            g.rawGrade === '9' ||
            g.grade === 9 ||
            String(g.rawGrade || '').toUpperCase() === 'DRP';
          const num = Number(g.grade);
          const isPass = !isDrop && !isNaN(num) && num > 0 && num <= 3.0;

          if (isPass) {
            const norm = normalizeSubjCode(g.code || g.title || (g as any).subjectId || (g as any).subject_code || '');
            if (norm) passedCodes.add(norm);

            const yLvl = Number(g.yearLevel || (g as any).year_level || 0);
            const isSem2 = String(g.semester).toLowerCase().includes('second') || String(g.semester) === '2' || Boolean(g.term && /2nd|second/i.test(g.term));
            if (yLvl === 4 && isSem2) {
              hasPassedY4S2 = true;
            }
          }
        });

        const hasPassedOjt =
          passedCodes.has('ojtit') ||
          passedCodes.has('ojtcs') ||
          passedCodes.has('ojt') ||
          Array.from(passedCodes).some(c => c.includes('ojt'));

        const isBsit = String(st.program || '').toUpperCase().includes('IT');
        const isBscs = String(st.program || '').toUpperCase().includes('CS');

        let allY4Passed = false;
        if (isBsit) {
          const bsitY4 = ['cp2', 'ite3', 'ite4', 'ite5'];
          allY4Passed = (hasPassedOjt || passedCodes.has('ojtit')) && bsitY4.every(c => passedCodes.has(c));
        } else if (isBscs) {
          const bscsY4 = ['cs19', 'cse4', 'ths2', 'cse5'];
          allY4Passed = (hasPassedOjt || passedCodes.has('ojtcs')) && bscsY4.every(c => passedCodes.has(c));
        }

        if (hasPassedOjt || allY4Passed || (hasPassedY4S2 && (passedCodes.has('cp2') || passedCodes.has('ths2')))) {
          isFinished4thYear = true;
        }
      }

      return {
        ...st,
        year: effectiveYear,
        hasDeficiencies,
        deficiencyCount,
        isFinished4thYear,
        academicYears: Array.from(studentAys),
        latestAcademicYear: latestStudentAy
      };
    });
  }, [mockStudents, mockAcademicGrades, selectedStudentLoadedGrades, isGradesLoading, selectedRecStudentId, analysis, displayedHasDeficiencies, displayedBreakdown]);

  // 🎯 Academic Year & Graduation Filter for Subject Recommendations:
  // 1. Exclude students who finished their 4th year / graduated (they have completed their studies and do not need recommendations).
  // 2. When an Academic Year is adjusted / selected (selectedAcademicYear !== 'all'):
  //    Only show students who have records in that academic year, or who are eligible/targeted for that active term.
  const eligibleStudentsInAy = useMemo(() => {
    return studentListOptions.filter(st => {
      // Hard rule: NEVER show students who finished 4th year / graduated in subject recommendations
      if (st.isFinished4thYear) {
        return false;
      }

      // If Academic Year filter is active ('all' shows all eligible non-graduated students)
      if (selectedAcademicYear !== 'all') {
        const hasRecordsInAy = st.academicYears.includes(selectedAcademicYear);
        const isEligibleForActiveAy =
          selectedAcademicYear === activeAcademicYear &&
          (st.academicYears.length === 0 || st.latestAcademicYear === selectedAcademicYear);

        return hasRecordsInAy || isEligibleForActiveAy;
      }

      return true;
    });
  }, [studentListOptions, selectedAcademicYear, activeAcademicYear]);

  const filteredStudentList = useMemo(() => {
    return eligibleStudentsInAy.filter(st => {
      const search = studentSearchInput.toLowerCase().trim();
      const stId = String(st.student_id || '').toLowerCase();
      const stName = String(st.name || '').toLowerCase();
      const stProgram = String(st.program || '').toLowerCase();
      const matchesSearch =
        !search ||
        stName.includes(search) ||
        stId.includes(search) ||
        stProgram.includes(search);

      const matchesFilter =
        studentFilterType === 'all' ||
        (studentFilterType === 'deficiencies' && st.hasDeficiencies) ||
        (studentFilterType === 'regular' && !st.hasDeficiencies);

      return matchesSearch && matchesFilter;
    });
  }, [eligibleStudentsInAy, studentSearchInput, studentFilterType]);

  // When switching between Regular / Deficient / All filter categories,
  // automatically clear the previously selected student so their data disappears.
  const prevFilterTypeRef = useRef(studentFilterType);
  useEffect(() => {
    if (prevFilterTypeRef.current !== studentFilterType) {
      prevFilterTypeRef.current = studentFilterType;
      setSelectedRecStudentId('');
      setStudentSearchInput('');
      setSelectedStudentLoadedGrades({ studentId: '', grades: [], isLoading: false });
    }
  }, [studentFilterType]);

  // Keep selected student synchronized when Academic Year changes or current selection becomes ineligible
  useEffect(() => {
    if (filteredStudentList.length > 0) {
      const isCurrentlySelectedValid = filteredStudentList.some(
        s => matchStudentId(s.student_id, selectedRecStudentId) || matchStudentId(s.id, selectedRecStudentId)
      );
      if (!isCurrentlySelectedValid && selectedRecStudentId) {
        setSelectedRecStudentId('');
        setSelectedStudentLoadedGrades({ studentId: '', grades: [], isLoading: false });
      }
    } else if (selectedRecStudentId) {
      setSelectedRecStudentId('');
      setSelectedStudentLoadedGrades({ studentId: '', grades: [], isLoading: false });
    }
  }, [selectedAcademicYear, filteredStudentList]);

  const isUserActivelySearching = studentSearchInput.trim().length > 0;
  const displayedList = filteredStudentList;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchBarContainerRef.current && !searchBarContainerRef.current.contains(e.target as Node)) {
        setShowSearchResultsDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectFromDropdown = (studentId: string) => {
    setSelectedRecStudentId(studentId);
    setShowSearchResultsDropdown(false);
  };

  const currentStudentIndex = filteredStudentList.findIndex(
    s => matchStudentId(s.student_id, selectedRecStudentId) || matchStudentId(s.id, selectedRecStudentId)
  );

  const handlePrevStudent = () => {
    if (currentStudentIndex > 0) {
      setSelectedRecStudentId(filteredStudentList[currentStudentIndex - 1].student_id);
    }
  };

  const handleNextStudent = () => {
    if (currentStudentIndex < filteredStudentList.length - 1) {
      setSelectedRecStudentId(filteredStudentList[currentStudentIndex + 1].student_id);
    }
  };

  // Open modal to add subject recommendation
  const handleOpenAddSubjectRecModal = () => {
    const candidateSubjects = curriculumSubjects.filter(cs => cs.program === studentInfo.program);
    if (candidateSubjects.length > 0) {
      setAddRecSelectedCatalogId(candidateSubjects[0].id);
    } else if (curriculumSubjects.length > 0) {
      setAddRecSelectedCatalogId(curriculumSubjects[0].id);
    }
    setAddRecRemark('Regular Track Subject');
    setShowAddSubjectRecModal(true);
  };

  // Save new subject recommendation
  const handleSaveAddSubjectRecommendation = (e: React.FormEvent) => {
    e.preventDefault();
    const catalogSubj = curriculumSubjects.find(cs => cs.id === addRecSelectedCatalogId);
    if (!catalogSubj) {
      showToast('Please select a subject from the catalog.', 'error');
      return;
    }

    const newSubjectItem: RecommendedSubjectItem = {
      id: 'rec-item-' + Date.now(),
      code: catalogSubj.code,
      title: catalogSubj.title,
      lecUnits: Number(catalogSubj.lecUnits ?? 2),
      labUnits: Number(catalogSubj.labUnits ?? 1),
      totalUnits: Number(catalogSubj.units ?? (Number(catalogSubj.lecUnits ?? 2) + Number(catalogSubj.labUnits ?? 1))),
      prerequisites: catalogSubj.prerequisites || 'None',
      isApproved: false,
      remarks: addRecRemark || 'Added from Catalog'
    };

    setStudentRecommendations(prev => {
      const existing = prev.find(r => r.studentId === selectedRecStudentId);
      if (existing) {
        if (existing.subjects.some(s => s.code.toLowerCase() === catalogSubj.code.toLowerCase())) {
          showToast(`${catalogSubj.code} is already in the student's recommendation list!`, 'info');
          return prev;
        }
        return prev.map(r =>
          (matchStudentId(r.studentId, selectedRecStudentId) && (r as any).semester === String(selectedSemester) && (r as any).academicYear === effectiveAy)
            ? {
              ...r,
              isCustomized: true,
              subjects: [...r.subjects, newSubjectItem]
            }
            : r
        );
      } else {
        const newRec: StudentRecommendationRecord = {
          studentId: selectedRecStudentId,
          studentName: studentInfo.name,
          program: studentInfo.program,
          yearLevel: analysis.targetYear || studentInfo.year,
          section: studentInfo.section || 'A',
          schedule: studentInfo.schedule || 'Schedule 1',
          subjects: [newSubjectItem],
          academicYear: effectiveAy,
          semester: selectedSemester,
          isCustomized: true
        } as any;
        return [newRec, ...prev];
      }
    });

    showToast(`${catalogSubj.code} added to recommended subjects!`, 'success');
    setShowAddSubjectRecModal(false);
  };

  // Export Advising Slip Excel
  const handleExportAdvisingSlip = () => {
    const semLabel = selectedSemester === '1'
      ? '1st Semester'
      : selectedSemester === '2'
        ? '2nd Semester'
        : 'Summer Term';
    const termLabel = `${effectiveAy} ${semLabel}`;

    exportOfficialAdvisingSlip({
      name: studentInfo.name,
      studentId: studentInfo.student_id,
      program: studentInfo.program,
      yearLevel: `Year ${analysis.targetYear || studentInfo.year}`,
      term: termLabel,
      recommendations: currentRecSubjects.map(s => ({
        code: s.code,
        title: s.title,
        units: s.totalUnits,
        reason: s.remarks?.toLowerCase().includes('retake') ? 'retake' : 'recommended',
        notes: s.remarks || 'Recommended for Enrollment'
      }))
    });
    showToast(`Exported Official Advising Slip for ${studentInfo.name} (${termLabel})!`, 'success');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', fontFamily: 'Inter, system-ui, -apple-system, sans-serif', color: '#0F172A' }}>
      {/* Dedicated Subject Recommendation Header Bar with AY & Semester Selectors */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#FFFFFF',
          padding: '0.75rem 1.15rem',
          borderRadius: '12px',
          border: '1px solid #E2E8F0',
          boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
          flexWrap: 'wrap',
          gap: '0.85rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF',
              boxShadow: '0 2px 6px rgba(37, 99, 235, 0.25)'
            }}
          >
            <Sparkles size={20} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.08rem', fontWeight: 800, color: '#0F172A', margin: 0, lineHeight: 1.2 }}>
              Subject Recommendation System
            </h2>
            <p style={{ fontSize: '0.78rem', color: '#64748B', margin: 0, marginTop: '0.15rem', fontWeight: 500 }}>
              Automated prerequisite validation and recommended course load per student
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
          {/* 📅 Academic Year Dropdown */}
          <AcademicYearSelector variant="light" />

          {/* 🎓 Semester Dropdown (1st Sem, 2nd Sem, Summer) */}
          <SemesterSelector
            selectedSemester={selectedSemester}
            currentSemester={autoDetectedSemester}
            onSelectSemester={(sem) => {
              setHasManualSemesterSelection(true);
              setSelectedSemester(sem);
              const semText = sem === '1' ? '1st Semester' : sem === '2' ? '2nd Semester' : 'Summer';
              showToast(`Viewing recommendations for ${semText}`, 'info');
            }}
            variant="light"
          />
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
        {/* ========================================================================= */}
        {/* 1. STUDENT SEARCH & SELECTION WORKSPACE BAR                               */}
        {/* ========================================================================= */}
        <div
          style={{
            background: '#FFFFFF',
            borderRadius: '10px',
            border: '1px solid #E2E8F0',
            padding: '0.75rem 1rem',
            boxShadow: '0 1px 2px rgba(15, 23, 42, 0.03)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.65rem'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0F172A', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                Student Prerequisite Assessment
              </h3>
              <span style={{ fontSize: '0.72rem', color: '#64748B' }}>
                Select a student to view records, evaluate prerequisites, and approve recommendations.
              </span>
            </div>

            {/* Status Filter Chips */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <button
                type="button"
                onClick={() => {
                  if (studentFilterType !== 'all') {
                    setStudentFilterType('all');
                    setSelectedRecStudentId('');
                    setStudentSearchInput('');
                    setSelectedStudentLoadedGrades({ studentId: '', grades: [], isLoading: false });
                  }
                }}
                style={{
                  padding: '0.3rem 0.65rem',
                  borderRadius: '7px',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  border: studentFilterType === 'all' ? '1px solid #2563EB' : '1px solid #E2E8F0',
                  background: studentFilterType === 'all' ? '#EFF6FF' : '#FFFFFF',
                  color: studentFilterType === 'all' ? '#1D4ED8' : '#64748B',
                  cursor: 'pointer'
                }}
              >
                All ({eligibleStudentsInAy.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  if (studentFilterType !== 'deficiencies') {
                    setStudentFilterType('deficiencies');
                    setSelectedRecStudentId('');
                    setStudentSearchInput('');
                    setSelectedStudentLoadedGrades({ studentId: '', grades: [], isLoading: false });
                  }
                }}
                style={{
                  padding: '0.3rem 0.65rem',
                  borderRadius: '7px',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  border: studentFilterType === 'deficiencies' ? '1px solid #F59E0B' : '1px solid #E2E8F0',
                  background: studentFilterType === 'deficiencies' ? '#FFFBEB' : '#FFFFFF',
                  color: studentFilterType === 'deficiencies' ? '#B45309' : '#64748B',
                  cursor: 'pointer'
                }}
              >
                ⚠️ Deficient ({eligibleStudentsInAy.filter(s => s.hasDeficiencies).length})
              </button>
              <button
                type="button"
                onClick={() => {
                  if (studentFilterType !== 'regular') {
                    setStudentFilterType('regular');
                    setSelectedRecStudentId('');
                    setStudentSearchInput('');
                    setSelectedStudentLoadedGrades({ studentId: '', grades: [], isLoading: false });
                  }
                }}
                style={{
                  padding: '0.3rem 0.65rem',
                  borderRadius: '7px',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  border: studentFilterType === 'regular' ? '1px solid #10B981' : '1px solid #E2E8F0',
                  background: studentFilterType === 'regular' ? '#ECFDF5' : '#FFFFFF',
                  color: studentFilterType === 'regular' ? '#047857' : '#64748B',
                  cursor: 'pointer'
                }}
              >
                ✓ Regular ({eligibleStudentsInAy.filter(s => !s.hasDeficiencies).length})
              </button>
            </div>
          </div>

          {/* Quick Selector Dropdown & Search Inputs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap' }}>
            <div ref={searchBarContainerRef} style={{ position: 'relative', flex: '1 1 220px' }}>
              <input
                type="text"
                placeholder="Search name, ID, or program..."
                value={studentSearchInput}
                onChange={e => {
                  const val = e.target.value;
                  setStudentSearchInput(val);
                  setShowSearchResultsDropdown(val.trim().length > 0);
                }}
                onFocus={() => {
                  if (studentSearchInput.trim().length > 0) {
                    setShowSearchResultsDropdown(true);
                  }
                }}
                onKeyDown={e => {
                  if (e.key === 'Escape') {
                    setStudentSearchInput('');
                    setShowSearchResultsDropdown(false);
                  }
                  if (e.key === 'ArrowDown') {
                    if (studentSearchInput.trim().length > 0) {
                      e.preventDefault();
                      setShowSearchResultsDropdown(true);
                    }
                  }
                  if (e.key === 'Enter' && filteredStudentList.length > 0) {
                    setSelectedRecStudentId(filteredStudentList[0].student_id);
                    setShowSearchResultsDropdown(false);
                  }
                }}
                style={{
                  width: '100%',
                  padding: `0.48rem ${studentSearchInput ? '2.1rem' : '0.75rem'} 0.48rem 2rem`,
                  borderRadius: '8px',
                  background: '#F8FAFC',
                  border: (studentSearchInput.trim().length > 0 && showSearchResultsDropdown) ? '1px solid #2563EB' : '1px solid #E2E8F0',
                  boxShadow: (studentSearchInput.trim().length > 0 && showSearchResultsDropdown) ? '0 0 0 3px rgba(37, 99, 235, 0.1)' : 'none',
                  color: '#0F172A',
                  fontSize: '0.8rem',
                  outline: 'none'
                }}
              />
              <Search size={14} color="#94A3B8" style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)' }} />
              {studentSearchInput && (
                <button
                  type="button"
                  title="Clear search (Esc)"
                  onClick={() => {
                    setStudentSearchInput('');
                    setShowSearchResultsDropdown(false);
                  }}
                  style={{
                    position: 'absolute',
                    right: '0.4rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    border: 'none',
                    background: '#CBD5E1',
                    color: '#475569',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 0,
                    fontSize: '0.75rem',
                    fontWeight: 700
                  }}
                >
                  ✕
                </button>
              )}

              {showSearchResultsDropdown && studentSearchInput.trim().length > 0 && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 6px)',
                    left: 0,
                    right: 0,
                    background: '#FFFFFF',
                    border: '1px solid #E2E8F0',
                    borderRadius: '10px',
                    boxShadow: '0 10px 25px rgba(15, 23, 42, 0.12), 0 2px 6px rgba(15, 23, 42, 0.06)',
                    zIndex: 1000,
                    maxHeight: '340px',
                    overflowY: 'auto',
                    padding: '0.35rem'
                  }}
                >
                  {filteredStudentList.length === 0 ? (
                    <div
                      style={{
                        padding: '0.85rem 0.75rem',
                        fontSize: '0.78rem',
                        color: '#94A3B8',
                        textAlign: 'center',
                        fontWeight: 500
                      }}
                    >
                      📭 No students found — try a different search
                    </div>
                  ) : (
                    <>
                      <div
                        style={{
                          padding: '0.35rem 0.55rem',
                          fontSize: '0.65rem',
                          fontWeight: 700,
                          color: '#64748B',
                          textTransform: 'uppercase',
                          letterSpacing: '0.02em',
                          borderBottom: '1px solid #F1F5F9',
                          marginBottom: '0.2rem',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                      >
                        <span>{filteredStudentList.length} result{filteredStudentList.length === 1 ? '' : 's'}</span>
                        {displayedList.length < filteredStudentList.length && (
                          <span style={{ textTransform: 'none', letterSpacing: '0', fontWeight: 600, color: '#94A3B8' }}>
                            Showing first {displayedList.length}
                          </span>
                        )}
                      </div>
                      {displayedList.map(st => {
                        const isSelected = st.student_id === selectedRecStudentId || st.id === selectedRecStudentId;
                        return (
                          <button
                            key={st.student_id}
                            type="button"
                            onClick={() => handleSelectFromDropdown(st.student_id)}
                            style={{
                              display: 'block',
                              width: '100%',
                              textAlign: 'left',
                              padding: '0.45rem 0.6rem',
                              borderRadius: '7px',
                              border: isSelected ? '1px solid #BFDBFE' : '1px solid transparent',
                              background: isSelected ? '#EFF6FF' : 'transparent',
                              cursor: 'pointer',
                              marginBottom: '0.1rem',
                              transition: 'all 0.12s ease'
                            }}
                            onMouseEnter={(e) => {
                              if (!isSelected) {
                                (e.currentTarget as HTMLButtonElement).style.background = '#F8FAFC';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!isSelected) {
                                (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                              }
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'space-between' }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div
                                  style={{
                                    fontSize: '0.8rem',
                                    fontWeight: isSelected ? 700 : 600,
                                    color: isSelected ? '#1D4ED8' : '#0F172A',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                  }}
                                >
                                  {st.name}
                                </div>
                                <div
                                  style={{
                                    fontSize: '0.7rem',
                                    color: '#64748B',
                                    marginTop: '0.1rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.35rem',
                                    flexWrap: 'wrap'
                                  }}
                                >
                                  <span style={{ fontWeight: 700, color: '#475569' }}>{st.student_id}</span>
                                  <span style={{ opacity: 0.5 }}>·</span>
                                  <span>{st.program} Y{st.year}</span>
                                </div>
                              </div>
                              <div style={{ flexShrink: 0 }}>
                                {st.hasDeficiencies ? (
                                  <span
                                    title="Has deficiencies"
                                    style={{
                                      fontSize: '0.65rem',
                                      fontWeight: 700,
                                      padding: '2px 6px',
                                      borderRadius: '5px',
                                      background: '#FFFBEB',
                                      color: '#B45309',
                                      border: '1px solid #FDE68A',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '0.2rem'
                                    }}
                                  >
                                    ⚠️ Deficient
                                  </span>
                                ) : (
                                  <span
                                    title="Regular status"
                                    style={{
                                      fontSize: '0.65rem',
                                      fontWeight: 700,
                                      padding: '2px 6px',
                                      borderRadius: '5px',
                                      background: '#ECFDF5',
                                      color: '#047857',
                                      border: '1px solid #A7F3D0',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '0.2rem'
                                    }}
                                  >
                                    ✓ Regular
                                  </span>
                                )}
                                {isSelected && (
                                  <Check size={14} color="#1D4ED8" style={{ marginLeft: '0.3rem', verticalAlign: 'middle' }} />
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                      {displayedList.length < filteredStudentList.length && !isUserActivelySearching && (
                        <div
                          style={{
                            padding: '0.4rem 0.6rem',
                            textAlign: 'center',
                            fontSize: '0.7rem',
                            color: '#64748B',
                            borderTop: '1px solid #F1F5F9',
                            fontWeight: 600
                          }}
                        >
                          ⚡ Showing first {displayedList.length} of {filteredStudentList.length} — type a name / ID in the search box to see more
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Student Dropdown Selector */}
            <div style={{ flex: '2 1 320px', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <select
                value={selectedRecStudentId}
                onChange={e => setSelectedRecStudentId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.48rem 0.75rem',
                  borderRadius: '8px',
                  background: '#FFFFFF',
                  border: selectedRecStudentId ? '1px solid #2563EB' : '1px solid #E2E8F0',
                  color: selectedRecStudentId ? '#0F172A' : '#94A3B8',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="">— Select a student first —</option>
                {filteredStudentList.length > 0 ? (
                  filteredStudentList.map(st => (
                    <option key={st.student_id} value={st.student_id}>
                      {st.student_id} — {st.name} ({st.program} Y{st.year}) {st.hasDeficiencies ? '⚠️' : '✓'}
                    </option>
                  ))
                ) : (
                  <option value="" disabled>
                    {selectedAcademicYear !== 'all'
                      ? `📭 No eligible students found for AY ${selectedAcademicYear}`
                      : '📭 No matching students found — try a different search'}
                  </option>
                )}
              </select>
              {(studentSearchInput || studentFilterType !== 'all') && (
                <span
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    padding: '0.3rem 0.55rem',
                    borderRadius: '6px',
                    background: filteredStudentList.length === 1 ? '#ECFDF5' : filteredStudentList.length > 0 ? '#EFF6FF' : '#FEF2F2',
                    color: filteredStudentList.length === 1 ? '#047857' : filteredStudentList.length > 0 ? '#1D4ED8' : '#B91C1C',
                    border: `1px solid ${filteredStudentList.length === 1 ? '#A7F3D0' : filteredStudentList.length > 0 ? '#BFDBFE' : '#FECACA'}`,
                    whiteSpace: 'nowrap',
                    flexShrink: 0
                  }}
                  title={filteredStudentList.length === 1 ? 'Auto-selected — only 1 match' : filteredStudentList.length > 0 ? `Showing ${currentStudentIndex + 1} of ${filteredStudentList.length} matches` : 'Try a different search or filter'}
                >
                  {filteredStudentList.length === 0
                    ? '0 found'
                    : !selectedRecStudentId
                      ? `${filteredStudentList.length} students`
                      : `${currentStudentIndex + 1}/${filteredStudentList.length}`}
                </span>
              )}
            </div>

            {/* Prev / Next Navigation Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <button
                type="button"
                onClick={handlePrevStudent}
                disabled={currentStudentIndex <= 0}
                style={{
                  padding: '0.48rem 0.6rem',
                  borderRadius: '8px',
                  border: '1px solid #E2E8F0',
                  background: currentStudentIndex <= 0 ? '#F8FAFC' : '#FFFFFF',
                  color: currentStudentIndex <= 0 ? '#94A3B8' : '#334155',
                  cursor: currentStudentIndex <= 0 ? 'default' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  fontSize: '0.78rem',
                  fontWeight: 600
                }}
                title="Previous Student"
              >
                <ChevronLeft size={15} />
              </button>
              <button
                type="button"
                onClick={handleNextStudent}
                disabled={currentStudentIndex >= filteredStudentList.length - 1}
                style={{
                  padding: '0.48rem 0.6rem',
                  borderRadius: '8px',
                  border: '1px solid #E2E8F0',
                  background: currentStudentIndex >= filteredStudentList.length - 1 ? '#F8FAFC' : '#FFFFFF',
                  color: currentStudentIndex >= filteredStudentList.length - 1 ? '#94A3B8' : '#334155',
                  cursor: currentStudentIndex >= filteredStudentList.length - 1 ? 'default' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  fontSize: '0.78rem',
                  fontWeight: 600
                }}
                title="Next Student"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        </div>

        {selectedRecStudentId ? (
          isGradesLoading ? (
            <div
              style={{
                background: '#FFFFFF',
                borderRadius: '12px',
                border: '1px solid #E2E8F0',
                padding: '3rem 2rem',
                boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '1rem',
                minHeight: '340px'
              }}
            >
              <div
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)',
                  border: '1px solid #BFDBFE',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#2563EB',
                  boxShadow: '0 2px 6px rgba(37, 99, 235, 0.15)'
                }}
              >
                <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} />
              </div>
              <div style={{ textAlign: 'center' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                  Evaluating Academic Records for {studentInfo.name || 'Selected Student'}...
                </h3>
                <p style={{ fontSize: '0.8rem', color: '#64748B', margin: '0.35rem 0 0 0' }}>
                  Validating prerequisite history and course recommendations for {effectiveAy}...
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <div style={{ width: '110px', height: '12px', borderRadius: '4px', background: '#F1F5F9', animation: 'pulse 1.4s infinite' }} />
                <div style={{ width: '75px', height: '12px', borderRadius: '4px', background: '#F1F5F9', animation: 'pulse 1.4s infinite' }} />
                <div style={{ width: '95px', height: '12px', borderRadius: '4px', background: '#F1F5F9', animation: 'pulse 1.4s infinite' }} />
              </div>
            </div>
          ) : (
            <>
              {/* ========================================================================= */}
              {/* 2. ACTIVE STUDENT PROFILE & ACADEMIC STANDING BANNER                       */}
              {/* ========================================================================= */}
              <div
                style={{
                  background: '#FFFFFF',
                  borderRadius: '10px',
                  border: '1px solid #E2E8F0',
                  padding: '0.9rem 1.1rem',
                  boxShadow: '0 1px 2px rgba(15, 23, 42, 0.03)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem'
                }}
              >
                {/* Top Row: Avatar, Student Info, Actions */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                    <div
                      style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: '10px',
                        background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#FFFFFF',
                        fontWeight: 800,
                        fontSize: '1.05rem',
                        boxShadow: '0 3px 8px rgba(37, 99, 235, 0.2)'
                      }}
                    >
                      {studentInfo.name.slice(0, 2).toUpperCase()}
                    </div>

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                          {studentInfo.name}
                        </h2>
                        <span
                          style={{
                            background: '#EFF6FF',
                            color: '#1D4ED8',
                            border: '1px solid #BFDBFE',
                            padding: '1px 7px',
                            borderRadius: '5px',
                            fontSize: '0.7rem',
                            fontWeight: 700
                          }}
                        >
                          {studentInfo.student_id}
                        </span>
                        {isGradesLoading ? (
                          <span
                            style={{
                              background: '#F1F5F9',
                              color: '#64748B',
                              border: '1px solid #E2E8F0',
                              padding: '1px 7px',
                              borderRadius: '5px',
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem'
                            }}
                          >
                            <Clock size={11} /> Loading records...
                          </span>
                        ) : displayedHasDeficiencies ? (
                          <span
                            style={{
                              background: '#FEF2F2',
                              color: '#DC2626',
                              border: '1px solid #FECACA',
                              padding: '1px 7px',
                              borderRadius: '5px',
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem'
                            }}
                          >
                            <ShieldAlert size={11} /> Irregular • {Math.max(analysis.activeDeficiencies.length, displayedBreakdown.retakeCount)} def.
                          </span>
                        ) : (
                          <span
                            style={{
                              background: '#ECFDF5',
                              color: '#059669',
                              border: '1px solid #A7F3D0',
                              padding: '1px 7px',
                              borderRadius: '5px',
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem'
                            }}
                          >
                            <CheckCircle2 size={11} /> Regular
                          </span>
                        )}
                      </div>

                      <div style={{ fontSize: '0.78rem', color: '#64748B', marginTop: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span>{studentInfo.program} • {['1st', '2nd', '3rd', '4th'][analysis.targetYear - 1] || analysis.targetYear} Year • {analysis.targetSemester === 3 ? 'Summer' : (analysis.targetSemester === 2 ? '2nd Sem' : '1st Sem')}</span>
                      </div>
                    </div>
                  </div>

                  {/* Action Toolbar */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      title="Clear and search another student"
                      onClick={() => {
                        setSelectedRecStudentId('');
                        setStudentSearchInput('');
                      }}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                        background: '#F8FAFC',
                        color: '#475569',
                        border: '1px solid #CBD5E1',
                        padding: '0.48rem 0.75rem',
                        borderRadius: '7px',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <Search size={13} /> Change Student
                    </button>

                    <button
                      type="button"
                      onClick={handleOpenAddSubjectRecModal}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                        background: '#2563EB',
                        color: '#FFFFFF',
                        border: 'none',
                        padding: '0.48rem 0.85rem',
                        borderRadius: '7px',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        boxShadow: '0 1px 4px rgba(37, 99, 235, 0.18)',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <Plus size={14} /> Add
                    </button>

                    <button
                      type="button"
                      onClick={handleExportAdvisingSlip}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                        background: '#FFFFFF',
                        color: '#0284C7',
                        border: '1px solid #BAE6FD',
                        padding: '0.48rem 0.85rem',
                        borderRadius: '7px',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <FileSpreadsheet size={14} /> Export
                    </button>
                  </div>
                </div>

                {/* Quick Metrics Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.65rem' }}>
                  <div style={{ background: '#FAFBFC', padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid #F1F5F9' }}>
                    <div style={{ fontSize: '0.68rem', color: '#64748B', fontWeight: 500 }}>Units Passed</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0F172A', marginTop: '0.1rem' }}>
                      {analysis.totalPassedUnits}
                    </div>
                    <div style={{ fontSize: '0.65rem', color: '#94A3B8', marginTop: '0.05rem' }}>
                      Completed
                    </div>
                  </div>

                  <div style={{ background: '#FAFBFC', padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid #F1F5F9' }}>
                    <div style={{ fontSize: '0.68rem', color: '#64748B', fontWeight: 500 }}>Cumulative GWA</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#2563EB', marginTop: '0.1rem' }}>
                      {analysis.cumulativeGwa !== null ? analysis.cumulativeGwa.toFixed(2) : 'N/A'}
                    </div>
                    <div style={{ fontSize: '0.65rem', color: '#94A3B8', marginTop: '0.05rem' }}>
                      Weighted Average
                    </div>
                  </div>

                  <div style={{ background: '#FAFBFC', padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid #F1F5F9' }}>
                    <div style={{ fontSize: '0.68rem', color: '#64748B', fontWeight: 500 }}>Deficiencies</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 700, color: displayedHasDeficiencies ? '#DC2626' : '#16A34A', marginTop: '0.1rem' }}>
                      {displayedHasDeficiencies ? Math.max(analysis.activeDeficiencies.length, displayedBreakdown.retakeCount) : '0'}
                    </div>
                    <div style={{ fontSize: '0.65rem', color: '#94A3B8', marginTop: '0.05rem' }}>
                      {displayedHasDeficiencies ? 'Retakes needed' : 'All clear'}
                    </div>
                  </div>

                  <div style={{ background: '#FAFBFC', padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid #F1F5F9' }}>
                    <div style={{ fontSize: '0.68rem', color: '#64748B', fontWeight: 500 }}>Recommended Load</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0F172A', marginTop: '0.1rem' }}>
                      {totalRecommendedUnits} units
                    </div>
                    <div style={{ fontSize: '0.65rem', color: '#94A3B8', marginTop: '0.05rem' }}>
                      {totalLecUnits}L / {totalLabUnits}Lab (max 24)
                    </div>
                  </div>
                </div>
              </div>

              {/* ========================================================================= */}
              {/* 🎯 LAPSED / RETURNING STUDENT HISTORICAL STANDING CARD                */}
              {/* ========================================================================= */}
              {analysis.isLapsedStudent && (
                <div
                  style={{
                    background: '#FFFFFF',
                    borderRadius: '10px',
                    border: '1px solid #FDE68A',
                    borderLeft: '4px solid #F59E0B',
                    padding: '0.9rem 1.1rem',
                    boxShadow: '0 1px 3px rgba(245, 158, 11, 0.08)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.65rem',
                    marginBottom: '0.25rem'
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer'
                    }}
                    onClick={() => {
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '28px',
                          height: '28px',
                          borderRadius: '7px',
                          background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
                          color: '#FFFFFF',
                          fontSize: '0.85rem',
                          fontWeight: 800
                        }}
                      >
                        📋
                      </span>
                      <div>
                        <h3
                          style={{
                            fontSize: '0.88rem',
                            fontWeight: 700,
                            color: '#92400E',
                            margin: 0
                          }}
                        >
                          Historical Standing & Returning Student Summary
                        </h3>
                        <span
                          style={{
                            fontSize: '0.7rem',
                            color: '#B45309',
                            fontWeight: 600
                          }}
                        >
                          Student has a gap since last enrollment term
                        </span>
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                      gap: '0.65rem',
                      marginTop: '0.25rem'
                    }}
                  >
                    <div
                      style={{
                        padding: '0.6rem 0.75rem',
                        borderRadius: '8px',
                        background: '#FFFBEB',
                        border: '1px solid #FDE68A'
                      }}
                    >
                      <div style={{ fontSize: '0.65rem', color: '#92400E', fontWeight: 700, marginBottom: '0.2rem', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                        Last Enrolled Term
                      </div>
                      <div style={{ fontSize: '0.82rem', color: '#78350F', fontWeight: 700 }}>
                        {analysis.lastEnrolledTermLabel || 'Not available'}
                      </div>
                    </div>

                    <div
                      style={{
                        padding: '0.6rem 0.75rem',
                        borderRadius: '8px',
                        background: '#FEF3C7',
                        border: '1px solid #FDE68A'
                      }}
                    >
                      <div style={{ fontSize: '0.65rem', color: '#92400E', fontWeight: 700, marginBottom: '0.2rem', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                        Gap Since Last Enrollment
                      </div>
                      <div style={{ fontSize: '0.82rem', color: '#78350F', fontWeight: 700 }}>
                        {(() => {
                          const lastAy = analysis.lastEnrolledAcademicYear;
                          if (!lastAy || !activeAcademicYear) return 'N/A';
                          const lastStart = parseInt(String(lastAy).split('-')[0] || '0', 10);
                          const activeStart = parseInt(String(activeAcademicYear).split('-')[0] || '0', 10);
                          const gap = activeStart - lastStart;
                          return gap > 0 ? `${gap} academic year${gap > 1 ? 's' : ''} ago` : 'Current / Recent';
                        })()}
                      </div>
                    </div>

                    <div
                      style={{
                        padding: '0.6rem 0.75rem',
                        borderRadius: '8px',
                        background: displayedHasDeficiencies ? '#FEF2F2' : '#ECFDF5',
                        border: `1px solid ${displayedHasDeficiencies ? '#FECACA' : '#A7F3D0'}`
                      }}
                    >
                      <div style={{ fontSize: '0.65rem', color: displayedHasDeficiencies ? '#991B1B' : '#065F46', fontWeight: 700, marginBottom: '0.2rem', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                        Active Deficiencies (Need Retake)
                      </div>
                      <div style={{ fontSize: '0.82rem', color: displayedHasDeficiencies ? '#7F1D1D' : '#064E3B', fontWeight: 700 }}>
                        {Math.max(analysis.activeDeficiencies.length, displayedBreakdown.retakeCount)} subject(s)
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      marginTop: '0.3rem',
                      padding: '0.6rem 0.8rem',
                      borderRadius: '8px',
                      background: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                      fontSize: '0.74rem',
                      color: '#475569',
                      lineHeight: 1.5,
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.5rem'
                    }}
                  >
                    <AlertTriangle size={14} color="#D97706" style={{ flexShrink: 0, marginTop: '1px' }} />
                    <div>
                      <strong style={{ color: '#92400E' }}>Returning Student Notice:</strong>
                      &nbsp;This student has a gap in enrollment. Please verify their residency and department status
                      with the Registrar Office before confirming the recommended subject list below.
                      Prerequisite chains and retake priorities listed below are curriculum-based; residency
                      clearance is handled separately.
                    </div>
                  </div>
                </div>
              )}

              {/* ========================================================================= */}
              {/* 3. TARGET TERM INFO BANNER — explains which semester the recommendations are for */}
              {/* ========================================================================= */}
              <div
                style={{
                  background: '#EFF6FF',
                  border: '1px solid #BFDBFE',
                  borderRadius: '10px',
                  padding: '0.7rem 0.9rem',
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: '0.75rem',
                  flexWrap: 'wrap'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div
                    style={{
                      width: '30px',
                      height: '30px',
                      borderRadius: '7px',
                      background: '#2563EB',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#FFFFFF',
                      flexShrink: 0
                    }}
                  >
                    <BookOpen size={15} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1E3A8A', margin: 0 }}>
                      Recommendations for: <span style={{ color: '#1D4ED8' }}>{analysis.targetTermLabel}</span>
                      <span style={{ marginLeft: '6px', fontSize: '0.74rem', color: '#1E40AF', fontWeight: 700 }}>
                        • AY {effectiveAy}
                      </span>
                      {(displayedHasDeficiencies || analysis.hasSignificantBacklog) && (
                        <span style={{ marginLeft: '6px', fontSize: '0.68rem', fontWeight: 700, color: '#92400E', background: '#FEF3C7', padding: '2px 6px', borderRadius: '4px', border: '1px solid #FDE68A' }}>
                          ⚠️ Deficient: {Math.max(analysis.activeDeficiencies.length, displayedBreakdown.retakeCount)} retake{Math.max(analysis.activeDeficiencies.length, displayedBreakdown.retakeCount) === 1 ? '' : 's'} + regular subjects
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#1E40AF', marginTop: '0.1rem' }}>
                      {displayedHasDeficiencies
                        ? `Includes prerequisite retakes + eligible regular subjects for the upcoming term (${analysis.targetTermLabel}) whose prerequisites are cleared.`
                        : `Includes all regular subjects for ${analysis.targetTermLabel} whose prerequisites are cleared.`}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span style={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    padding: '3px 8px',
                    borderRadius: '5px',
                    background: '#FEE2E2',
                    color: '#B91C1C',
                    border: '1px solid #FECACA'
                  }}>
                    🔁 Retakes: {displayedBreakdown.retakeCount}
                  </span>
                  <span style={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    padding: '3px 8px',
                    borderRadius: '5px',
                    background: '#DBEAFE',
                    color: '#1D4ED8',
                    border: '1px solid #BFDBFE'
                  }}>
                    📚 Regular: {displayedBreakdown.regularCount}
                  </span>
                  <span style={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    padding: '3px 8px',
                    borderRadius: '5px',
                    background: '#FEF3C7',
                    color: '#92400E',
                    border: '1px solid #FDE68A'
                  }}>
                    🔒 Blocked: {analysis.blockedSubjects.length}
                  </span>
                </div>
              </div>

              {/* ========================================================================= */}
              {/* 4. ACTIVE PREREQUISITE DEFICIENCIES & RETAKE WARNING BANNER               */}
              {/* ========================================================================= */}
              {displayedHasDeficiencies && (
                <div
                  style={{
                    background: '#FFFCF5',
                    border: '1px solid #FDE68A',
                    borderRadius: '10px',
                    padding: '0.8rem 1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.6rem'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <AlertTriangle size={18} color="#D97706" />
                    <div>
                      <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#92400E', margin: 0 }}>
                        Active Deficiencies & Retake Priority
                      </h4>
                      <div style={{ fontSize: '0.72rem', color: '#B45309', marginTop: '0.1rem' }}>
                        These courses were failed or dropped on record. Retakes are required before dependent subjects unlock.
                      </div>
                    </div>
                  </div>

                  {/* Deficiencies Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.5rem' }}>
                    {analysis.activeDeficiencies.map((def, idx) => (
                      <div
                        key={idx}
                        style={{
                          background: '#FFFFFF',
                          borderRadius: '8px',
                          border: '1px solid #FDE68A',
                          padding: '0.6rem 0.75rem',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.25rem'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.82rem', color: '#92400E' }}>
                            {def.code} — {def.title}
                          </span>
                          <span
                            style={{
                              fontSize: '0.65rem',
                              fontWeight: 700,
                              padding: '1px 6px',
                              borderRadius: '5px',
                              background: def.status === 'dropped' ? '#FEF2F2' : '#FEE2E2',
                              color: '#DC2626',
                              border: '1px solid #FECACA'
                            }}
                          >
                            {def.status === 'dropped' ? 'DRP' : `Fail ${def.grade !== null ? def.grade.toFixed(2) : '5.00'}`}
                          </span>
                        </div>

                        <div style={{ fontSize: '0.7rem', color: '#64748B' }}>
                          <span>Term: {def.term} ({def.units}u)</span>
                          {def.attemptCount > 1 && <span> • {def.attemptCount} attempts</span>}
                        </div>

                        {(() => {
                          const cs = curriculumSubjects.find(c => normalizeSubjCode(c.code) === normalizeSubjCode(def.code));
                          const defSem = cs ? Number(cs.semester) : (def.term && /summer/i.test(def.term) ? 3 : def.term && /2nd|second/i.test(def.term) ? 2 : 1);
                          const isCurrentSemOffering = defSem === analysis.targetSemester;
                          const semLabel = defSem === 1 ? '1st Sem' : defSem === 2 ? '2nd Sem' : 'Summer';
                          return (
                            <div style={{
                              fontSize: '0.68rem',
                              color: isCurrentSemOffering ? '#1E40AF' : '#92400E',
                              background: isCurrentSemOffering ? '#EFF6FF' : '#FFFBEB',
                              border: `1px solid ${isCurrentSemOffering ? '#BFDBFE' : '#FDE68A'}`,
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontWeight: 600
                            }}>
                              {isCurrentSemOffering
                                ? `✓ Offered this ${semLabel} (included in recommendations)`
                                : `📅 Offered in ${semLabel} only (retake in next AY ${semLabel})`}
                            </div>
                          );
                        })()}

                        {def.blocksCourses && def.blocksCourses.length > 0 && (
                          <div style={{ fontSize: '0.68rem', color: '#B45309', background: '#FEF3C7', padding: '3px 6px', borderRadius: '5px' }}>
                            ⛔ Blocks: {def.blocksCourses.join(', ')}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ========================================================================= */}
              {/* RECOMMENDED SUBJECTS TABLE CARD                                           */}
              {/* ========================================================================= */}
              <div
                style={{
                  background: '#FFFFFF',
                  borderRadius: '10px',
                  border: '1px solid #E2E8F0',
                  overflow: 'hidden',
                  boxShadow: '0 1px 2px rgba(15, 23, 42, 0.03)'
                }}
              >
                {/* Table Header & Controls Bar */}
                <div
                  style={{
                    padding: '0.9rem 1.25rem',
                    background: '#F8FAFC',
                    borderBottom: '1px solid #E2E8F0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '0.75rem'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '9px',
                        background: '#EFF6FF',
                        border: '1px solid #DBEAFE',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#2563EB'
                      }}
                    >
                      <BookOpen size={20} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0F172A', margin: 0, lineHeight: 1.2 }}>
                        Recommended Subjects
                      </h3>
                      <div style={{ fontSize: '0.85rem', color: '#64748B', marginTop: '0.15rem', fontWeight: 500 }}>
                        {studentInfo.name} • <strong style={{ color: '#0F172A' }}>{currentRecSubjects.length} subjects</strong> in load
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      background: '#EFF6FF',
                      border: '1px solid #DBEAFE',
                      borderRadius: '8px',
                      padding: '6px 14px',
                      fontSize: '0.88rem',
                      fontWeight: 600,
                      color: '#1E40AF'
                    }}
                  >
                    <span>Total Load: <strong style={{ fontSize: '0.94rem', color: '#1D4ED8' }}>{totalRecommendedUnits} Units</strong></span>
                    <span style={{ color: '#93C5FD' }}>•</span>
                    <span style={{ color: '#475569', fontWeight: 600 }}>{totalLecUnits}L / {totalLabUnits}P</span>
                  </div>
                </div>

                {/* Table Contents */}
                {currentRecSubjects.length > 0 ? (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.92rem', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ background: '#F8FAFC', color: '#334155', borderBottom: '2px solid #E2E8F0', fontWeight: 700, fontSize: '0.88rem' }}>
                          <th style={{ padding: '0.85rem 1.15rem' }}>Category</th>
                          <th style={{ padding: '0.85rem 1.15rem' }}>Code</th>
                          <th style={{ padding: '0.85rem 1.15rem' }}>Title</th>
                          <th style={{ padding: '0.85rem 1.15rem', textAlign: 'center' }}>Units</th>
                          <th style={{ padding: '0.85rem 1.15rem' }}>Prerequisites / Remarks</th>
                        </tr>
                      </thead>
                      <tbody>
                        {currentRecSubjects.map((subj, idx) => {
                          const subjNorm = normalizeSubjCode(subj.code);
                          const matchingDef = analysis.activeDeficiencies.find(d => normalizeSubjCode(d.code) === subjNorm);
                          const priorAttempts = studentGrades.filter(g => normalizeSubjCode(g.code) === subjNorm);
                          const hasPriorUnpassed = priorAttempts.some(g => {
                            const isDrop = g.status === 'dropped' || g.isDropped || g.rawGrade === '9' || g.grade === 9 || String(g.rawGrade || '').toUpperCase() === 'DRP';
                            const isZero = g.grade === 0 || Number(g.grade) === 0 || g.rawGrade === '0' || g.rawGrade === '0.0' || String(g.rawGrade || '').trim() === '0';
                            const num = Number(g.grade);
                            return isDrop || isZero || g.status === 'failed' || g.grade === 5 || g.rawGrade === '5' || (!isNaN(num) && num > 3.0);
                          });

                          const isRetake = Boolean(
                            subj.remarks?.toLowerCase().includes('retake') ||
                            subj.prerequisites?.toLowerCase().includes('retake') ||
                            matchingDef ||
                            hasPriorUnpassed
                          );

                          let retakeNotice = '';
                          if (isRetake) {
                            if (matchingDef) {
                              const isDrop = matchingDef.status === 'dropped';
                              const gradeStr = (matchingDef.grade !== null && !isNaN(Number(matchingDef.grade)) && Number(matchingDef.grade) > 0) ? Number(matchingDef.grade).toFixed(2) : '5.00';
                              retakeNotice = isDrop
                                ? `Retake Required (Dropped in ${matchingDef.term})`
                                : `Retake Required (Failed ${gradeStr} in ${matchingDef.term})`;
                            } else if (priorAttempts.length > 0) {
                              const latestPrior = priorAttempts[0];
                              const isPriorDrop = latestPrior.status === 'dropped' || latestPrior.isDropped || latestPrior.rawGrade === '9' || latestPrior.grade === 9;
                              const priorGradeStr = (latestPrior.grade !== null && !isNaN(Number(latestPrior.grade)) && Number(latestPrior.grade) > 0) ? Number(latestPrior.grade).toFixed(2) : '5.00';
                              retakeNotice = isPriorDrop
                                ? `Retake Required (Dropped in ${latestPrior.term || 'previous term'})`
                                : `Retake Required (Previous attempt in ${latestPrior.term || 'previous term'} not passed - ${priorGradeStr})`;
                            } else if (subj.remarks?.toLowerCase().includes('retake')) {
                              retakeNotice = subj.remarks;
                            } else if (subj.prerequisites?.toLowerCase().includes('retake')) {
                              retakeNotice = subj.prerequisites;
                            } else {
                              retakeNotice = 'Retake Required (Previous attempt not passed)';
                            }
                          }

                          return (
                            <tr
                              key={subj.id || idx}
                              style={{
                                borderBottom: '1px solid #F1F5F9',
                                background: isRetake ? '#FFFDF7' : (idx % 2 === 0 ? '#FFFFFF' : '#FAFBFC'),
                                transition: 'background 0.15s ease'
                              }}
                            >
                              <td style={{ padding: '0.9rem 1.15rem' }}>
                                {isRetake ? (
                                  <span
                                    style={{
                                      fontSize: '0.82rem',
                                      fontWeight: 700,
                                      padding: '4px 11px',
                                      borderRadius: '6px',
                                      background: '#FEF3C7',
                                      color: '#B45309',
                                      border: '1px solid #FDE68A',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '0.35rem'
                                    }}
                                  >
                                    <RotateCcw size={13} /> Retake
                                  </span>
                                ) : (
                                  <span
                                    style={{
                                      fontSize: '0.82rem',
                                      fontWeight: 700,
                                      padding: '4px 11px',
                                      borderRadius: '6px',
                                      background: '#EFF6FF',
                                      color: '#1D4ED8',
                                      border: '1px solid #BFDBFE',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '0.35rem'
                                    }}
                                  >
                                    <BookOpen size={13} /> Regular
                                  </span>
                                )}
                              </td>
                              <td style={{ padding: '0.9rem 1.15rem', fontWeight: 800, color: '#1D4ED8', fontSize: '1.02rem' }}>
                                {subj.code}
                              </td>
                              <td style={{ padding: '0.9rem 1.15rem', fontWeight: 700, color: '#0F172A', fontSize: '0.96rem' }}>
                                {subj.title}
                              </td>
                              <td style={{ padding: '0.9rem 1.15rem', textAlign: 'center', fontWeight: 700, color: '#1E293B', fontSize: '0.96rem' }}>
                                {subj.totalUnits} <span style={{ fontSize: '0.82rem', color: '#64748B', fontWeight: 600 }}>({subj.lecUnits}L/{subj.labUnits}P)</span>
                              </td>
                              <td style={{ padding: '0.9rem 1.15rem', fontSize: '0.88rem', lineHeight: 1.4 }}>
                                {isRetake ? (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                    <span
                                      style={{
                                        color: '#B45309',
                                        fontWeight: 700,
                                        fontSize: '0.86rem',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '0.35rem'
                                      }}
                                    >
                                      <AlertTriangle size={13} color="#D97706" style={{ flexShrink: 0 }} />
                                      {retakeNotice}
                                    </span>
                                    {subj.prerequisites && !subj.prerequisites.toLowerCase().includes('retake') && (
                                      <span style={{ fontSize: '0.78rem', color: '#64748B', fontWeight: 500 }}>
                                        {subj.prerequisites}
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span style={{ color: '#475569', fontWeight: 600 }}>
                                    {subj.prerequisites || subj.remarks || 'None required'}
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{ padding: '3rem 1.5rem', textAlign: 'center', color: '#94A3B8', fontSize: '0.95rem' }}>
                    No recommended subjects available for this term. Add a subject from the catalog above.
                  </div>
                )}

                {/* Table Footer */}
                <div
                  style={{
                    padding: '0.85rem 1.25rem',
                    background: '#FAFBFC',
                    borderTop: '1px solid #F1F5F9',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '0.88rem',
                    color: '#475569',
                    fontWeight: 500,
                    flexWrap: 'wrap',
                    gap: '0.5rem'
                  }}
                >
                  <span>
                    Total: <strong style={{ color: '#0F172A', fontSize: '0.92rem' }}>{currentRecSubjects.length} subjects</strong>
                  </span>
                  <span>
                    Load: <strong style={{ color: '#0F172A', fontSize: '0.92rem' }}>{totalRecommendedUnits} Units</strong> ({totalLecUnits}L / {totalLabUnits}P · max 24)
                  </span>
                </div>
              </div>

              {/* ========================================================================= */}
              {/* 6. BLOCKED COURSES NOTICE (IF APPLICABLE)                                  */}
              {/* ========================================================================= */}
              {analysis.blockedSubjects.length > 0 && (
                <div
                  style={{
                    background: '#F8FAFC',
                    border: '1px dashed #CBD5E1',
                    borderRadius: '12px',
                    padding: '1.1rem 1.35rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.6rem'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 800, fontSize: '0.95rem', color: '#334155' }}>
                    <ShieldAlert size={18} color="#64748B" />
                    Curriculum Courses Held Back (Unmet Prerequisites)
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#64748B' }}>
                    The following curriculum courses cannot be enrolled until their prerequisite subjects are cleared by {studentInfo.name}:
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.55rem', marginTop: '0.25rem' }}>
                    {analysis.blockedSubjects.map((b, idx) => (
                      <span
                        key={idx}
                        style={{
                          background: '#FFFFFF',
                          border: '1px solid #E2E8F0',
                          padding: '6px 12px',
                          borderRadius: '7px',
                          fontSize: '0.84rem',
                          color: '#334155'
                        }}
                      >
                        <strong>{b.code}</strong> ({b.title}) — Requires: <span style={{ color: '#DC2626', fontWeight: 700 }}>{b.unmetPrerequisites.join(', ')}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )
        ) : (
          <div
            style={{
              background: 'linear-gradient(135deg, #F8FAFC 0%, #EFF6FF 100%)',
              border: '2px dashed #BFDBFE',
              borderRadius: '14px',
              padding: '3.5rem 2rem',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '1rem'
            }}
          >
            <div
              style={{
                width: '68px',
                height: '68px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFFFFF',
                boxShadow: '0 6px 16px rgba(37, 99, 235, 0.22)'
              }}
            >
              <Search size={28} />
            </div>
            <div>
              <h3 style={{
                fontSize: '1.2rem',
                fontWeight: 800,
                color: '#1E3A8A',
                margin: 0,
                marginBottom: '0.35rem'
              }}>
                Search for Student
              </h3>
              <p style={{
                fontSize: '0.8rem',
                color: '#64748B',
                margin: 0,
                maxWidth: '460px',
                lineHeight: 1.5
              }}>
                Use the search bar above to find a student by name, ID, or program.
                Once selected, you'll see their academic standing, prerequisite validation,
                and recommended subject catalog for the current term.
              </p>
            </div>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              marginTop: '0.3rem',
              padding: '0.4rem 0.85rem',
              background: '#FFFFFF',
              border: '1px solid #BFDBFE',
              borderRadius: '8px',
              fontSize: '0.72rem',
              color: '#1D4ED8',
              fontWeight: 600
            }}>
              <Sparkles size={13} /> Tip: Filter by Deficient or Regular status to prioritize students
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 7. ADD SUBJECT FROM CATALOG MODAL                                         */}
      {/* ========================================================================= */}
      {showAddSubjectRecModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem'
          }}
        >
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: '16px',
              border: '1px solid #E2E8F0',
              padding: '1.5rem',
              width: '100%',
              maxWidth: '520px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                  Add Subject Recommendation
                </h3>
                <span style={{ fontSize: '0.76rem', color: '#64748B' }}>
                  Assign a course from the curriculum catalog for {studentInfo.name}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowAddSubjectRecModal(false)}
                style={{ background: 'none', border: 'none', color: '#94A3B8', fontSize: '1.2rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveAddSubjectRecommendation} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '0.35rem' }}>
                  Select Course from Catalog ({studentInfo.program}):
                </label>
                <select
                  value={addRecSelectedCatalogId}
                  onChange={e => setAddRecSelectedCatalogId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '0.84rem',
                    outline: 'none'
                  }}
                >
                  {curriculumSubjects
                    .filter(cs => cs.program === studentInfo.program)
                    .map(cs => (
                      <option key={cs.id} value={cs.id}>
                        {cs.code} — {cs.title} ({cs.units} Units • Year {cs.year_level} Sem {cs.semester})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '0.35rem' }}>
                  Recommendation Remark / Classification:
                </label>
                <select
                  value={addRecRemark}
                  onChange={e => setAddRecRemark(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '0.84rem',
                    outline: 'none'
                  }}
                >
                  <option value="Regular Track Subject">Regular Track Subject</option>
                  <option value="Retake Required (Prerequisite Backlog)">Retake Required (Prerequisite Backlog)</option>
                  <option value="Approved Overload Subject">Approved Overload Subject</option>
                  <option value="Elective Subject">Elective Subject</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowAddSubjectRecModal(false)}
                  style={{
                    padding: '0.55rem 1rem',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    background: '#FFFFFF',
                    color: '#64748B',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '0.55rem 1.15rem',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#2563EB',
                    color: '#FFFFFF',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 2px 6px rgba(37, 99, 235, 0.25)'
                  }}
                >
                  Add Subject
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default RecommendationsModule;
