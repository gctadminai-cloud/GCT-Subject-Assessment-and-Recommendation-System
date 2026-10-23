import React, { createContext, useContext, useState, useMemo, useEffect } from 'react';
import { useUI } from '../context/UIContext';
import { fetchApi } from '../config/api';
import type {
  Student,
  AcademicGrade,
  CurriculumSubject,
  StudentRecommendationRecord,
  StaffAccount,
  CsvPreviewRow,
  OcrDetectedRow,
  ProgramInfo
} from './types';
import {
  INITIAL_CURRICULUM_SUBJECTS,
  INITIAL_STUDENT_RECOMMENDATIONS,
  INITIAL_STAFF_ACCOUNTS,
  INITIAL_CSV_PREVIEW_ROWS,
  INITIAL_OCR_DETECTED_ROWS,
  PROGRAM_CATALOG
} from './mockData';
import { generateCurriculumRecommendations } from '../utils/curriculumData';

interface RegistrarDataContextType {
  // Datasets & Setters
  mockStudents: Student[];
  setMockStudents: React.Dispatch<React.SetStateAction<Student[]>>;
  refreshStudents: () => Promise<void>;
  mockAcademicGrades: AcademicGrade[];
  setMockAcademicGrades: React.Dispatch<React.SetStateAction<AcademicGrade[]>>;
  refreshAcademicGrades: (overrideAy?: string | 'all') => Promise<void>;
  fetchStudentGrades: (studentId: string) => Promise<AcademicGrade[]>;
  curriculumSubjects: CurriculumSubject[];
  setCurriculumSubjects: React.Dispatch<React.SetStateAction<CurriculumSubject[]>>;
  refreshSubjects: () => Promise<void>;
  studentRecommendations: StudentRecommendationRecord[];
  setStudentRecommendations: React.Dispatch<React.SetStateAction<StudentRecommendationRecord[]>>;
  refreshRecommendations: () => Promise<void>;
  staffAccounts: StaffAccount[];
  setStaffAccounts: React.Dispatch<React.SetStateAction<StaffAccount[]>>;
  refreshStaffAccounts: () => Promise<void>;
  refreshSettings: () => Promise<void>;
  csvPreviewRows: CsvPreviewRow[];
  setCsvPreviewRows: React.Dispatch<React.SetStateAction<CsvPreviewRow[]>>;
  ocrDetectedRows: OcrDetectedRow[];
  setOcrDetectedRows: React.Dispatch<React.SetStateAction<OcrDetectedRow[]>>;

  // Settings
  passingThreshold: string;
  setPassingThreshold: React.Dispatch<React.SetStateAction<string>>;
  maxFailedPrereqs: string;
  setMaxFailedPrereqs: React.Dispatch<React.SetStateAction<string>>;
  activeAcademicYear: string;
  setActiveAcademicYear: React.Dispatch<React.SetStateAction<string>>;
  activeSemesterSetting: string;
  setActiveSemesterSetting: React.Dispatch<React.SetStateAction<string>>;

  // Extended Institutional & Academic Policy Settings
  maxRegularUnits: string;
  setMaxRegularUnits: React.Dispatch<React.SetStateAction<string>>;
  maxOverloadUnits: string;
  setMaxOverloadUnits: React.Dispatch<React.SetStateAction<string>>;
  maxProbationUnits: string;
  setMaxProbationUnits: React.Dispatch<React.SetStateAction<string>>;
  deansListGwaCutoff: string;
  setDeansListGwaCutoff: React.Dispatch<React.SetStateAction<string>>;
  maxRetakesAllowed: string;
  setMaxRetakesAllowed: React.Dispatch<React.SetStateAction<string>>;
  enrollmentStartDate: string;
  setEnrollmentStartDate: React.Dispatch<React.SetStateAction<string>>;
  enrollmentEndDate: string;
  setEnrollmentEndDate: React.Dispatch<React.SetStateAction<string>>;
  gradeEncodingDeadline: string;
  setGradeEncodingDeadline: React.Dispatch<React.SetStateAction<string>>;
  isGradeEncodingLocked: boolean;
  setIsGradeEncodingLocked: React.Dispatch<React.SetStateAction<boolean>>;
  prereqCheckMode: 'strict' | 'advisory';
  setPrereqCheckMode: React.Dispatch<React.SetStateAction<'strict' | 'advisory'>>;
  autoApproveRegularTrack: boolean;
  setAutoApproveRegularTrack: React.Dispatch<React.SetStateAction<boolean>>;
  maxIrregularRecSubjects: string;
  setMaxIrregularRecSubjects: React.Dispatch<React.SetStateAction<string>>;
  recPriorityStrategy: 'backlog_first' | 'regular_track' | 'balanced';
  setRecPriorityStrategy: React.Dispatch<React.SetStateAction<'backlog_first' | 'regular_track' | 'balanced'>>;
  institutionName: string;
  setInstitutionName: React.Dispatch<React.SetStateAction<string>>;
  registrarSignatoryName: string;
  setRegistrarSignatoryName: React.Dispatch<React.SetStateAction<string>>;
  auditLogRetention: string;
  setAuditLogRetention: React.Dispatch<React.SetStateAction<string>>;

  // Computed & Joined Datasets
  joinedGradeRecords: (AcademicGrade & { course: string; schedule: string })[];

  // Constants & Global UI
  PROGRAM_CATALOG: ProgramInfo[];
  showToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;

  // Academic Year Management
  academicYears: string[];
  setAcademicYears: React.Dispatch<React.SetStateAction<string[]>>;
  selectedAcademicYear: string | 'all';
  setSelectedAcademicYear: React.Dispatch<React.SetStateAction<string | 'all'>>;
  refreshAcademicYears: () => Promise<void>;
  addAcademicYear: (ay: string, setAsActive?: boolean) => Promise<boolean>;
  setSelectedAcademicYearExternal: (ay: string | 'all') => Promise<void>;

  // Helpers
  getOrInitStudentRecommendation: (studentId: string) => StudentRecommendationRecord;
  handleApproveSubject: (studentId: string, subjectItemId: string) => void;
  handleDeleteSubject: (studentId: string, subjectItemId: string) => void;

  // Schedule Management
  courseSchedules: Record<string, string[]>;
  getSchedules: (courseCode: string, yearLevel: number) => string[];
  addSchedule: (courseCode: string, yearLevel: number, customName?: string) => string;
  deleteSchedule: (courseCode: string, yearLevel: number, scheduleName: string) => boolean;
}

export function detectCurrentSemester(): '1' | '2' | 'summer' {
  const month = new Date().getMonth(); // 0 = Jan, 11 = Dec
  // In Philippine college calendars (e.g. GCT):
  // 2nd Semester: January (0) to June (5)
  // 1st Semester: July (6) to December (11)
  return (month >= 0 && month <= 5) ? '2' : '1';
}

const RegistrarDataContext = createContext<RegistrarDataContextType | undefined>(undefined);

export const RegistrarDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { showToast } = useUI();

  const [mockStudents, setMockStudents] = useState<Student[]>([]);

  // Synchronize live student registrations from backend database
  const refreshStudents = async () => {
    try {
      const data = await fetchApi('/students');
      if (Array.isArray(data)) {
        const liveStudents: Student[] = data.map((st: any) => ({
          id: st.id || `s-${st.student_id}`,
          student_id: st.student_id,
          name: st.full_name || st.profiles?.full_name || st.name || 'Student',
          email: st.email || st.profiles?.email || '',
          program: st.program || 'BSIT',
          year: Number(st.year_level || 1),
          section: st.section || 'A',
          schedule: st.schedule || 'Schedule 1',
          status: (st.profiles?.approval_status === 'pending' || st.status === 'pending') ? 'pending' : (st.profiles?.approval_status || st.status || 'approved'),
          id_front_image: st.id_front_image || undefined,
          id_back_image: st.id_back_image || undefined,
          selfie_image: st.selfie_image || undefined,
          created_at: st.created_at || st.profiles?.created_at,
          has_account: Boolean(st.has_account),
          has_deficiencies: Boolean(st.has_deficiencies ?? st.hasDeficiencies),
          hasDeficiencies: Boolean(st.has_deficiencies ?? st.hasDeficiencies),
          deficiency_count: Number(st.deficiency_count ?? st.deficiencyCount ?? 0),
          deficiencyCount: Number(st.deficiency_count ?? st.deficiencyCount ?? 0)
        }));

        setMockStudents(liveStudents);
      }
    } catch (err) {
      console.warn('Live students sync fallback:', err);
      setMockStudents(prev => prev.length > 0 ? prev : []);
    }
  };

  const refreshSubjects = async () => {
    try {
      const data = await fetchApi('/curriculum/subjects');
      if (Array.isArray(data) && data.length > 0) {
        let prereqsMap: Record<string, string[]> = {};
        try {
          const prereqData = await fetchApi('/curriculum/prerequisites');
          if (Array.isArray(prereqData)) {
            prereqData.forEach((p: any) => {
              if (p.subject_id && (p.prerequisite?.code || p.prerequisite_subject_id)) {
                if (!prereqsMap[p.subject_id]) prereqsMap[p.subject_id] = [];
                prereqsMap[p.subject_id].push(p.prerequisite?.code || p.prerequisite_subject_id);
              }
            });
          }
        } catch (e) { }

        const liveSubjects: CurriculumSubject[] = data.map((s: any) => ({
          id: s.id,
          code: s.code,
          title: s.title,
          units: Number(s.units || 3),
          lecUnits: Number(s.lec_units || Math.max(1, Number(s.units || 3) - 1)),
          labUnits: Number(s.lab_units || (Number(s.units || 3) > 2 ? 1 : 0)),
          prerequisites: prereqsMap[s.id]?.join(', ') || s.prerequisites || 'None',
          program: s.program || 'BSIT',
          year_level: Number(s.year_level || 1),
          semester: Number(s.semester || 1)
        }));
        setCurriculumSubjects(liveSubjects);
      }
    } catch (err) {
      console.warn('Live subjects sync fallback:', err);
      setCurriculumSubjects(prev => prev.length > 0 ? prev : INITIAL_CURRICULUM_SUBJECTS);
    }
  };

  const refreshAcademicGrades = async (overrideAy?: string | 'all') => {
    const ayScope = overrideAy !== undefined ? overrideAy : selectedAcademicYear;
    try {
      const data = await fetchApi(`/academic-records${ayScope !== 'all' ? '?academic_year=' + encodeURIComponent(ayScope) : ''}`);
      if (Array.isArray(data)) {
        const liveGrades: AcademicGrade[] = data.map((r: any) => {
          const isDropped = Boolean(r.is_dropped || r.status === 'dropped' || String(r.raw_grade) === '9' || String(r.raw_grade).toUpperCase() === 'DRP');
          const isFailed = !isDropped && (r.status === 'failed' || Number(r.grade) > 3.0 || Number(r.grade) === 5.0 || String(r.raw_grade) === '5');
          const num = (!isDropped && r.grade !== null && r.grade !== undefined && !isNaN(Number(r.grade))) ? Number(r.grade) : null;
          let status: 'passed' | 'failed' | 'dropped' = 'passed';
          if (isDropped) status = 'dropped';
          else if (isFailed) status = 'failed';
          else status = 'passed';

          return {
            id: r.id || `rec-${Math.random()}`,
            studentId: r.student_id,
            studentName: r.studentName || 'Student',
            code: r.subject?.code || r.subject_code || r.code || 'SUBJ101',
            title: r.subject?.title || r.subject_title || r.title || r.subjectTitle || 'Subject Course',
            grade: isDropped ? null : num,
            rawGrade: r.raw_grade,
            status,
            isDropped,
            term: r.term || '2024-2025 1st Sem',
            units: Number(r.subject?.units || r.units || 3),
            yearLevel: Number(r.subject?.year_level || r.year_level || 1)
          };
        });

        if (ayScope === 'all') {
          // Direct sync with database: completely replace state so deleted records are never preserved
          setMockAcademicGrades(liveGrades);
        } else {
          setMockAcademicGrades(prev => {
            const others = prev.filter(g => {
              const gAy = g.academicYear || (g.term ? g.term.split(' ')[0] : '');
              return gAy.toLowerCase() !== String(ayScope).toLowerCase();
            });
            return [...others, ...liveGrades];
          });
        }
      }
    } catch (err) {
      console.warn('Live academic grades sync fallback:', err);
    }
  };

  const fetchStudentGrades = async (studentId: string): Promise<AcademicGrade[]> => {
    try {
      const url = `/academic-records?student_id=${encodeURIComponent(studentId)}`;
      const data = await fetchApi(url);
      if (Array.isArray(data)) {
        const liveList: AcademicGrade[] = data.map((r: any) => {
          const isDropped = Boolean(r.is_dropped || r.status === 'dropped' || String(r.raw_grade) === '9' || String(r.raw_grade).toUpperCase() === 'DRP');
          const isFailed = !isDropped && (r.status === 'failed' || Number(r.grade) > 3.0 || Number(r.grade) === 5.0 || String(r.raw_grade) === '5');
          const num = (!isDropped && r.grade !== null && r.grade !== undefined && !isNaN(Number(r.grade))) ? Number(r.grade) : null;
          let status: 'passed' | 'failed' | 'dropped' = 'passed';
          if (isDropped) status = 'dropped';
          else if (isFailed) status = 'failed';
          else status = 'passed';

          return {
            id: r.id || `rec-${Math.random()}`,
            studentId: r.student_id || studentId,
            studentName: r.studentName || 'Student',
            code: r.subject?.code || r.code || r.subject_id,
            title: r.subject?.title || r.title || r.subject_id,
            units: Number(r.subject?.units || r.units || 3),
            grade: isDropped ? null : num,
            rawGrade: r.raw_grade,
            status,
            isDropped,
            term: r.term || '2023-2024 1st Sem',
            academicYear: r.academic_year || (r.term ? r.term.split(' ')[0] : undefined),
            semester: r.semester || (r.term && r.term.includes('2nd') ? 2 : 1),
            yearLevel: Number(r.subject?.year_level || r.year_level || 1)
          };
        });

        setMockAcademicGrades(prev => {
          const cleanTarget = String(studentId).replace(/^student-/i, '').replace(/^acc-/i, '').replace(/^GCT-/i, '').toLowerCase().trim();
          const others = prev.filter(g => {
            const cleanG = String(g.studentId).replace(/^student-/i, '').replace(/^acc-/i, '').replace(/^GCT-/i, '').toLowerCase().trim();
            return cleanG !== cleanTarget;
          });
          return [...others, ...liveList];
        });

        return liveList;
      }
    } catch (err) {
      console.warn(`Failed to fetch grades for student ${studentId}:`, err);
    }
    return [];
  };

  const refreshStaffAccounts = async () => {
    try {
      const data = await fetchApi('/staff-accounts');
      if (Array.isArray(data)) {
        const liveStaff: StaffAccount[] = data.map((st: any) => ({
          id: st.id,
          username: st.username,
          name: st.full_name || st.name || 'Staff User',
          email: st.email,
          role: st.role === 'registrar_admin' ? 'registrar_admin' : 'registrar_staff',
          status: st.status || 'active',
          department: st.department || 'Registrar Office',
          createdDate: st.created_at ? new Date(st.created_at).toLocaleDateString() : '2024-01-15',
          created_at: st.created_at
        }));
        setStaffAccounts(liveStaff);
      }
    } catch (err) {
      console.warn('Live staff accounts sync fallback:', err);
      setStaffAccounts(prev => prev.length > 0 ? prev : INITIAL_STAFF_ACCOUNTS);
    }
  };

  const refreshRecommendations = async () => {
    try {
      const data = await fetchApi('/recommendations');
      if (Array.isArray(data) && data.length > 0) {
        const liveRecs: StudentRecommendationRecord[] = data.map((rec: any) => {
          let rawSubjs = rec.generated_subjects;
          if (typeof rawSubjs === 'string') {
            try { rawSubjs = JSON.parse(rawSubjs); } catch (e) { rawSubjs = []; }
          }
          if (!Array.isArray(rawSubjs)) rawSubjs = [];

          return {
            studentId: rec.students?.student_id || rec.student_id,
            studentName: rec.students?.profiles?.full_name || 'Student',
            program: rec.students?.program || 'BSIT',
            yearLevel: Number(rec.students?.year_level || 1),
            section: rec.students?.section || 'A',
            schedule: rec.students?.schedule || 'Schedule 1',
            subjects: rawSubjs.map((sub: any, idx: number) => ({
              id: sub.id || `rec-sub-${idx}`,
              code: sub.code || 'SUBJ',
              title: sub.title || 'Course Title',
              lecUnits: Number(sub.lecUnits || (Number(sub.units || 3) > 2 ? Number(sub.units || 3) - 1 : Number(sub.units || 3))),
              labUnits: Number(sub.labUnits || (Number(sub.units || 3) > 2 ? 1 : 0)),
              totalUnits: Number(sub.units || sub.totalUnits || 3),
              prerequisites: sub.prerequisites || 'None',
              isApproved: rec.status === 'approved' || sub.isApproved === true,
              remarks: sub.remarks || sub.notes || 'Curriculum Recommendation'
            }))
          };
        });
        setStudentRecommendations(liveRecs);
      }
    } catch (err) {
      console.warn('Live recommendations sync fallback:', err);
      setStudentRecommendations(prev => prev.length > 0 ? prev : INITIAL_STUDENT_RECOMMENDATIONS);
    }
  };

  const refreshSettings = async () => {
    try {
      const data = await fetchApi('/settings');
      if (Array.isArray(data) && data.length > 0) {
        data.forEach((s: any) => {
          if (s.key === 'passingThreshold' || s.key === 'passing_threshold') setPassingThreshold(String(s.value));
          if (s.key === 'maxFailedPrereqs' || s.key === 'max_failed_prereqs') setMaxFailedPrereqs(String(s.value));
          if (s.key === 'activeAcademicYear' || s.key === 'active_academic_year') setActiveAcademicYear(String(s.value));
          if (s.key === 'activeSemester' || s.key === 'active_semester') setActiveSemesterSetting(String(s.value));
        });
      }
    } catch (err) {
      console.warn('Live settings sync fallback:', err);
    }
  };

  useEffect(() => {
    refreshStudents();
    refreshSubjects();
    refreshAcademicGrades('all');
    refreshStaffAccounts();
    refreshRecommendations();
    refreshSettings();
    refreshAcademicYears();
  }, []);
  const [mockAcademicGrades, setMockAcademicGrades] = useState<AcademicGrade[]>([]);
  const [curriculumSubjects, setCurriculumSubjects] = useState<CurriculumSubject[]>(INITIAL_CURRICULUM_SUBJECTS);
  const [studentRecommendations, setStudentRecommendations] = useState<StudentRecommendationRecord[]>(INITIAL_STUDENT_RECOMMENDATIONS);
  const [staffAccounts, setStaffAccounts] = useState<StaffAccount[]>(INITIAL_STAFF_ACCOUNTS);
  const [csvPreviewRows, setCsvPreviewRows] = useState<CsvPreviewRow[]>(INITIAL_CSV_PREVIEW_ROWS);
  const [ocrDetectedRows, setOcrDetectedRows] = useState<OcrDetectedRow[]>(INITIAL_OCR_DETECTED_ROWS);

  // Core & Extended Settings State
  const [passingThreshold, setPassingThreshold] = useState('50');
  const [maxFailedPrereqs, setMaxFailedPrereqs] = useState('3');
  const [activeAcademicYear, setActiveAcademicYear] = useState('2027-2028');
  const [activeSemesterSetting, setActiveSemesterSetting] = useState<string>(() => detectCurrentSemester());

  const [maxRegularUnits, setMaxRegularUnits] = useState('24');
  const [maxOverloadUnits, setMaxOverloadUnits] = useState('27');
  const [maxProbationUnits, setMaxProbationUnits] = useState('18');
  const [deansListGwaCutoff, setDeansListGwaCutoff] = useState('1.75');
  const [maxRetakesAllowed, setMaxRetakesAllowed] = useState('2');
  const [enrollmentStartDate, setEnrollmentStartDate] = useState('2025-08-01');
  const [enrollmentEndDate, setEnrollmentEndDate] = useState('2025-08-25');
  const [gradeEncodingDeadline, setGradeEncodingDeadline] = useState('2025-10-30');
  const [isGradeEncodingLocked, setIsGradeEncodingLocked] = useState(false);
  const [prereqCheckMode, setPrereqCheckMode] = useState<'strict' | 'advisory'>('strict');
  const [autoApproveRegularTrack, setAutoApproveRegularTrack] = useState(true);
  const [maxIrregularRecSubjects, setMaxIrregularRecSubjects] = useState('8');
  const [recPriorityStrategy, setRecPriorityStrategy] = useState<'backlog_first' | 'regular_track' | 'balanced'>('backlog_first');
  const [institutionName, setInstitutionName] = useState('Garcia College of Technology');
  const [registrarSignatoryName, setRegistrarSignatoryName] = useState('System Administrator, Office of the Registrar');
  const [auditLogRetention, setAuditLogRetention] = useState('90_days');

  // Academic Year Management State
  const [academicYears, setAcademicYears] = useState<string[]>(['2027-2028', '2026-2027', '2025-2026', '2024-2025', '2023-2024']);
  const [selectedAcademicYear, setSelectedAcademicYear] = useState<string | 'all'>('all');

  // Fast O(1) indexed map of students to avoid O(N x M) nested array searches
  const studentMap = useMemo(() => {
    const map = new Map<string, Student>();
    for (const s of mockStudents) {
      if (!s) continue;
      if (s.student_id) {
        const sid = String(s.student_id).toLowerCase().trim();
        map.set(sid, s);
        map.set(sid.replace(/^gct-/i, ''), s);
      }
      if (s.id) {
        const idStr = String(s.id).toLowerCase().trim();
        map.set(idStr, s);
        map.set(idStr.replace(/^gct-/i, ''), s);
      }
    }
    return map;
  }, [mockStudents]);

  // Joined Grade Records (Academic Records)
  const joinedGradeRecords = useMemo(() => {
    return mockAcademicGrades.map(g => {
      const sid = String(g.studentId || '').toLowerCase().trim();
      const student = studentMap.get(sid) || studentMap.get(sid.replace(/^gct-/i, ''));
      const course = student?.program || (g.code && g.code.startsWith('CS') ? 'BSCS' : 'BSIT');
      const yearLevel = g.yearLevel || student?.year || 1;
      const schedule = student?.schedule || 'Schedule 1';
      return {
        ...g,
        studentName: g.studentName || student?.name || 'Unknown Student',
        course,
        yearLevel,
        schedule
      };
    });
  }, [mockAcademicGrades, studentMap]);

  // Recommendation Helper
  const getOrInitStudentRecommendation = (studentId: string): StudentRecommendationRecord => {
    const existing = studentRecommendations.find(r => r.studentId === studentId);
    if (existing) return existing;

    const student = mockStudents.find(s => s.student_id === studentId || s.id === studentId);
    if (!student) {
      return {
        studentId,
        studentName: 'Student',
        program: 'BSIT',
        yearLevel: 1,
        section: 'A',
        schedule: 'Schedule 1',
        subjects: []
      };
    }

    const studentGrades = mockAcademicGrades.filter(g =>
      g.studentId?.toLowerCase() === studentId.toLowerCase() ||
      g.studentId?.toLowerCase() === student.student_id?.toLowerCase() ||
      g.studentId?.toLowerCase() === student.id?.toLowerCase()
    );

    const analysis = generateCurriculumRecommendations(student, studentGrades, curriculumSubjects);

    return {
      studentId: student.student_id,
      studentName: student.name,
      program: student.program,
      yearLevel: student.year,
      section: student.section || 'A',
      schedule: student.schedule || 'Schedule 1',
      subjects: analysis.recommendedSubjects
    };
  };

  const handleApproveSubject = (studentId: string, subjectItemId: string) => {
    setStudentRecommendations(prev => {
      const rec = prev.find(r => r.studentId === studentId);
      if (!rec) {
        const newRec = getOrInitStudentRecommendation(studentId);
        newRec.subjects = newRec.subjects.map(s => s.id === subjectItemId ? { ...s, isApproved: true } : s);
        return [newRec, ...prev];
      }
      return prev.map(r => {
        if (r.studentId === studentId) {
          return {
            ...r,
            subjects: r.subjects.map(s => s.id === subjectItemId ? { ...s, isApproved: true } : s)
          };
        }
        return r;
      });
    });
    showToast('Subject recommendation approved successfully!', 'success');
  };

  const handleDeleteSubject = (studentId: string, subjectItemId: string) => {
    setStudentRecommendations(prev => {
      const rec = prev.find(r => r.studentId === studentId);
      if (!rec) {
        const newRec = getOrInitStudentRecommendation(studentId);
        newRec.subjects = newRec.subjects.filter(s => s.id !== subjectItemId);
        return [newRec, ...prev];
      }
      return prev.map(r => {
        if (r.studentId === studentId) {
          return {
            ...r,
            subjects: r.subjects.filter(s => s.id !== subjectItemId)
          };
        }
        return r;
      });
    });
    showToast('Subject removed from recommendation list!', 'info');
  };

  // ===== Academic Year Management Functions =====
  const refreshAcademicYears = async () => {
    try {
      const data = await fetchApi('/settings/academic-years');
      if (data && Array.isArray(data.academicYears) && data.academicYears.length > 0) {
        const sorted: string[] = Array.from(new Set(data.academicYears)).map(x => String(x)).sort((a, b) => {
          const yA = parseInt(String(a).split('-')[0] || '0', 10);
          const yB = parseInt(String(b).split('-')[0] || '0', 10);
          return yB - yA;
        });
        setAcademicYears(sorted);
      }
      if (data && data.activeAcademicYear) {
        setActiveAcademicYear(String(data.activeAcademicYear));
      }
    } catch (err) {
      console.warn('Failed to refresh academic years from API, using defaults:', err);
    }
  };

  const addAcademicYear = async (ay: string, setAsActive: boolean = true): Promise<boolean> => {
    try {
      const body: any = { academic_year: ay };
      if (setAsActive) body.setAsActive = true;
      const result = await fetchApi('/settings/academic-years', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (result) {
        setAcademicYears(prev => {
          const set = new Set([ay, ...prev]);
          return [...set].sort((a, b) => parseInt(String(b).split('-')[0], 10) - parseInt(String(a).split('-')[0], 10));
        });
        if (setAsActive) {
          setActiveAcademicYear(ay);
        }
        showToast(`Academic Year ${ay} added successfully!`, 'success');
        return true;
      }
      return false;
    } catch (err: any) {
      console.error('Failed to add academic year:', err);
      showToast(err?.message || 'Failed to add academic year. Check format or permissions.', 'error');
      return false;
    }
  };

  const setSelectedAcademicYearExternal = async (ay: string | 'all') => {
    setSelectedAcademicYear(ay);
    try {
      await refreshAcademicGrades(ay);
      await refreshRecommendations();
    } catch (e) { }
  };

  // Schedule Management
  const [courseSchedules, setCourseSchedules] = useState<Record<string, string[]>>({});

  const getSchedules = (courseCode: string, yearLevel: number): string[] => {
    const key = `${courseCode}-${yearLevel}`;
    return courseSchedules[key] || ['Schedule 1', 'Schedule 2', 'Schedule 3'];
  };

  const addSchedule = (courseCode: string, yearLevel: number, customName?: string): string => {
    const key = `${courseCode}-${yearLevel}`;
    const currentList = getSchedules(courseCode, yearLevel);
    let newName = customName?.trim();
    if (!newName) {
      let nextNum = 1;
      while (currentList.includes(`Schedule ${nextNum}`)) {
        nextNum++;
      }
      newName = `Schedule ${nextNum}`;
    } else {
      if (currentList.includes(newName)) {
        showToast(`Schedule "${newName}" already exists for ${courseCode} Year ${yearLevel}.`, 'warning');
        return newName;
      }
    }

    setCourseSchedules(prev => ({
      ...prev,
      [key]: [...(prev[key] || ['Schedule 1', 'Schedule 2', 'Schedule 3']), newName]
    }));

    showToast(`Added ${newName} to ${courseCode} Year ${yearLevel}.`, 'success');
    return newName;
  };

  const deleteSchedule = (courseCode: string, yearLevel: number, scheduleName: string): boolean => {
    const enrolledStudents = mockStudents.filter(s =>
      s.program === courseCode &&
      s.year === yearLevel &&
      (s.schedule === scheduleName || (!s.schedule && scheduleName === 'Schedule 1'))
    );

    if (enrolledStudents.length > 0) {
      showToast(`Cannot delete ${scheduleName}: ${enrolledStudents.length} student(s) currently enrolled.`, 'error');
      return false;
    }

    const key = `${courseCode}-${yearLevel}`;
    const currentList = getSchedules(courseCode, yearLevel);
    const updatedList = currentList.filter(s => s !== scheduleName);

    setCourseSchedules(prev => ({
      ...prev,
      [key]: updatedList
    }));

    showToast(`Deleted ${scheduleName} from ${courseCode} Year ${yearLevel}.`, 'info');
    return true;
  };

  const value = {
    mockStudents,
    setMockStudents,
    mockAcademicGrades,
    setMockAcademicGrades,
    curriculumSubjects,
    setCurriculumSubjects,
    studentRecommendations,
    setStudentRecommendations,
    staffAccounts,
    setStaffAccounts,
    csvPreviewRows,
    setCsvPreviewRows,
    ocrDetectedRows,
    setOcrDetectedRows,
    passingThreshold,
    setPassingThreshold,
    maxFailedPrereqs,
    setMaxFailedPrereqs,
    activeAcademicYear,
    setActiveAcademicYear,
    activeSemesterSetting,
    setActiveSemesterSetting,
    maxRegularUnits,
    setMaxRegularUnits,
    maxOverloadUnits,
    setMaxOverloadUnits,
    maxProbationUnits,
    setMaxProbationUnits,
    deansListGwaCutoff,
    setDeansListGwaCutoff,
    maxRetakesAllowed,
    setMaxRetakesAllowed,
    enrollmentStartDate,
    setEnrollmentStartDate,
    enrollmentEndDate,
    setEnrollmentEndDate,
    gradeEncodingDeadline,
    setGradeEncodingDeadline,
    isGradeEncodingLocked,
    setIsGradeEncodingLocked,
    prereqCheckMode,
    setPrereqCheckMode,
    autoApproveRegularTrack,
    setAutoApproveRegularTrack,
    maxIrregularRecSubjects,
    setMaxIrregularRecSubjects,
    recPriorityStrategy,
    setRecPriorityStrategy,
    institutionName,
    setInstitutionName,
    registrarSignatoryName,
    setRegistrarSignatoryName,
    auditLogRetention,
    setAuditLogRetention,
    academicYears,
    setAcademicYears,
    selectedAcademicYear,
    setSelectedAcademicYear,
    joinedGradeRecords,
    PROGRAM_CATALOG,
    showToast,
    getOrInitStudentRecommendation,
    handleApproveSubject,
    handleDeleteSubject,
    courseSchedules,
    getSchedules,
    addSchedule,
    deleteSchedule,
    refreshStudents,
    refreshSubjects,
    refreshAcademicGrades,
    fetchStudentGrades,
    refreshStaffAccounts,
    refreshRecommendations,
    refreshSettings,
    refreshAcademicYears,
    addAcademicYear,
    setSelectedAcademicYearExternal
  };

  return (
    <RegistrarDataContext.Provider value={value}>
      {children}
    </RegistrarDataContext.Provider>
  );
};

export const useRegistrarData = () => {
  const context = useContext(RegistrarDataContext);
  if (!context) {
    throw new Error('useRegistrarData must be used within a RegistrarDataProvider');
  }
  return context;
};

export const useOptionalRegistrarData = () => {
  return useContext(RegistrarDataContext);
};
