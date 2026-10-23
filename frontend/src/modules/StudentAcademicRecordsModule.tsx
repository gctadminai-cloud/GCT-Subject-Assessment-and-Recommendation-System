import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Users,
  BookOpen,
  GraduationCap,
  Search,
  Plus,
  Download,
  Upload,
  AlertTriangle,
  FileSpreadsheet,
  Trash2,
  Pencil,
  X,
  FileCheck,
  Award,
  Calendar,
  History,
  Clock,
  Layers
} from 'lucide-react';
import { useRegistrarData } from './RegistrarDataContext';
import type { Student, AcademicGrade, CsvPreviewRow } from './types';
import { fetchApi } from '../config/api';
import { buildCompleteStudentGrades, sortTermsChronologically, normalizeSubjCode, GCT_CURRICULUM_BSIT, GCT_CURRICULUM_BSCS } from '../utils/curriculumData';
import {
  parseExcelOrCsvFile,
  exportStudentsToExcel,
  exportOfficialAdvisingSlip
} from '../utils/exportUtils';

export interface StudentAcademicRecordsModuleProps {
  initialSubView?: 'directory' | 'grades';
  onOpenUploadModal?: () => void;
  initialStudentId?: string;
  initialSearchQuery?: string;
  initialTargetTerm?: string;
}

export const StudentAcademicRecordsModule: React.FC<StudentAcademicRecordsModuleProps> = ({
  initialSubView: _initialSubView = 'directory',
  initialStudentId = '',
  initialSearchQuery = '',
  initialTargetTerm = ''
}) => {
  const {
    mockStudents,
    setMockStudents,
    mockAcademicGrades,
    setMockAcademicGrades,
    PROGRAM_CATALOG,
    showToast,
    refreshStudents,
    refreshAcademicGrades,
    activeAcademicYear
  } = useRegistrarData();

  // -------------------------------------------------------------
  // STUDENT DIRECTORY & RECORD MANAGEMENT FILTERS
  // -------------------------------------------------------------
  const [studentSearchQuery, setStudentSearchQuery] = useState(initialSearchQuery || initialStudentId || '');
  const [selectedCourseCode, setSelectedCourseCode] = useState<string>('');
  const [selectedYearLevel, setSelectedYearLevel] = useState<string>('');

  // Student CRUD Modals
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [studentModalMode, setStudentModalMode] = useState<'add' | 'edit'>('add');
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [studentFormStudentId, setStudentFormStudentId] = useState('');
  const [studentFormName, setStudentFormName] = useState('');
  const [studentFormProgram, setStudentFormProgram] = useState('BSIT');
  const [studentFormYear, setStudentFormYear] = useState<number>(1);
  const [studentFormSchedule, setStudentFormSchedule] = useState('Schedule 1');

  // Delete Student Modal
  const [showDeleteStudentModal, setShowDeleteStudentModal] = useState(false);
  const [deletingStudent, setDeletingStudent] = useState<Student | null>(null);

  // Grade CRUD Modal
  const [showGradeModal, setShowGradeModal] = useState(false);
  const [gradeModalMode, setGradeModalMode] = useState<'add' | 'edit'>('add');
  const [gradeFormRecordId, setGradeFormRecordId] = useState('');
  const [gradeFormStudentId, setGradeFormStudentId] = useState('');
  const [studentSearchInput, setStudentSearchInput] = useState('');
  const [showStudentSuggestions, setShowStudentSuggestions] = useState(false);
  const [gradeFormCode, setGradeFormCode] = useState('IT 101');
  const [gradeFormTitle, setGradeFormTitle] = useState('Introduction to Computing');
  const [gradeFormUnits, setGradeFormUnits] = useState('3');
  const [gradeFormGrade, setGradeFormGrade] = useState('1.75');
  const [gradeFormTerm, setGradeFormTerm] = useState('2025-2026 1st Sem');

  // Delete Grade Modal
  const [showDeleteGradeModal, setShowDeleteGradeModal] = useState(false);
  const [deletingGradeRecord, setDeletingGradeRecord] = useState<AcademicGrade | null>(null);

  // Student Academic History Modal
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedHistoryStudent, setSelectedHistoryStudent] = useState<Student | null>(null);
  const [activeHistoryTermTab, setActiveHistoryTermTab] = useState<string>('ALL');
  const [historyViewMode, setHistoryViewMode] = useState<'curriculum' | 'chronological'>('curriculum');
  const [loadingHistoryGrades, setLoadingHistoryGrades] = useState(false);
  const [fetchedStudentGrades, setFetchedStudentGrades] = useState<Record<string, AcademicGrade[]>>({});

  // Official Advising Slip Modal
  const [showAdvisingModal, setShowAdvisingModal] = useState(false);
  const [advisingStudent, setAdvisingStudent] = useState<Student | null>(null);

  // Auto-open student record modal when navigating from AI Chatbot
  useEffect(() => {
    const q = initialStudentId || initialSearchQuery;
    if (q) {
      setStudentSearchQuery(q);
      if (initialStudentId && mockStudents.length > 0) {
        const cleanTarget = initialStudentId.replace(/^GCT-/i, '').toLowerCase();
        const found = mockStudents.find(
          s => (s.student_id || '').replace(/^GCT-/i, '').toLowerCase() === cleanTarget ||
            (s.id || '').toLowerCase() === cleanTarget
        );
        if (found) {
          handleOpenStudentHistory(found, initialTargetTerm);
        }
      }
    }
  }, [initialStudentId, initialSearchQuery, initialTargetTerm, mockStudents]);

  // Keep active term tab in sync if initialTargetTerm updates
  useEffect(() => {
    if (initialTargetTerm) {
      setActiveHistoryTermTab(initialTargetTerm);
    }
  }, [initialTargetTerm]);

  // Unified Upload Modal States
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadTargetType, setUploadTargetType] = useState<'students' | 'grades'>('students');
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [isCsvUploaded, setIsCsvUploaded] = useState(false);
  const [isCommittingUpload, setIsCommittingUpload] = useState(false);

  // Parsed Upload Rows
  const [parsedUploadStudents, setParsedUploadStudents] = useState<Array<{ student_id: string; name: string; program: string; year: number }>>([]);
  const [csvPreviewRows, setCsvPreviewRows] = useState<CsvPreviewRow[]>([]);

  // Sort States (Default Alphabetical order A-Z)
  const [studentSortBy, setStudentSortBy] = useState<'name-asc' | 'name-desc' | 'id-asc' | 'id-desc'>('name-asc');

  // Fast O(1) indexed map of student grades to avoid scanning 11,413 items repeatedly
  const gradesByStudentIdMap = useMemo(() => {
    const map = new Map<string, AcademicGrade[]>();
    if (!Array.isArray(mockAcademicGrades)) return map;
    for (const g of mockAcademicGrades) {
      if (!g || !g.studentId) continue;
      const sid = String(g.studentId).toLowerCase().trim();
      const clean = sid.replace(/^gct-/i, '');
      if (!map.has(sid)) map.set(sid, []);
      map.get(sid)!.push(g);
      if (clean !== sid) {
        if (!map.has(clean)) map.set(clean, []);
        map.get(clean)!.push(g);
      }
    }
    return map;
  }, [mockAcademicGrades]);

  // Dynamic standing year computation (checks both year in grades and 2nd sem completion)
  const getStudentStandingYear = useCallback((st?: Student | null): number => {
    if (!st) return 1;
    const sid = st.student_id ? String(st.student_id).toLowerCase().trim() : '';
    if (!sid) return Number(st.year || 1);

    const clean = sid.replace(/^gct-/i, '');
    const stGrades = gradesByStudentIdMap.get(sid) || gradesByStudentIdMap.get(clean) || [];
    const validGrades = stGrades.filter(g => g && g.status !== 'not_taken');
    if (validGrades.length === 0) {
      return Number(st.year || 1);
    }

    // 1. Highest curriculum year taken among valid records
    let maxYear = 1;
    let sem2CountY1 = 0;
    let sem2CountY2 = 0;
    let hasSummerYear3 = false;

    for (const g of validGrades) {
      const y = Number(g.yearLevel || (g as any).year_level);
      if (Number.isFinite(y) && y >= 1 && y <= 4 && y > maxYear) {
        maxYear = y;
      }
      const isSem2 = String(g.semester || '').toLowerCase().includes('second') || String(g.semester) === '2' || Boolean(g.term && /2nd|second/i.test(g.term));
      const isSummer = String(g.semester || '').toLowerCase().includes('summer') || String(g.semester) === '3' || Boolean(g.term && /summer/i.test(g.term));
      if (y === 1 && isSem2) sem2CountY1++;
      if (y === 2 && isSem2) sem2CountY2++;
      if (y === 3 && isSummer) hasSummerYear3 = true;
    }

    let standing = maxYear;
    // Year 1 -> 2: completing 2nd sem of Year 1
    if (sem2CountY1 >= 3) standing = Math.max(standing, 2);
    // Year 2 -> 3: completing 2nd sem of Year 2
    if (sem2CountY2 >= 3) standing = Math.max(standing, 3);
    // Year 3 -> 4: requires completing 3rd Year Summer OR taking Year 4 subjects
    // Completing 3rd Year 2nd Sem keeps the student in 3rd Year because Summer is still required!
    if (hasSummerYear3 || maxYear >= 4) standing = Math.max(standing, 4);

    return Math.min(4, Math.max(1, standing));
  }, [gradesByStudentIdMap]);

  // Pre-index standing year per student to eliminate O(N log N) re-calculations during sort
  const studentStandingYears = useMemo(() => {
    const map = new Map<string, number>();
    if (!Array.isArray(mockStudents)) return map;
    for (const s of mockStudents) {
      if (!s) continue;
      const key = s.student_id || s.id || '';
      map.set(key, getStudentStandingYear(s));
    }
    return map;
  }, [mockStudents, getStudentStandingYear]);

  // Filtered & Sorted Student Directory List
  const filteredStudents = useMemo(() => {
    if (!Array.isArray(mockStudents)) return [];
    let list = [...mockStudents].filter(Boolean);
    if (selectedCourseCode) {
      list = list.filter(s => s && s.program === selectedCourseCode);
    }
    if (selectedYearLevel) {
      const targetYl = Number(selectedYearLevel);
      list = list.filter(s => s && (studentStandingYears.get(s.student_id || s.id || '') ?? 1) === targetYl);
    }
    if (studentSearchQuery.trim()) {
      const q = studentSearchQuery.toLowerCase();
      list = list.filter(s =>
        s && (
          (s.student_id || '').toLowerCase().includes(q) ||
          (s.name || '').toLowerCase().includes(q) ||
          (s.email || '').toLowerCase().includes(q)
        )
      );
    }

    list.sort((a, b) => {
      if (!a || !b) return 0;
      const nameA = a.name || '';
      const nameB = b.name || '';
      const idA = a.student_id || '';
      const idB = b.student_id || '';
      const yrA = studentStandingYears.get(a.student_id || a.id || '') ?? 1;
      const yrB = studentStandingYears.get(b.student_id || b.id || '') ?? 1;
      if (studentSortBy === 'name-asc') {
        if (yrA !== yrB) return yrA - yrB;
        return nameA.localeCompare(nameB);
      }
      if (studentSortBy === 'name-desc') {
        if (yrA !== yrB) return yrB - yrA;
        return nameB.localeCompare(nameA);
      }
      if (studentSortBy === 'id-asc') return idA.localeCompare(idB);
      if (studentSortBy === 'id-desc') return idB.localeCompare(idA);
      return nameA.localeCompare(nameB);
    });

    return list;
  }, [mockStudents, selectedCourseCode, selectedYearLevel, studentSearchQuery, studentSortBy, studentStandingYears]);

  // Directory Pagination
  const [studentPage, setStudentPage] = useState<number>(1);
  const [studentPageSize, setStudentPageSize] = useState<number>(20);

  useEffect(() => {
    setStudentPage(1);
  }, [selectedCourseCode, selectedYearLevel, studentSearchQuery]);

  const totalStudentPages = Math.max(1, Math.ceil(filteredStudents.length / studentPageSize));
  const safeStudentPage = Math.min(Math.max(1, studentPage), totalStudentPages);
  const paginatedStudents = useMemo(() => {
    const start = (safeStudentPage - 1) * studentPageSize;
    return filteredStudents.slice(start, start + studentPageSize);
  }, [filteredStudents, safeStudentPage, studentPageSize]);

  // -------------------------------------------------------------
  // STUDENT CRUD ACTIONS
  // -------------------------------------------------------------
  const handleOpenAddStudentModal = () => {
    setStudentModalMode('add');
    setStudentFormStudentId(`GCT-2026-00${mockStudents.length + 1}`);
    setStudentFormName('');
    setStudentFormProgram(selectedCourseCode || 'BSIT');
    setStudentFormYear(Number(selectedYearLevel) || 1);
    setStudentFormSchedule('Schedule 1');
    setShowStudentModal(true);
  };

  const handleOpenEditStudentModal = (st: Student) => {
    setStudentModalMode('edit');
    setEditingStudentId(st.id);
    setStudentFormStudentId(st.student_id);
    setStudentFormName(st.name);
    setStudentFormProgram(st.program);
    setStudentFormYear(st.year);
    setStudentFormSchedule(st.schedule || 'Schedule 1');
    setShowStudentModal(true);
  };

  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentFormStudentId.trim() || !studentFormName.trim()) {
      showToast('Student ID and Full Name are required!', 'error');
      return;
    }

    const trimmedId = studentFormStudentId.trim();
    const trimmedName = studentFormName.trim();
    const yearNum = Number(studentFormYear) || 1;

    try {
      if (studentModalMode === 'add') {
        const newStudent: Student = {
          id: `s-${Date.now()}`,
          student_id: trimmedId,
          name: trimmedName,
          email: `${trimmedId.toLowerCase().replace(/[^a-z0-9]/g, '')}@gct.edu.ph`,
          program: studentFormProgram,
          year: yearNum,
          section: 'A',
          schedule: studentFormSchedule,
          status: 'approved'
        };
        setMockStudents(prev => [newStudent, ...prev]);

        await fetchApi('/students', {
          method: 'POST',
          body: JSON.stringify({
            student_id: trimmedId,
            full_name: trimmedName,
            program: studentFormProgram,
            year_level: yearNum,
            schedule: studentFormSchedule
          })
        });

        showToast(`Student ${trimmedName} (${trimmedId}) successfully registered in Supabase!`, 'success');
      } else if (editingStudentId) {
        // Optimistically update local list
        setMockStudents(prev => prev.map(s => {
          if (s.id === editingStudentId || s.student_id === trimmedId) {
            return {
              ...s,
              student_id: trimmedId,
              name: trimmedName,
              program: studentFormProgram,
              year: yearNum,
              schedule: studentFormSchedule
            };
          }
          return s;
        }));

        // Immediately update selectedHistoryStudent if currently open so history modal reflects new year level instantly
        setSelectedHistoryStudent(prev => {
          if (prev && (prev.id === editingStudentId || prev.student_id === trimmedId)) {
            return {
              ...prev,
              student_id: trimmedId,
              name: trimmedName,
              program: studentFormProgram,
              year: yearNum,
              schedule: studentFormSchedule
            };
          }
          return prev;
        });

        // Persist directly to Supabase via backend API
        await fetchApi(`/students/${trimmedId || editingStudentId}`, {
          method: 'PUT',
          body: JSON.stringify({
            student_id: trimmedId,
            full_name: trimmedName,
            program: studentFormProgram,
            year_level: yearNum,
            schedule: studentFormSchedule
          })
        });

        showToast(`Student ${trimmedName} updated to Year ${yearNum} in Supabase!`, 'success');
      }

      if (refreshStudents) await refreshStudents();
    } catch (err: any) {
      console.error('Error saving student profile:', err);
      showToast(err.message || 'Failed to update student in Supabase', 'error');
    }

    setShowStudentModal(false);
  };

  const handleConfirmDeleteStudent = async () => {
    if (!deletingStudent) return;
    try {
      await fetchApi(`/students/${deletingStudent.student_id || deletingStudent.id}`, {
        method: 'DELETE'
      });
      setMockStudents(prev => prev.filter(s => s.id !== deletingStudent.id && s.student_id !== deletingStudent.student_id));
      showToast(`Student ${deletingStudent.name} removed from roster and Supabase.`, 'info');
      if (refreshStudents) await refreshStudents();
    } catch (err: any) {
      console.error('Delete student error:', err);
      showToast(err.message || 'Failed to delete student', 'error');
    }
    setShowDeleteStudentModal(false);
    setDeletingStudent(null);
  };

  // -------------------------------------------------------------
  // GRADE CRUD ACTIONS
  // -------------------------------------------------------------
  const handleOpenAddGradeForStudent = (
    st: Student,
    subject?: Partial<AcademicGrade> & { curriculumTerm?: string }
  ) => {
    setGradeModalMode('add');
    setGradeFormRecordId('');
    setGradeFormStudentId(st.student_id);
    setStudentSearchInput(`${st.name} (${st.student_id})`);
    setShowStudentSuggestions(false);

    if (subject && (subject.code || subject.title)) {
      setGradeFormCode(subject.code || '');
      setGradeFormTitle(subject.title || '');
      setGradeFormUnits(String(subject.units ?? 3));
      setGradeFormGrade('1.75');

      const semNum = Number(subject.semester) || (
        subject.curriculumTerm?.includes('2nd Sem') ? 2 :
          (subject.curriculumTerm?.includes('Summer') ? 3 : 1)
      );
      const semStr = semNum === 2 ? '2nd Sem' : (semNum === 3 ? 'Summer' : '1st Sem');

      // Check if any existing subject in that curriculum term already has an academic year
      let chosenAy = '';
      if (subject.curriculumTerm && historyByCurriculumTerm[subject.curriculumTerm]) {
        const siblings = historyByCurriculumTerm[subject.curriculumTerm];
        const sibWithAy = siblings.find(s => s.academicYear || s.term?.match(/\d{4}-\d{4}/));
        if (sibWithAy) {
          chosenAy = sibWithAy.academicYear || sibWithAy.term?.match(/\d{4}-\d{4}/)?.[0] || '';
        }
      }

      // If not found in sibling subjects of that semester, compute relative to student's academic progress
      if (!chosenAy) {
        const anyWithAy = rawStudentGrades.find(s => (s.academicYear || s.term?.match(/\d{4}-\d{4}/)) && s.yearLevel);
        if (anyWithAy) {
          const ayMatch = (anyWithAy.academicYear || anyWithAy.term || '').match(/\d{4}/);
          if (ayMatch) {
            const anchorYear = parseInt(ayMatch[0], 10);
            const anchorYl = anyWithAy.yearLevel || 1;
            const targetYl = subject.yearLevel || (
              subject.curriculumTerm?.includes('1st Year') ? 1 :
                subject.curriculumTerm?.includes('2nd Year') ? 2 :
                  subject.curriculumTerm?.includes('3rd Year') ? 3 :
                    subject.curriculumTerm?.includes('4th Year') ? 4 : (st.year || 1)
            );
            const targetStartYear = anchorYear + (targetYl - anchorYl);
            chosenAy = `${targetStartYear}-${targetStartYear + 1}`;
          }
        }
      }

      if (!chosenAy) {
        chosenAy = activeAcademicYear || '2027-2028';
      }

      setGradeFormTerm(`${chosenAy} ${semStr}`);
    } else {
      setGradeFormCode('');
      setGradeFormTitle('');
      setGradeFormUnits('3');
      setGradeFormGrade('1.75');
      setGradeFormTerm(activeAcademicYear ? `${activeAcademicYear} 1st Sem` : '2027-2028 1st Sem');
    }
    setShowGradeModal(true);
  };

  const handleOpenEditGradeModal = (rec: AcademicGrade) => {
    setGradeModalMode('edit');
    setGradeFormRecordId(rec.id);
    setGradeFormStudentId(rec.studentId);
    setStudentSearchInput(`${rec.studentName} (${rec.studentId})`);
    setShowStudentSuggestions(false);
    setGradeFormCode(rec.code);
    setGradeFormTitle(rec.title);
    setGradeFormUnits(String(rec.units));
    setGradeFormGrade(rec.grade !== null ? String(rec.grade) : '');
    const actualTerm = (rec.academicYear && String(rec.academicYear) !== 'undefined')
      ? `${rec.academicYear} ${rec.semester === 2 ? '2nd Sem' : (rec.semester === 3 ? 'Summer' : '1st Sem')}`
      : (rec.term && !rec.term.includes('Year') ? rec.term : '2025-2026 1st Sem');
    setGradeFormTerm(actualTerm);
    setShowGradeModal(true);
  };

  const handleSaveGradeRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    const stObj = mockStudents.find(
      s => s.student_id.toLowerCase() === gradeFormStudentId.toLowerCase() || s.id === gradeFormStudentId
    );
    const effectiveStudent = (selectedHistoryStudent && selectedHistoryStudent.student_id.toLowerCase() === gradeFormStudentId.toLowerCase())
      ? selectedHistoryStudent
      : stObj;
    const studentName = effectiveStudent ? effectiveStudent.name : (studentSearchInput || 'Unknown Student');
    const parsedGrade = parseFloat(gradeFormGrade) || 1.75;
    const computedStatus: 'passed' | 'failed' = parsedGrade <= 3.0 ? 'passed' : 'failed';
    const yearLevel = effectiveStudent ? effectiveStudent.year : 1;

    const ayMatch = gradeFormTerm.match(/\d{4}-\d{4}/);
    const academicYear = ayMatch ? ayMatch[0] : '2025-2026';
    const semNum = /2nd|second/i.test(gradeFormTerm) ? 2 : (/summer/i.test(gradeFormTerm) ? 3 : 1);

    const curDef = [...GCT_CURRICULUM_BSIT, ...GCT_CURRICULUM_BSCS].find(
      c => normalizeSubjCode(c.code) === normalizeSubjCode(gradeFormCode) || normalizeSubjCode(c.title) === normalizeSubjCode(gradeFormTitle)
    );
    const subjectYearLevel = curDef?.yearLevel || yearLevel;
    const effectiveSemNum = curDef?.semester || semNum;

    if (gradeModalMode === 'add') {
      const tempId = 'g-' + Date.now();
      const newGrade: AcademicGrade = {
        id: tempId,
        studentId: gradeFormStudentId,
        studentName: studentName,
        code: gradeFormCode,
        title: gradeFormTitle,
        units: Number(gradeFormUnits) || 3,
        grade: parsedGrade,
        rawGrade: String(parsedGrade),
        term: gradeFormTerm,
        academicYear,
        semester: effectiveSemNum,
        yearLevel: subjectYearLevel,
        status: computedStatus
      };

      setMockAcademicGrades(prev => [newGrade, ...prev]);
      setFetchedStudentGrades(prev => {
        const targetKeys = Array.from(new Set([
          gradeFormStudentId,
          effectiveStudent?.student_id,
          selectedHistoryStudent?.student_id,
          ...Object.keys(prev).filter(k => k.toLowerCase() === gradeFormStudentId.toLowerCase())
        ].filter(Boolean) as string[]));

        const updated = { ...prev };
        targetKeys.forEach(k => {
          const existing = updated[k] || [];
          updated[k] = [newGrade, ...existing];
        });
        return updated;
      });

      try {
        const savedRes = await fetchApi('/academic-records', {
          method: 'POST',
          body: JSON.stringify({
            student_id: gradeFormStudentId,
            studentName: studentName,
            subject_id: gradeFormCode,
            title: gradeFormTitle,
            units: Number(gradeFormUnits) || 3,
            grade: parsedGrade,
            term: gradeFormTerm,
            academic_year: academicYear,
            yearLevel: subjectYearLevel,
            semester: effectiveSemNum
          })
        });

        if (savedRes && savedRes.id) {
          const realId = savedRes.id;
          newGrade.id = realId;
          setMockAcademicGrades(prev => prev.map(g => g.id === tempId ? { ...g, id: realId } : g));
          setFetchedStudentGrades(prev => {
            const updated = { ...prev };
            Object.keys(updated).forEach(k => {
              if (k.toLowerCase() === gradeFormStudentId.toLowerCase()) {
                updated[k] = updated[k].map(g => g.id === tempId ? { ...g, id: realId } : g);
              }
            });
            return updated;
          });
        }
      } catch (err) {
        console.warn('Backend grade save notice:', err);
      }
      showToast(`Grade ${parsedGrade.toFixed(2)} for ${gradeFormCode} encoded for ${studentName}!`, 'success');
    } else {
      const updateGradeItem = (g: AcademicGrade): AcademicGrade => {
        const isMatch = g.id === gradeFormRecordId ||
          (g.studentId.toLowerCase() === gradeFormStudentId.toLowerCase() && normalizeSubjCode(g.code || g.title) === normalizeSubjCode(gradeFormCode));
        if (isMatch) {
          return {
            ...g,
            studentId: gradeFormStudentId,
            studentName: studentName,
            code: gradeFormCode,
            title: gradeFormTitle,
            units: Number(gradeFormUnits) || 3,
            grade: parsedGrade,
            rawGrade: String(parsedGrade),
            term: gradeFormTerm,
            academicYear,
            semester: effectiveSemNum,
            yearLevel: subjectYearLevel,
            status: computedStatus,
            isDropped: false
          };
        }
        return g;
      };

      setMockAcademicGrades(prev => prev.map(updateGradeItem));
      setFetchedStudentGrades(prev => {
        const targetKeys = Array.from(new Set([
          gradeFormStudentId,
          effectiveStudent?.student_id,
          selectedHistoryStudent?.student_id,
          ...Object.keys(prev).filter(k => k.toLowerCase() === gradeFormStudentId.toLowerCase())
        ].filter(Boolean) as string[]));

        const updated = { ...prev };
        targetKeys.forEach(k => {
          const existing = updated[k] || [];
          const hasIt = existing.some(g => g.id === gradeFormRecordId || (normalizeSubjCode(g.code || g.title) === normalizeSubjCode(gradeFormCode)));
          if (hasIt) {
            updated[k] = existing.map(updateGradeItem);
          } else {
            const updatedOne: AcademicGrade = {
              id: gradeFormRecordId || `rec-${Date.now()}`,
              studentId: gradeFormStudentId,
              studentName: studentName,
              code: gradeFormCode,
              title: gradeFormTitle,
              units: Number(gradeFormUnits) || 3,
              grade: parsedGrade,
              rawGrade: String(parsedGrade),
              term: gradeFormTerm,
              academicYear,
              semester: effectiveSemNum,
              yearLevel: subjectYearLevel,
              status: computedStatus,
              isDropped: false
            };
            updated[k] = [...existing, updatedOne];
          }
        });
        return updated;
      });

      try {
        await fetchApi('/academic-records', {
          method: 'POST',
          body: JSON.stringify({
            record_id: gradeFormRecordId,
            student_id: gradeFormStudentId,
            studentName: studentName,
            subject_id: gradeFormCode,
            title: gradeFormTitle,
            units: Number(gradeFormUnits) || 3,
            grade: parsedGrade,
            term: gradeFormTerm,
            academic_year: academicYear,
            yearLevel: subjectYearLevel,
            semester: effectiveSemNum
          })
        });
      } catch (err) {
        console.warn('Backend grade update notice:', err);
      }

      showToast(`Grade record updated successfully!`, 'success');
    }
    if (refreshStudents) {
      refreshStudents().catch(e => console.warn('Student sync notice:', e));
    }
    setShowGradeModal(false);
  };

  const handleConfirmDeleteGrade = async () => {
    if (!deletingGradeRecord) return;
    const target = deletingGradeRecord;
    try {
      await fetchApi(`/academic-records/${encodeURIComponent(target.id)}?student_id=${encodeURIComponent(target.studentId)}&code=${encodeURIComponent(target.code)}&term=${encodeURIComponent(target.term)}`, {
        method: 'DELETE'
      });
      showToast(`Grade record for ${target.code} deleted successfully from database.`, 'info');
    } catch (err: any) {
      console.error('Failed to delete grade record:', err);
      showToast(`Could not delete from database: ${err.message || 'Error'}`, 'error');
    }

    setMockAcademicGrades(prev => prev.filter(g => g.id !== target.id));
    if (target.studentId) {
      const normCode = normalizeSubjCode(target.code);
      setFetchedStudentGrades(prev => {
        const existing = prev[target.studentId] || [];
        return {
          ...prev,
          [target.studentId]: existing.filter(g => g.id !== target.id && normalizeSubjCode(g.code) !== normCode)
        };
      });
    }
    setShowDeleteGradeModal(false);
    setDeletingGradeRecord(null);
    if (refreshStudents) {
      refreshStudents().catch(() => { });
    }
  };

  // -------------------------------------------------------------
  // STUDENT ACADEMIC HISTORY & ADVISING SLIP (Grouped per Semester)
  // -------------------------------------------------------------
  const handleOpenStudentHistory = async (st: Student, targetTerm?: string) => {
    setSelectedHistoryStudent(st);
    setActiveHistoryTermTab(targetTerm || 'ALL');
    setHistoryViewMode('curriculum');
    setShowHistoryModal(true);

    // Always fetch fresh live grades directly from database to reflect any Supabase additions or deletions
    try {
      setLoadingHistoryGrades(true);
      const data = await fetchApi(`/academic-records?student_id=${encodeURIComponent(st.student_id)}`);
      if (Array.isArray(data)) {
        const liveList: AcademicGrade[] = data.map((r: any) => {
          const isDropped = r.is_dropped || r.raw_grade === '9' || r.grade === 9 || r.status === 'dropped';
          const isFailed = !isDropped && (r.status === 'failed' || r.grade === 5 || r.raw_grade === '5' || (r.grade !== null && Number(r.grade) > 3.0));
          const num = (!isDropped && r.grade !== null && r.grade !== undefined && !isNaN(Number(r.grade))) ? Number(r.grade) : null;
          let status: 'passed' | 'failed' | 'dropped' = 'passed';
          if (isDropped) status = 'dropped';
          else if (isFailed) status = 'failed';
          else status = 'passed';

          return {
            id: r.id || `rec-${Math.random()}`,
            studentId: r.student_id || st.student_id,
            studentName: r.studentName || st.name,
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
            yearLevel: Number(r.subject?.year_level || r.year_level || st.year || 1)
          };
        });

        setFetchedStudentGrades(prev => ({ ...prev, [st.student_id]: liveList }));
        setMockAcademicGrades(prev => {
          const cleanTarget = st.student_id.toLowerCase().trim();
          const others = prev.filter(g => g.studentId.toLowerCase().trim() !== cleanTarget);
          return [...others, ...liveList];
        });
      }
    } catch (err) {
      console.warn('Live student academic history fetch notice:', err);
    } finally {
      setLoadingHistoryGrades(false);
    }
  };

  const handleOpenAdvisingSlip = (st: Student) => {
    setAdvisingStudent(st);
    setShowAdvisingModal(true);
  };

  // Base raw grades directly from database or mock
  const rawStudentGrades = useMemo(() => {
    if (!selectedHistoryStudent) return [];

    const studentIdLower = selectedHistoryStudent.student_id.toLowerCase();
    const fetchedKey = Object.keys(fetchedStudentGrades).find(k => k.toLowerCase() === studentIdLower);
    const fromFetched = fetchedKey ? fetchedStudentGrades[fetchedKey] : fetchedStudentGrades[selectedHistoryStudent.student_id];
    const fromMock = (studentIdLower && gradesByStudentIdMap.get(studentIdLower)) ||
      (selectedHistoryStudent.student_id && gradesByStudentIdMap.get(selectedHistoryStudent.student_id.toLowerCase())) ||
      mockAcademicGrades.filter(g => g.studentId.toLowerCase() === studentIdLower);

    return (fromFetched && fromFetched.length > 0)
      ? fromFetched
      : (fromMock.length > 0 ? fromMock : []);
  }, [selectedHistoryStudent, fetchedStudentGrades, mockAcademicGrades, gradesByStudentIdMap]);

  // Strict Curriculum-Based Grade Transcript (Enforces 9 subjects in 1st Y 1st S, 8 in 1st Y 2nd S, etc.)
  const studentAcademicHistoryGrades = useMemo(() => {
    if (!selectedHistoryStudent) return [];
    return buildCompleteStudentGrades(selectedHistoryStudent, rawStudentGrades);
  }, [selectedHistoryStudent, rawStudentGrades]);

  // Overall GWA Calculation (Only includes taken, non-dropped graded subjects)
  const studentGwaCalculation = useMemo(() => {
    const validGrades = studentAcademicHistoryGrades.filter(
      g => g.status !== 'not_taken' && g.status !== 'dropped' && !g.isDropped && g.grade !== null && !isNaN(Number(g.grade)) && Number(g.grade) > 0
    );

    if (validGrades.length === 0) {
      return { gwa: '0.00', totalUnits: 0, passedUnits: 0, failedUnits: 0, passedCount: 0, failedCount: 0, retakeCount: 0, notTakenCount: studentAcademicHistoryGrades.filter(g => g.status === 'not_taken').length };
    }

    let totalPoints = 0;
    let totalUnits = 0;
    let passedUnits = 0;
    let failedUnits = 0;
    let passedCount = 0;
    let failedCount = 0;
    let retakeCount = 0;

    validGrades.forEach(g => {
      const u = Number(g.units) || 3;
      const gr = Number(g.grade);
      totalPoints += gr * u;
      totalUnits += u;
      if (gr <= 3.0 && g.status === 'passed') {
        passedUnits += u;
        passedCount++;
        if (g.isRetake) retakeCount++;
      } else {
        failedUnits += u;
        failedCount++;
      }
    });

    const notTakenCount = studentAcademicHistoryGrades.filter(g => g.status === 'not_taken').length;
    const gwa = totalUnits > 0 ? (totalPoints / totalUnits).toFixed(2) : '0.00';
    return { gwa, totalUnits, passedUnits, failedUnits, passedCount, failedCount, retakeCount, notTakenCount };
  }, [studentAcademicHistoryGrades]);

  // Dynamic standing year level for the active history student
  // Dynamic standing year level for the active history student (reverts/advances dynamically based on actual grades)
  const activeStudentStandingYear = useMemo(() => {
    if (!selectedHistoryStudent) return 1;
    const grades = (Array.isArray(rawStudentGrades) && rawStudentGrades.length > 0)
      ? rawStudentGrades
      : (Array.isArray(studentAcademicHistoryGrades) ? studentAcademicHistoryGrades : []);

    const validGrades = grades.filter(g => g && g.status !== 'not_taken');
    if (validGrades.length === 0) {
      return Number(selectedHistoryStudent.year || 1);
    }

    // 1. Highest curriculum year taken among valid records
    let maxTakenYear = 1;
    let sem2CountY1 = 0;
    let sem2CountY2 = 0;
    let hasSummerYear3 = false;

    validGrades.forEach(g => {
      const y = Number(g.yearLevel || (g as any).year_level);
      if (Number.isFinite(y) && y >= 1 && y <= 4 && y > maxTakenYear) {
        maxTakenYear = y;
      }
      const isSem2 = String(g.semester || '').toLowerCase().includes('second') || String(g.semester) === '2' || (g.term && /2nd|second/i.test(g.term));
      const isSummer = String(g.semester || '').toLowerCase().includes('summer') || String(g.semester) === '3' || (g.term && /summer/i.test(g.term));
      if (y === 1 && isSem2) sem2CountY1++;
      if (y === 2 && isSem2) sem2CountY2++;
      if (y === 3 && isSummer) hasSummerYear3 = true;
    });

    let calculatedYear = maxTakenYear;
    // Year 1 -> 2: completing 2nd sem of Year 1
    if (sem2CountY1 >= 3) calculatedYear = Math.max(calculatedYear, 2);
    // Year 2 -> 3: completing 2nd sem of Year 2
    if (sem2CountY2 >= 3) calculatedYear = Math.max(calculatedYear, 3);
    // Year 3 -> 4: requires completing 3rd Year Summer OR taking Year 4 subjects
    // Completing 3rd Year 2nd Sem keeps the student in 3rd Year because Summer is still required!
    if (hasSummerYear3 || maxTakenYear >= 4) calculatedYear = Math.max(calculatedYear, 4);

    return Math.min(4, Math.max(1, calculatedYear));
  }, [selectedHistoryStudent, rawStudentGrades, studentAcademicHistoryGrades]);

  // Official Curriculum Semester Terms in strict sequence
  const CURRICULUM_TERMS_ORDER = useMemo(() => [
    '1st Year • 1st Sem',
    '1st Year • 2nd Sem',
    '2nd Year • 1st Sem',
    '2nd Year • 2nd Sem',
    '3rd Year • 1st Sem',
    '3rd Year • 2nd Sem',
    '3rd Year • Summer',
    '4th Year • 1st Sem',
    '4th Year • 2nd Sem'
  ], []);

  // Grouped History by Official Curriculum Term
  const historyByCurriculumTerm = useMemo(() => {
    const map: Record<string, AcademicGrade[]> = {};
    CURRICULUM_TERMS_ORDER.forEach(term => {
      map[term] = [];
    });
    studentAcademicHistoryGrades.forEach(g => {
      const termKey = g.curriculumTerm || g.term || '1st Year • 1st Sem';
      if (!map[termKey]) map[termKey] = [];
      map[termKey].push(g);
    });
    return map;
  }, [studentAcademicHistoryGrades, CURRICULUM_TERMS_ORDER]);

  // Grouped History by Chronological Enrollment Term (actual registrar term records)
  const historyByChronologicalTerm = useMemo(() => {
    const map: Record<string, AcademicGrade[]> = {};
    rawStudentGrades.forEach(g => {
      const termKey = g.term || '2023-2024 1st Sem';
      if (!map[termKey]) map[termKey] = [];
      map[termKey].push(g);
    });
    return map;
  }, [rawStudentGrades]);

  const uniqueChronologicalTerms = useMemo(() => {
    return sortTermsChronologically(Object.keys(historyByChronologicalTerm));
  }, [historyByChronologicalTerm]);

  // Active terms depending on selected view mode (Curriculum vs Chronological)
  const activeDisplayTerms = useMemo(() => {
    if (historyViewMode === 'curriculum') {
      return CURRICULUM_TERMS_ORDER.filter(term => (historyByCurriculumTerm[term] || []).length > 0);
    }
    return uniqueChronologicalTerms;
  }, [historyViewMode, CURRICULUM_TERMS_ORDER, historyByCurriculumTerm, uniqueChronologicalTerms]);

  const activeDisplayHistoryMap = useMemo(() => {
    return historyViewMode === 'curriculum' ? historyByCurriculumTerm : historyByChronologicalTerm;
  }, [historyViewMode, historyByCurriculumTerm, historyByChronologicalTerm]);

  // -------------------------------------------------------------
  // FAST EXCEL IMPORT HANDLER
  // -------------------------------------------------------------
  const handleSimulateFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFileName(file.name);
    try {
      const rawRows = await parseExcelOrCsvFile(file);
      if (!rawRows || rawRows.length === 0) {
        showToast('No data rows found in uploaded file.', 'warning');
        return;
      }

      // Auto-detect if file is an Academic Grade Sheet vs Student Directory Roster
      const firstRowKeys = Object.keys(rawRows[0] || {}).map(k => k.trim().toLowerCase());
      const looksLikeGradeSheet = firstRowKeys.some(k =>
        k === 'subject' || k === 'code' || k === 'grade' || k === 'raw_grade' || k === 'cat no.' || k === 'cat no' || k === 'subject code'
      );
      const effectiveTargetType = looksLikeGradeSheet ? 'grades' : uploadTargetType;
      if (effectiveTargetType !== uploadTargetType) {
        setUploadTargetType(effectiveTargetType);
      }

      if (effectiveTargetType === 'students') {
        const parsed: Array<{ student_id: string; name: string; program: string; year: number }> = rawRows.map((row, idx) => {
          const keys = Object.keys(row);
          const findVal = (...possibleKeys: string[]) => {
            for (const pk of possibleKeys) {
              const matchKey = keys.find(k => k.trim().toLowerCase() === pk.toLowerCase());
              if (matchKey && row[matchKey] !== undefined && row[matchKey] !== null && row[matchKey] !== '') {
                return row[matchKey];
              }
            }
            return '';
          };

          const student_id = String(findVal('Student ID', 'student_id', 'ID', 'StudentID', 'StudentNo', 'id') || `GCT-2024-000${idx + 1}`).trim();
          const name = String(findVal('Full Name', 'full_name', 'Name', 'Student Name', 'FullName', 'Student') || 'Student Name').trim();
          const program = String(findVal('Program / Course', 'Program', 'Course', 'course', 'program', 'Degree') || 'BSIT').trim();
          const year = Number(findVal('Year Level', 'year_level', 'Year', 'Yr', 'year')) || 1;

          return { student_id, name, program, year };
        });

        setParsedUploadStudents(parsed);
        setIsCsvUploaded(true);
        showToast(`Parsed ${parsed.length} student records from "${file.name}"!`, 'info');
      } else {
        const parsedPreview: CsvPreviewRow[] = rawRows.map((row, idx) => {
          const keys = Object.keys(row);
          const findVal = (...possibleKeys: string[]) => {
            for (const pk of possibleKeys) {
              const matchKey = keys.find(k => k.trim().toLowerCase() === pk.toLowerCase());
              if (matchKey && row[matchKey] !== undefined && row[matchKey] !== null && row[matchKey] !== '') {
                return row[matchKey];
              }
            }
            return '';
          };

          const studentId = String(findVal('Student ID', 'student_id', 'ID', 'StudentID', 'StudentNo', 'Student No', 'id') || `GCT-2024-000${idx + 1}`).trim();
          const name = String(findVal('Full Name', 'full_name', 'Name', 'Student Name', 'FullName') || 'Student Name').trim();
          const course = String(findVal('Course', 'Program', 'course', 'program', 'Degree') || 'BSIT').trim();
          const year = Number(findVal('Year Level', 'year_level', 'Year', 'Yr', 'year')) || 1;
          const code = String(findVal('Subject', 'subject', 'Cat No.', 'Cat No', 'Subject Code', 'Code', 'code', 'cat_no') || 'IT 101').trim();
          const title = String(findVal('Descriptive Title', 'Title', 'Subject Title', 'Description', 'Subject Description') || code).trim();
          const units = Number(findVal('Units', 'Unit', 'units')) || 3;
          const gradeVal = findVal('Grade', 'grade', 'Grade (%)', 'Final Grade', 'raw_grade', 'rating');
          const grade = gradeVal !== '' && gradeVal != null ? String(gradeVal) : '';

          // Intelligently construct term from semester + academic_year if separate
          const semVal = String(findVal('Semester', 'semester', 'Sem', 'sem')).trim();
          const ayVal = String(findVal('Academic Year', 'academic_year', 'AY', 'ay')).trim();
          let term = String(findVal('Term', 'Academic Term', 'term')).trim();
          if (!term && ayVal) {
            const semClean = /2nd|second/i.test(semVal) ? '2nd Sem' : /summer/i.test(semVal) ? 'Summer' : '1st Sem';
            term = `${ayVal} ${semClean}`;
          } else if (!term) {
            term = `${activeAcademicYear || '2025-2026'} 1st Sem`;
          }

          const numGrade = grade !== '' ? parseFloat(grade) : null;
          let status: CsvPreviewRow['status'] = 'valid';
          let errorMsg = '';

          if (numGrade !== null && (isNaN(numGrade) || numGrade < 1.0 || numGrade > 5.0)) {
            status = 'invalid_grade';
            errorMsg = 'Grade must be between 1.00 and 5.00';
          } else if (numGrade === null) {
            status = 'valid_pending';
            errorMsg = 'Pending encoding';
          }

          return {
            id: `parsed-${Date.now()}-${idx}`,
            studentId,
            name,
            course,
            year,
            code,
            title,
            units,
            grade,
            term,
            status,
            errorMsg
          };
        });

        setCsvPreviewRows(parsedPreview);
        setIsCsvUploaded(true);
        showToast(`Parsed ${parsedPreview.length} grade records from "${file.name}"!`, 'info');
      }
    } catch (err: any) {
      console.error('Error parsing file:', err);
      showToast(`Error parsing file: ${err?.message || 'Invalid format'}`, 'error');
    }
  };

  const handleCommitUpload = async () => {
    if (uploadTargetType === 'students') {
      if (parsedUploadStudents.length === 0) return;
      setIsCommittingUpload(true);
      try {
        let successCount = 0;
        for (const item of parsedUploadStudents) {
          try {
            await fetchApi('/students', {
              method: 'POST',
              body: JSON.stringify({
                student_id: item.student_id,
                name: item.name,
                program: item.program,
                year: item.year
              })
            });
            successCount++;
          } catch (e) {
            console.warn(`Failed to import student ${item.student_id}:`, e);
          }
        }
        if (refreshStudents) await refreshStudents();
        showToast(`Successfully stored ${successCount} student records into database!`, 'success');
        setShowUploadModal(false);
        setIsCsvUploaded(false);
        setParsedUploadStudents([]);
      } catch (err: any) {
        showToast(`Error storing students in database: ${err?.message || 'Database error'}`, 'error');
      } finally {
        setIsCommittingUpload(false);
      }
    } else {
      if (csvPreviewRows.length === 0) return;
      setIsCommittingUpload(true);
      try {
        showToast(`Saving ${csvPreviewRows.length} grade records into database...`, 'info');
        const payload = csvPreviewRows.map(r => ({
          student_id: r.studentId,
          studentName: r.name,
          course: r.course || 'BSIT',
          year_level: Number(r.year) || 1,
          code: r.code,
          title: r.title,
          units: Number(r.units) || 3,
          grade: r.grade !== '' && r.grade !== null ? parseFloat(String(r.grade)) : null,
          term: r.term || `${activeAcademicYear || '2027-2028'} 1st Sem`
        }));

        const res = await fetchApi('/academic-records/batch', {
          method: 'POST',
          body: JSON.stringify({ records: payload })
        });

        if (refreshAcademicGrades) await refreshAcademicGrades('all');
        if (refreshStudents) await refreshStudents();

        showToast(res.message || `Successfully stored ${payload.length} grade records into database!`, 'success');
        setShowUploadModal(false);
        setIsCsvUploaded(false);
        setCsvPreviewRows([]);
      } catch (err: any) {
        console.error('Error committing batch grades to database:', err);
        showToast(`Error storing grades in database: ${err?.message || 'Database error'}`, 'error');
      } finally {
        setIsCommittingUpload(false);
      }
    }
  };

  return (
    <div style={{ paddingBottom: '3rem' }}>
      {/* ========================================================= */}
      {/* HEADER CONTROLS BAR (STUDENT DIRECTORY)                    */}
      {/* ========================================================= */}
      <div style={{
        background: '#FFFFFF',
        border: '1px solid var(--border-color)',
        borderRadius: '16px',
        padding: '1.25rem 1.5rem',
        marginBottom: '1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFFFFF',
            boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)'
          }}>
            <Users size={22} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
              Student Directory
            </h2>
            <p style={{ fontSize: '0.78rem', color: '#64748B', margin: '0.15rem 0 0 0' }}>
              Official student directory & academic history transcript access
            </p>
          </div>
        </div>

        {/* Global Quick Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => {
              setUploadTargetType('students');
              setShowUploadModal(true);
            }}
            className="btn btn-secondary"
            style={{ fontSize: '0.82rem', padding: '0.55rem 0.95rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            title="Import Excel or CSV student records"
          >
            <Upload size={15} /> Import Students
          </button>

          <button
            onClick={() => exportStudentsToExcel(filteredStudents, `GCT_${selectedCourseCode || 'Roster'}_${new Date().toISOString().slice(0, 10)}.xlsx`)}
            className="btn btn-secondary"
            style={{ fontSize: '0.82rem', padding: '0.55rem 0.95rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Download size={15} /> Export Roster (.xlsx)
          </button>

          <button
            onClick={handleOpenAddStudentModal}
            className="btn btn-primary"
            style={{ fontSize: '0.82rem', padding: '0.55rem 1.1rem', display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}
          >
            <Plus size={16} /> Add Student Record
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* MAIN CONTENT: STUDENT DIRECTORY ROSTER TABLE              */}
      {/* ========================================================= */}
      <div>
        {/* SEARCH & FILTERS TOOLBAR */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
          {/* Search Input */}
          <div style={{ position: 'relative', width: '320px', maxWidth: '100%' }}>
            <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Search students by name, ID, or program..."
              value={studentSearchQuery}
              onChange={e => setStudentSearchQuery(e.target.value)}
              className="form-input"
              style={{ paddingLeft: '2.4rem', width: '100%', fontSize: '0.85rem', height: '38px', borderRadius: '9px' }}
            />
          </div>

          {/* Filters beside Search Bar */}
          <select
            value={selectedCourseCode}
            onChange={e => setSelectedCourseCode(e.target.value)}
            className="form-select"
            style={{ fontSize: '0.82rem', height: '38px', borderRadius: '9px', padding: '0 0.85rem', width: 'auto', minWidth: '180px' }}
          >
            <option value="">All Degree Programs</option>
            {PROGRAM_CATALOG.map(p => (
              <option key={p.code} value={p.code}>{p.code} - {p.name}</option>
            ))}
          </select>

          <select
            value={selectedYearLevel}
            onChange={e => setSelectedYearLevel(e.target.value)}
            className="form-select"
            style={{ fontSize: '0.82rem', height: '38px', borderRadius: '9px', padding: '0 0.85rem', width: 'auto', minWidth: '140px' }}
          >
            <option value="">All Year Levels</option>
            <option value="1">1st Year</option>
            <option value="2">2nd Year</option>
            <option value="3">3rd Year</option>
            <option value="4">4th Year</option>
          </select>
        </div>

        {/* ROSTER TABLE CONTAINER */}
        <div className="glass-card" style={{ padding: '1.25rem', overflowX: 'auto', background: '#FFFFFF', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-main)' }}>
              {[
                selectedCourseCode || 'All Degree Programs',
                selectedYearLevel ? `${selectedYearLevel === '1' ? '1st' : selectedYearLevel === '2' ? '2nd' : selectedYearLevel === '3' ? '3rd' : '4th'} Yr` : 'All Year Levels'
              ].filter(Boolean).join(' • ')}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Showing <strong>{filteredStudents.length === 0 ? 0 : (safeStudentPage - 1) * studentPageSize + 1}–{Math.min(safeStudentPage * studentPageSize, filteredStudents.length)}</strong> of <strong>{filteredStudents.length}</strong> students
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                <span>Sort:</span>
                <select
                  value={studentSortBy}
                  onChange={(e) => setStudentSortBy(e.target.value as any)}
                  className="form-select"
                  style={{ padding: '0.2rem 0.45rem', fontSize: '0.78rem', width: 'auto', borderRadius: '6px' }}
                >
                  <option value="name-asc">Alphabetical (A-Z) • Year Level (1-4)</option>
                  <option value="name-desc">Alphabetical (Z-A) • Year Level (4-1)</option>
                  <option value="id-asc">Student ID (Ascending)</option>
                  <option value="id-desc">Student ID (Descending)</option>
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                <span>Rows:</span>
                <select
                  value={studentPageSize}
                  onChange={(e) => {
                    setStudentPageSize(Number(e.target.value));
                    setStudentPage(1);
                  }}
                  className="form-select"
                  style={{ padding: '0.2rem 0.45rem', fontSize: '0.78rem', width: 'auto', borderRadius: '6px' }}
                >
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>
          </div>

          {filteredStudents.length === 0 ? (
            <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Users size={40} style={{ margin: '0 auto 0.75rem', opacity: 0.4 }} />
              <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>No student records found</div>
              <p style={{ fontSize: '0.82rem', marginTop: '0.25rem' }}>
                Click "Add Student Record" or "Import Students" to add students to this directory.
              </p>
            </div>
          ) : (
            <>
              <table className="custom-table" style={{ fontSize: '0.85rem' }}>
                <thead>
                  <tr>
                    <th>Student ID</th>
                    <th>Full Name</th>
                    <th>Program</th>
                    <th>Year Level</th>
                    <th style={{ textAlign: 'center' }}>Academic History</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedStudents.filter(Boolean).map(st => {
                    if (!st) return null;
                    return (
                      <tr key={st.id || st.student_id}>
                        <td style={{ fontWeight: 800, color: 'var(--primary)' }}>{st.student_id || 'N/A'}</td>
                        <td style={{ fontWeight: 700, color: 'var(--text-main)' }}>{st.name || 'Student'}</td>
                        <td>
                          <span style={{ fontSize: '0.76rem', background: '#EFF6FF', color: '#1D4ED8', padding: '2px 7px', borderRadius: '5px', fontWeight: 800, border: '1px solid #BFDBFE' }}>
                            {st.program || 'BSIT'}
                          </span>
                        </td>
                        <td>{(() => {
                          const yr = getStudentStandingYear(st);
                          return yr === 1 ? '1st' : yr === 2 ? '2nd' : yr === 3 ? '3rd' : '4th';
                        })()} Year</td>

                        {/* HISTORY BUTTON COLUMN */}
                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => handleOpenStudentHistory(st)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              background: '#EFF6FF',
                              color: '#1D4ED8',
                              border: '1px solid #BFDBFE',
                              borderRadius: '7px',
                              padding: '0.35rem 0.75rem',
                              fontSize: '0.78rem',
                              fontWeight: 800,
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                              boxShadow: '0 1px 3px rgba(37, 99, 235, 0.12)'
                            }}
                            onMouseEnter={e => {
                              e.currentTarget.style.background = '#2563EB';
                              e.currentTarget.style.color = '#FFFFFF';
                              e.currentTarget.style.borderColor = '#1D4ED8';
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.background = '#EFF6FF';
                              e.currentTarget.style.color = '#1D4ED8';
                              e.currentTarget.style.borderColor = '#BFDBFE';
                            }}
                            title={`View complete academic history for ${st.name}`}
                          >
                            <Award size={14} /> History
                          </button>
                        </td>

                        {/* EDIT & DELETE ACTIONS */}
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '0.35rem', alignItems: 'center' }}>
                            <button
                              type="button"
                              onClick={() => handleOpenEditStudentModal(st)}
                              style={{
                                background: '#F8FAFC',
                                border: '1px solid var(--border-color)',
                                borderRadius: '7px',
                                padding: '0.35rem 0.55rem',
                                cursor: 'pointer',
                                color: 'var(--text-main)'
                              }}
                              title="Edit Student Profile"
                            >
                              <Pencil size={13} />
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setDeletingStudent(st);
                                setShowDeleteStudentModal(true);
                              }}
                              style={{
                                background: '#FEF2F2',
                                border: '1px solid #FCA5A5',
                                borderRadius: '7px',
                                padding: '0.35rem 0.55rem',
                                cursor: 'pointer',
                                color: '#DC2626'
                              }}
                              title="Delete Student"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* PAGINATION CONTROLS FOOTER */}
              {filteredStudents.length > 0 && (
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingTop: '0.85rem',
                  marginTop: '0.85rem',
                  borderTop: '1px solid var(--border-color)',
                  flexWrap: 'wrap',
                  gap: '0.75rem'
                }}>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Page <strong>{safeStudentPage}</strong> of <strong>{totalStudentPages}</strong>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <button
                      type="button"
                      disabled={safeStudentPage === 1}
                      onClick={() => setStudentPage(prev => Math.max(1, prev - 1))}
                      className="btn btn-secondary"
                      style={{ padding: '0.3rem 0.65rem', fontSize: '0.78rem', opacity: safeStudentPage === 1 ? 0.5 : 1, cursor: safeStudentPage === 1 ? 'not-allowed' : 'pointer' }}
                    >
                      Previous
                    </button>

                    {Array.from({ length: totalStudentPages }, (_, i) => i + 1)
                      .filter(p => p === 1 || p === totalStudentPages || Math.abs(p - safeStudentPage) <= 2)
                      .map((p, idx, arr) => {
                        const prevP = arr[idx - 1];
                        const showEllipsis = prevP && p - prevP > 1;
                        return (
                          <React.Fragment key={p}>
                            {showEllipsis && <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>...</span>}
                            <button
                              type="button"
                              onClick={() => setStudentPage(p)}
                              style={{
                                padding: '0.3rem 0.65rem',
                                fontSize: '0.78rem',
                                borderRadius: '6px',
                                border: p === safeStudentPage ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                                background: p === safeStudentPage ? 'var(--primary)' : '#FFFFFF',
                                color: p === safeStudentPage ? '#FFFFFF' : 'var(--text-main)',
                                fontWeight: p === safeStudentPage ? 800 : 500,
                                cursor: 'pointer'
                              }}
                            >
                              {p}
                            </button>
                          </React.Fragment>
                        );
                      })}

                    <button
                      type="button"
                      disabled={safeStudentPage >= totalStudentPages}
                      onClick={() => setStudentPage(prev => Math.min(totalStudentPages, prev + 1))}
                      className="btn btn-secondary"
                      style={{ padding: '0.3rem 0.65rem', fontSize: '0.78rem', opacity: safeStudentPage >= totalStudentPages ? 0.5 : 1, cursor: safeStudentPage >= totalStudentPages ? 'not-allowed' : 'pointer' }}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* MODAL 1: ADD / EDIT STUDENT RECORD                        */}
      {/* ========================================================= */}
      {showStudentModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem'
        }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '520px', padding: '2rem', background: '#FFFFFF', borderRadius: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Users size={20} color="var(--primary)" />
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: '#0F172A' }}>
                  {studentModalMode === 'add' ? 'Register New Student' : 'Edit Student Profile'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowStudentModal(false)}
                style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveStudent}>
              <div className="form-group">
                <label className="form-label">Student ID</label>
                <input
                  type="text"
                  value={studentFormStudentId}
                  onChange={e => setStudentFormStudentId(e.target.value)}
                  className="form-input"
                  placeholder="e.g. GCT-2026-0001"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input
                  type="text"
                  value={studentFormName}
                  onChange={e => setStudentFormName(e.target.value)}
                  className="form-input"
                  placeholder="Enter student full name"
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label">Degree Program</label>
                  <select
                    value={studentFormProgram}
                    onChange={e => setStudentFormProgram(e.target.value)}
                    className="form-select"
                  >
                    {PROGRAM_CATALOG.map(p => (
                      <option key={p.code} value={p.code}>{p.code} - {p.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Year Level</label>
                  <select
                    value={studentFormYear}
                    onChange={e => setStudentFormYear(Number(e.target.value))}
                    className="form-select"
                  >
                    <option value={1}>1st Year</option>
                    <option value={2}>2nd Year</option>
                    <option value={3}>3rd Year</option>
                    <option value={4}>4th Year</option>
                  </select>
                </div>
              </div>



              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowStudentModal(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {studentModalMode === 'add' ? 'Save Student' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: ENCODE / EDIT GRADE RECORD                       */}
      {/* ========================================================= */}
      {showGradeModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          zIndex: 10500,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem'
        }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '540px', padding: '2rem', background: '#FFFFFF', borderRadius: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <GraduationCap size={20} color="var(--primary)" />
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: '#0F172A' }}>
                  {gradeModalMode === 'add' ? 'Encode Academic Grade Record' : 'Edit Grade Record'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowGradeModal(false)}
                style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveGradeRecord}>
              {/* Student Lookup Search */}
              <div className="form-group" style={{ position: 'relative' }}>
                <label className="form-label">Student</label>
                <input
                  type="text"
                  placeholder="Type student name or ID..."
                  value={studentSearchInput}
                  onChange={e => {
                    setStudentSearchInput(e.target.value);
                    setShowStudentSuggestions(true);
                  }}
                  onFocus={() => setShowStudentSuggestions(true)}
                  className="form-input"
                  required
                />
                {showStudentSuggestions && studentSearchInput.trim() && (
                  <div style={{
                    position: 'absolute',
                    top: '100%', left: 0, right: 0,
                    background: '#FFFFFF',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    maxHeight: '160px',
                    overflowY: 'auto',
                    zIndex: 20,
                    boxShadow: 'var(--shadow-elevated)'
                  }}>
                    {mockStudents
                      .filter(s => s.name.toLowerCase().includes(studentSearchInput.toLowerCase()) || s.student_id.toLowerCase().includes(studentSearchInput.toLowerCase()))
                      .slice(0, 5)
                      .map(st => (
                        <div
                          key={st.id}
                          onClick={() => {
                            setGradeFormStudentId(st.student_id);
                            setStudentSearchInput(`${st.name} (${st.student_id})`);
                            setShowStudentSuggestions(false);
                          }}
                          style={{
                            padding: '0.5rem 0.75rem',
                            fontSize: '0.82rem',
                            cursor: 'pointer',
                            borderBottom: '1px solid #F1F5F9'
                          }}
                        >
                          <div style={{ fontWeight: 700 }}>{st.name}</div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{st.student_id} • {st.program} Year {st.year}</div>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label">Subject Code</label>
                  <input
                    type="text"
                    value={gradeFormCode}
                    onChange={e => setGradeFormCode(e.target.value)}
                    className="form-input"
                    placeholder="e.g. IT 101"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Subject Title</label>
                  <input
                    type="text"
                    value={gradeFormTitle}
                    onChange={e => setGradeFormTitle(e.target.value)}
                    className="form-input"
                    placeholder="e.g. Intro to Computing"
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label">Units</label>
                  <input
                    type="number"
                    min={1}
                    max={6}
                    value={gradeFormUnits}
                    onChange={e => setGradeFormUnits(e.target.value)}
                    className="form-input"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Grade (1.0 - 5.0)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1.0"
                    max="5.0"
                    value={gradeFormGrade}
                    onChange={e => setGradeFormGrade(e.target.value)}
                    className="form-input"
                    placeholder="e.g. 1.75"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Term</label>
                  <select
                    value={gradeFormTerm}
                    onChange={e => setGradeFormTerm(e.target.value)}
                    className="form-select"
                  >
                    <option value="2023-2024 1st Sem">2023-2024 1st Sem</option>
                    <option value="2023-2024 2nd Sem">2023-2024 2nd Sem</option>
                    <option value="2023-2024 Summer">2023-2024 Summer</option>
                    <option value="2024-2025 1st Sem">2024-2025 1st Sem</option>
                    <option value="2024-2025 2nd Sem">2024-2025 2nd Sem</option>
                    <option value="2024-2025 Summer">2024-2025 Summer</option>
                    <option value="2025-2026 1st Sem">2025-2026 1st Sem</option>
                    <option value="2025-2026 2nd Sem">2025-2026 2nd Sem</option>
                    <option value="2025-2026 Summer">2025-2026 Summer</option>
                    <option value="2026-2027 1st Sem">2026-2027 1st Sem</option>
                    <option value="2026-2027 2nd Sem">2026-2027 2nd Sem</option>
                    <option value="2026-2027 Summer">2026-2027 Summer</option>
                    <option value="2027-2028 1st Sem">2027-2028 1st Sem</option>
                    <option value="2027-2028 2nd Sem">2027-2028 2nd Sem</option>
                    <option value="2027-2028 Summer">2027-2028 Summer</option>
                    {gradeFormTerm && ![
                      '2023-2024 1st Sem', '2023-2024 2nd Sem', '2023-2024 Summer',
                      '2024-2025 1st Sem', '2024-2025 2nd Sem', '2024-2025 Summer',
                      '2025-2026 1st Sem', '2025-2026 2nd Sem', '2025-2026 Summer',
                      '2026-2027 1st Sem', '2026-2027 2nd Sem', '2026-2027 Summer',
                      '2027-2028 1st Sem', '2027-2028 2nd Sem', '2027-2028 Summer'
                    ].includes(gradeFormTerm) && (
                        <option value={gradeFormTerm}>{gradeFormTerm}</option>
                      )}
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowGradeModal(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {gradeModalMode === 'add' ? 'Encode Grade' : 'Update Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 3: RICH STUDENT ACADEMIC HISTORY & TRANSCRIPT MODAL  */}
      {/* ========================================================= */}
      {showHistoryModal && selectedHistoryStudent && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(6px)',
          zIndex: 10000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem'
        }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '840px', maxHeight: '90vh', overflowY: 'auto', padding: '2rem', background: '#FFFFFF', borderRadius: '16px' }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', borderBottom: '1px solid #E2E8F0', paddingBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                <div
                  style={{
                    width: '46px',
                    height: '46px',
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#FFFFFF',
                    fontWeight: 800,
                    fontSize: '1.1rem',
                    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)'
                  }}
                >
                  {(selectedHistoryStudent.name || 'ST').slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <h3 style={{ fontSize: '1.3rem', fontWeight: 800, margin: 0, color: '#0F172A' }}>
                      {selectedHistoryStudent.name || 'Student'}
                    </h3>
                    <span style={{ background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE', padding: '2px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 800 }}>
                      {selectedHistoryStudent.student_id}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#64748B', marginTop: '0.2rem' }}>
                    Degree Program: <strong>{selectedHistoryStudent.program || 'BSIT'}</strong> • Year Level: <strong>{activeStudentStandingYear === 1 ? '1st' : activeStudentStandingYear === 2 ? '2nd' : activeStudentStandingYear === 3 ? '3rd' : '4th'} Year</strong>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer', padding: '4px' }}
              >
                <X size={22} />
              </button>
            </div>

            {/* Overall GWA & Units Metric Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.85rem', marginBottom: '1.5rem' }}>
              <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '12px', padding: '0.85rem', textAlign: 'center' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#1D4ED8', textTransform: 'uppercase' }}>General Weighted Average</div>
                <div style={{ fontSize: '1.65rem', fontWeight: 850, color: '#1E3A8A', marginTop: '0.2rem' }}>{studentGwaCalculation.gwa}</div>
              </div>

              <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '12px', padding: '0.85rem', textAlign: 'center' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#15803D', textTransform: 'uppercase' }}>Total Passed Units</div>
                <div style={{ fontSize: '1.65rem', fontWeight: 850, color: '#166534', marginTop: '0.2rem' }}>{studentGwaCalculation.passedUnits} Units</div>
              </div>

              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '0.85rem', textAlign: 'center' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Curriculum Completion</div>
                <div style={{ fontSize: '1.65rem', fontWeight: 850, color: '#0F172A', marginTop: '0.2rem' }}>
                  {studentGwaCalculation.passedCount} / {studentAcademicHistoryGrades.length}
                </div>
              </div>

              <div style={{
                background: studentGwaCalculation.failedCount > 0 ? '#FEF2F2' : (studentGwaCalculation.retakeCount > 0 ? '#EFF6FF' : '#F0FDF4'),
                border: `1px solid ${studentGwaCalculation.failedCount > 0 ? '#FECACA' : (studentGwaCalculation.retakeCount > 0 ? '#BFDBFE' : '#BBF7D0')}`,
                borderRadius: '12px',
                padding: '0.85rem',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: studentGwaCalculation.failedCount > 0 ? '#DC2626' : (studentGwaCalculation.retakeCount > 0 ? '#1D4ED8' : '#15803D'), textTransform: 'uppercase' }}>
                  Deficiencies & Retakes
                </div>
                <div style={{ fontSize: '1.35rem', fontWeight: 850, color: studentGwaCalculation.failedCount > 0 ? '#B91C1C' : (studentGwaCalculation.retakeCount > 0 ? '#1E40AF' : '#166534'), marginTop: '0.2rem' }}>
                  {studentGwaCalculation.failedCount > 0
                    ? `${studentGwaCalculation.failedCount} Failed`
                    : (studentGwaCalculation.retakeCount > 0 ? `${studentGwaCalculation.retakeCount} Retake(s) Cleared` : 'All Passed')}
                </div>
              </div>

              <div style={{ background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: '12px', padding: '0.85rem', textAlign: 'center' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#B45309', textTransform: 'uppercase' }}>Academic Standing</div>
                <div style={{ fontSize: '0.88rem', fontWeight: 800, color: studentGwaCalculation.failedCount > 0 ? '#DC2626' : (studentGwaCalculation.retakeCount > 0 ? '#1D4ED8' : '#B45309'), marginTop: '0.4rem' }}>
                  {studentGwaCalculation.failedCount > 0
                    ? 'Irregular • With Deficiencies'
                    : (studentGwaCalculation.retakeCount > 0 ? 'Regular • Deficiencies Cleared' : 'Regular • Good Standing')}
                </div>
              </div>
            </div>

            {loadingHistoryGrades ? (
              <div style={{ textAlign: 'center', padding: '3.5rem 1rem', background: '#F8FAFC', borderRadius: '12px', border: '1px dashed #CBD5E1' }}>
                <div style={{
                  width: '38px',
                  height: '38px',
                  margin: '0 auto 1rem',
                  border: '3px solid #E2E8F0',
                  borderTopColor: '#2563EB',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite'
                }} />
                <div style={{ fontWeight: 800, fontSize: '1rem', color: '#0F172A' }}>Loading Complete Student Academic Records...</div>
                <div style={{ fontSize: '0.82rem', color: '#64748B', marginTop: '0.35rem' }}>
                  Syncing full curriculum and grade records directly from database
                </div>
              </div>
            ) : (
              <>
                {/* View Switcher & Term Tabs */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Calendar size={16} color="var(--primary)" />
                      Grade Breakdown
                    </div>

                    {/* View Mode Toggle Pill */}
                    <div style={{ display: 'inline-flex', background: '#F1F5F9', padding: '3px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                      <button
                        type="button"
                        onClick={() => {
                          setHistoryViewMode('curriculum');
                          setActiveHistoryTermTab('ALL');
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px',
                          fontSize: '0.72rem',
                          padding: '3px 10px',
                          borderRadius: '6px',
                          fontWeight: 700,
                          border: 'none',
                          cursor: 'pointer',
                          background: historyViewMode === 'curriculum' ? '#FFFFFF' : 'transparent',
                          color: historyViewMode === 'curriculum' ? '#1D4ED8' : '#64748B',
                          boxShadow: historyViewMode === 'curriculum' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                        }}
                      >
                        <Layers size={12} /> Curriculum View (Official)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setHistoryViewMode('chronological');
                          setActiveHistoryTermTab('ALL');
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px',
                          fontSize: '0.72rem',
                          padding: '3px 10px',
                          borderRadius: '6px',
                          fontWeight: 700,
                          border: 'none',
                          cursor: 'pointer',
                          background: historyViewMode === 'chronological' ? '#FFFFFF' : 'transparent',
                          color: historyViewMode === 'chronological' ? '#1D4ED8' : '#64748B',
                          boxShadow: historyViewMode === 'chronological' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                        }}
                      >
                        <Clock size={12} /> Enrollment Log (Chronological)
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => setActiveHistoryTermTab('ALL')}
                      style={{
                        fontSize: '0.75rem',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        background: activeHistoryTermTab === 'ALL' ? '#2563EB' : '#F1F5F9',
                        color: activeHistoryTermTab === 'ALL' ? '#FFFFFF' : '#475569',
                        border: 'none'
                      }}
                    >
                      All {historyViewMode === 'curriculum' ? 'Semesters' : 'Terms'} ({activeDisplayTerms.length})
                    </button>
                    {activeDisplayTerms.map(termKey => {
                      const count = (activeDisplayHistoryMap[termKey] || []).length;
                      return (
                        <button
                          key={termKey}
                          type="button"
                          onClick={() => setActiveHistoryTermTab(termKey)}
                          style={{
                            fontSize: '0.75rem',
                            padding: '4px 10px',
                            borderRadius: '6px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            background: activeHistoryTermTab === termKey ? '#2563EB' : '#F1F5F9',
                            color: activeHistoryTermTab === termKey ? '#FFFFFF' : '#475569',
                            border: 'none'
                          }}
                        >
                          {termKey} ({count})
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* SEPARATE SEMESTER TABLES */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {activeDisplayTerms
                    .filter(termKey => activeHistoryTermTab === 'ALL' || activeHistoryTermTab === termKey)
                    .map(termKey => {
                      const termGrades = activeDisplayHistoryMap[termKey] || [];
                      const validTermGrades = termGrades.filter(g => g.status !== 'dropped' && g.status !== 'not_taken' && g.grade !== null && !isNaN(Number(g.grade)));
                      const termPts = validTermGrades.reduce((sum, g) => sum + (Number(g.grade) * Number(g.units || 3)), 0);
                      const termUnits = validTermGrades.reduce((sum, g) => sum + Number(g.units || 3), 0);
                      const termGwa = termUnits > 0 ? (termPts / termUnits).toFixed(2) : '0.00';
                      const termPassedCount = termGrades.filter(g => g.status === 'passed').length;
                      const termFailedCount = termGrades.filter(g => g.status === 'failed').length;
                      const termDroppedCount = termGrades.filter(g => g.status === 'dropped' || g.isDropped).length;
                      const termNotTakenCount = termGrades.filter(g => g.status === 'not_taken').length;

                      return (
                        <div key={termKey} style={{ border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden', background: '#FFFFFF' }}>
                          {/* Term Card Header */}
                          <div style={{ padding: '0.75rem 1rem', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                            <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                              <BookOpen size={15} color="#2563EB" />
                              <span>{termKey}</span>
                              <span style={{ fontSize: '0.72rem', background: '#EFF6FF', color: '#1D4ED8', padding: '1px 7px', borderRadius: '4px', fontWeight: 700 }}>
                                {termGrades.length} Subjects
                              </span>
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                              {termPassedCount > 0 && (
                                <span style={{ fontSize: '0.75rem', color: '#166534', fontWeight: 800, background: '#DCFCE7', padding: '2px 8px', borderRadius: '6px' }}>
                                  {termPassedCount} Passed
                                </span>
                              )}
                              {termFailedCount > 0 && (
                                <span style={{ fontSize: '0.75rem', color: '#B91C1C', fontWeight: 800, background: '#FEE2E2', padding: '2px 8px', borderRadius: '6px' }}>
                                  {termFailedCount} Failed
                                </span>
                              )}
                              {termDroppedCount > 0 && (
                                <span style={{ fontSize: '0.75rem', color: '#B45309', fontWeight: 800, background: '#FEF3C7', padding: '2px 8px', borderRadius: '6px' }}>
                                  {termDroppedCount} Dropped (DRP)
                                </span>
                              )}
                              {termNotTakenCount > 0 && (
                                <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 700, background: '#F1F5F9', padding: '2px 8px', borderRadius: '6px' }}>
                                  {termNotTakenCount} Untaken
                                </span>
                              )}
                              {termUnits > 0 && (
                                <div style={{ fontSize: '0.76rem', color: '#1D4ED8', fontWeight: 800, background: '#EFF6FF', padding: '2px 8px', borderRadius: '6px', border: '1px solid #BFDBFE' }}>
                                  Semester GWA: {termGwa} • {termUnits} Units
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Term Table */}
                          <table className="custom-table" style={{ fontSize: '0.82rem', margin: 0 }}>
                            <thead>
                              <tr>
                                <th>Cat No.</th>
                                <th>Descriptive Course Title</th>
                                <th style={{ textAlign: 'center' }}>Units</th>
                                <th style={{ textAlign: 'center' }}>Grade</th>
                                <th>Status</th>
                                <th style={{ textAlign: 'center' }}>Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {termGrades.map(g => {
                                const isDropped = g.status === 'dropped' || g.isDropped;
                                const isNotTaken = g.status === 'not_taken';
                                const isFailed = !isDropped && !isNotTaken && (g.status === 'failed' || (g.grade !== null && Number(g.grade) > 3.0) || g.grade === 5);
                                const isPassed = !isDropped && !isNotTaken && (g.status === 'passed' && g.grade !== null && Number(g.grade) <= 3.0);
                                const isRetake = Boolean(g.isRetake);

                                return (
                                  <tr key={g.id} style={{
                                    background: isFailed ? 'rgba(254, 242, 242, 0.4)' : (isDropped ? 'rgba(254, 243, 199, 0.25)' : (isNotTaken ? '#FAFAFA' : undefined))
                                  }}>
                                    <td style={{ fontWeight: 800, color: isFailed ? '#DC2626' : (isDropped ? '#D97706' : (isNotTaken ? '#94A3B8' : '#2563EB')) }}>
                                      {g.code}
                                    </td>
                                    <td>
                                      <div style={{ fontWeight: 600, color: isNotTaken ? '#64748B' : '#1E293B' }}>{g.title}</div>
                                      {g.attempts && g.attempts.length > 1 && isRetake && (
                                        <div style={{ fontSize: '0.72rem', color: '#475569', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                                          <History size={11} color="#2563EB" />
                                          <span style={{ background: '#EFF6FF', color: '#1D4ED8', padding: '1px 5px', borderRadius: '4px', fontWeight: 700, fontSize: '0.68rem' }}>
                                            {g.attempts.length} attempts
                                          </span>
                                          <span>
                                            {g.attempts.map(att => `${att.term}: ${att.status === 'dropped' ? 'DRP' : (att.grade !== null && att.grade !== undefined ? Number(att.grade).toFixed(2) : att.status)}`).join(' ➔ ')}
                                          </span>
                                        </div>
                                      )}
                                    </td>
                                    <td style={{ textAlign: 'center', fontWeight: 700, color: isNotTaken ? '#94A3B8' : undefined }}>{g.units}</td>
                                    <td style={{ textAlign: 'center', fontWeight: 850, fontSize: '0.9rem' }}>
                                      {isDropped ? (
                                        <span style={{ color: '#D97706', fontWeight: 800 }}>DRP</span>
                                      ) : isNotTaken ? (
                                        <span style={{ color: '#94A3B8' }}>—</span>
                                      ) : isFailed ? (
                                        <span style={{ color: '#DC2626' }}>{Number(g.grade).toFixed(2)}</span>
                                      ) : isPassed ? (
                                        <span style={{ color: '#16A34A' }}>{Number(g.grade).toFixed(2)}</span>
                                      ) : (
                                        <span>—</span>
                                      )}
                                    </td>
                                    <td>
                                      {isDropped ? (
                                        <span className="badge" style={{ fontSize: '0.72rem', background: '#FEF3C7', color: '#B45309', border: '1px solid #FDE68A' }}>
                                          Dropped (DRP)
                                        </span>
                                      ) : isNotTaken ? (
                                        <span className="badge" style={{ fontSize: '0.72rem', background: '#F1F5F9', color: '#64748B', border: '1px solid #E2E8F0' }}>
                                          Not Yet Taken
                                        </span>
                                      ) : isFailed ? (
                                        <span className="badge badge-failed" style={{ fontSize: '0.72rem', background: '#FEE2E2', color: '#DC2626', border: '1px solid #FECACA' }}>
                                          Failed (5.00)
                                        </span>
                                      ) : isPassed ? (
                                        <span
                                          className="badge badge-passed"
                                          style={{
                                            fontSize: '0.72rem',
                                            background: isRetake ? '#EFF6FF' : undefined,
                                            color: isRetake ? '#1D4ED8' : undefined,
                                            border: isRetake ? '1px solid #BFDBFE' : undefined
                                          }}
                                        >
                                          {isRetake ? 'Passed (Retake Cleared)' : 'Passed'}
                                        </span>
                                      ) : (
                                        <span className="badge" style={{ fontSize: '0.72rem' }}>Pending</span>
                                      )}
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                      {!isNotTaken ? (
                                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                          <button
                                            type="button"
                                            onClick={() => handleOpenEditGradeModal(g)}
                                            style={{
                                              background: 'none',
                                              border: '1px solid var(--border-color)',
                                              borderRadius: '5px',
                                              padding: '2px 6px',
                                              cursor: 'pointer',
                                              color: 'var(--text-main)'
                                            }}
                                            title="Edit Grade Record"
                                          >
                                            <Pencil size={12} />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setDeletingGradeRecord(g);
                                              setShowDeleteGradeModal(true);
                                            }}
                                            style={{
                                              background: 'none',
                                              border: '1px solid #FECACA',
                                              borderRadius: '5px',
                                              padding: '2px 6px',
                                              cursor: 'pointer',
                                              color: '#DC2626'
                                            }}
                                            title="Delete Grade Record"
                                          >
                                            <Trash2 size={12} />
                                          </button>
                                        </div>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => handleOpenAddGradeForStudent(selectedHistoryStudent, g)}
                                          style={{
                                            background: 'none',
                                            border: '1px dashed #CBD5E1',
                                            borderRadius: '5px',
                                            padding: '2px 6px',
                                            cursor: 'pointer',
                                            color: '#64748B'
                                          }}
                                          title={`Encode Grade for ${g.code} (${g.title})`}
                                        >
                                          <Plus size={12} />
                                        </button>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      );
                    })}
                </div>
              </>
            )}

            {/* Modal Footer */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #E2E8F0' }}>
              <button
                type="button"
                onClick={() => handleOpenAddGradeForStudent(selectedHistoryStudent)}
                className="btn btn-secondary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem' }}
              >
                <Plus size={15} color="var(--primary)" /> Encode New Grade Record
              </button>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowHistoryModal(false);
                    handleOpenAdvisingSlip(selectedHistoryStudent);
                  }}
                  className="btn btn-secondary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
                >
                  <FileCheck size={14} color="#16A34A" /> Generate Advising Slip
                </button>

                <button
                  type="button"
                  onClick={() => setShowHistoryModal(false)}
                  className="btn btn-primary"
                  style={{ fontSize: '0.85rem' }}
                >
                  Close Transcript
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 4: OFFICIAL ADVISING SLIP PREVIEW MODAL             */}
      {/* ========================================================= */}
      {showAdvisingModal && advisingStudent && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(5px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem'
        }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '640px', padding: '2rem', background: '#FFFFFF', borderRadius: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <img src="/logo.png" alt="GCT Logo" style={{ width: '45px', height: '45px', objectFit: 'contain' }} />
                <div>
                  <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>Garcia College of Technology</h4>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Official Academic Advising Slip • Registrar Office</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAdvisingModal(false)}
                style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ background: '#F8FAFC', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '1rem', marginBottom: '1.25rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.82rem' }}>
                <div><strong>Student Name:</strong> {advisingStudent.name}</div>
                <div><strong>Student ID:</strong> {advisingStudent.student_id}</div>
                <div><strong>Program:</strong> {advisingStudent.program}</div>
                <div><strong>Year Level:</strong> Year {advisingStudent.year}</div>
              </div>
            </div>

            <div style={{ border: '1px solid var(--border-color)', borderRadius: '10px', overflow: 'hidden', marginBottom: '1.25rem', maxHeight: '320px', overflowY: 'auto' }}>
              <table className="custom-table" style={{ fontSize: '0.8rem', margin: 0 }}>
                <thead>
                  <tr>
                    <th>Cat No.</th>
                    <th>Subject Description</th>
                    <th style={{ textAlign: 'center' }}>Units</th>
                    <th style={{ textAlign: 'center' }}>Grade</th>
                    <th>Status / Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {studentAcademicHistoryGrades.map(g => {
                    const isDropped = g.status === 'dropped' || g.isDropped;
                    const isNotTaken = g.status === 'not_taken';
                    const isFailed = !isDropped && !isNotTaken && (g.status === 'failed' || (g.grade !== null && Number(g.grade) > 3.0) || g.grade === 5);
                    const isPassed = !isDropped && !isNotTaken && (g.status === 'passed' && g.grade !== null && Number(g.grade) <= 3.0);
                    return (
                      <tr key={g.id} style={{ background: isFailed ? 'rgba(254, 242, 242, 0.4)' : undefined }}>
                        <td style={{ fontWeight: 800, color: isFailed ? '#DC2626' : (isNotTaken ? '#94A3B8' : '#2563EB') }}>{g.code}</td>
                        <td style={{ fontWeight: 600, color: isNotTaken ? '#64748B' : undefined }}>{g.title}</td>
                        <td style={{ textAlign: 'center', fontWeight: 700 }}>{g.units}</td>
                        <td style={{ textAlign: 'center', fontWeight: 850, color: isFailed ? '#DC2626' : (isPassed ? '#16A34A' : '#94A3B8') }}>
                          {isDropped ? 'DRP' : isNotTaken ? '—' : (g.grade !== null && g.grade !== undefined ? Number(g.grade).toFixed(2) : '—')}
                        </td>
                        <td>
                          {isNotTaken ? (
                            <span className="badge" style={{ fontSize: '0.72rem', background: '#F1F5F9', color: '#64748B', border: '1px solid #CBD5E1' }}>
                              Pending Enrollment
                            </span>
                          ) : isDropped ? (
                            <span className="badge" style={{ fontSize: '0.72rem', background: '#FEF3C7', color: '#B45309', border: '1px solid #FDE68A' }}>
                              Dropped (DRP) • Retake Required
                            </span>
                          ) : isFailed ? (
                            <span className="badge badge-failed" style={{ fontSize: '0.72rem' }}>
                              Deficiency • Retake Required
                            </span>
                          ) : (
                            <span className="badge badge-passed" style={{ fontSize: '0.72rem' }}>
                              {g.isRetake ? 'Satisfied (Retake Cleared)' : 'Satisfied Prerequisite'}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => exportOfficialAdvisingSlip({
                  name: advisingStudent.name,
                  studentId: advisingStudent.student_id,
                  program: advisingStudent.program,
                  yearLevel: `Year ${advisingStudent.year}`,
                  term: '2025-2026 1st Sem',
                  recommendations: studentAcademicHistoryGrades
                    .map(g => ({
                      code: g.code,
                      title: g.title,
                      units: g.units,
                      reason: g.status === 'failed' ? 'retake' : 'recommended',
                      notes: g.status === 'passed' ? 'Completed' : 'Prerequisite Requirement'
                    }))
                })}
                className="btn btn-secondary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
              >
                <Download size={14} /> Download Excel Advising Slip
              </button>
              <button
                type="button"
                onClick={() => setShowAdvisingModal(false)}
                className="btn btn-primary"
                style={{ fontSize: '0.85rem' }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 5: FAST EXCEL / CSV UPLOAD MODAL                    */}
      {/* ========================================================= */}
      {showUploadModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(5px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem'
        }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto', padding: '2rem', background: '#FFFFFF', borderRadius: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FileSpreadsheet size={22} color="var(--primary)" />
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: '#0F172A' }}>
                  Import {uploadTargetType === 'students' ? 'Student Roster' : 'Academic Grade Sheets'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Target Type Switcher */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
              <button
                type="button"
                onClick={() => {
                  setUploadTargetType('students');
                  setIsCsvUploaded(false);
                }}
                className="btn"
                style={{
                  flex: 1,
                  fontSize: '0.8rem',
                  padding: '0.5rem',
                  background: uploadTargetType === 'students' ? '#EFF6FF' : '#F8FAFC',
                  color: uploadTargetType === 'students' ? 'var(--primary)' : 'var(--text-muted)',
                  border: uploadTargetType === 'students' ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                  fontWeight: 700
                }}
              >
                Student Records
              </button>
              <button
                type="button"
                onClick={() => {
                  setUploadTargetType('grades');
                  setIsCsvUploaded(false);
                }}
                className="btn"
                style={{
                  flex: 1,
                  fontSize: '0.8rem',
                  padding: '0.5rem',
                  background: uploadTargetType === 'grades' ? '#EFF6FF' : '#F8FAFC',
                  color: uploadTargetType === 'grades' ? 'var(--primary)' : 'var(--text-muted)',
                  border: uploadTargetType === 'grades' ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                  fontWeight: 700
                }}
              >
                Academic Grade Sheets
              </button>
            </div>

            {/* Drag & Drop File Zone */}
            <div style={{
              background: '#F8FAFC',
              border: '2px dashed var(--border-color)',
              borderRadius: '12px',
              padding: '1.75rem',
              textAlign: 'center',
              position: 'relative',
              marginBottom: '1.25rem'
            }}>
              <input
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleSimulateFileUpload}
                style={{
                  position: 'absolute',
                  top: 0, left: 0, width: '100%', height: '100%',
                  opacity: 0, cursor: 'pointer'
                }}
              />
              <FileSpreadsheet size={36} color="var(--primary)" style={{ margin: '0 auto 0.5rem' }} />
              <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#0F172A' }}>
                {uploadedFileName || 'Drop Excel (.xlsx, .xls) or CSV file here'}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                Supports large datasets (10,000+ rows optimized with fast slicing preview)
              </div>
            </div>

            {/* Fast Sliced Preview Table */}
            {isCsvUploaded && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-main)' }}>
                    Parsed Records: {uploadTargetType === 'students' ? parsedUploadStudents.length : csvPreviewRows.length} detected
                  </div>
                  <span style={{ fontSize: '0.72rem', background: '#EFF6FF', color: 'var(--primary)', padding: '0.2rem 0.6rem', borderRadius: '6px', fontWeight: 700 }}>
                    Showing first 50 rows (Fast Preview Mode)
                  </span>
                </div>

                <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px', marginBottom: '1.25rem' }}>
                  <table className="custom-table" style={{ fontSize: '0.78rem', margin: 0 }}>
                    <thead>
                      <tr>
                        {uploadTargetType === 'students' ? (
                          <>
                            <th>Student ID</th>
                            <th>Full Name</th>
                            <th>Program</th>
                            <th>Year</th>
                          </>
                        ) : (
                          <>
                            <th>Student ID</th>
                            <th>Name</th>
                            <th>Subject</th>
                            <th>Units</th>
                            <th>Grade</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {uploadTargetType === 'students'
                        ? parsedUploadStudents.slice(0, 50).map((st, i) => (
                          <tr key={i}>
                            <td style={{ fontWeight: 700 }}>{st.student_id}</td>
                            <td>{st.name}</td>
                            <td>{st.program}</td>
                            <td>{st.year}</td>
                          </tr>
                        ))
                        : csvPreviewRows.slice(0, 50).map((r, i) => (
                          <tr key={i}>
                            <td style={{ fontWeight: 700 }}>{r.studentId}</td>
                            <td>{r.name}</td>
                            <td>{r.code}</td>
                            <td>{r.units}</td>
                            <td style={{ fontWeight: 800 }}>{r.grade || '—'}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCsvUploaded(false);
                      setUploadedFileName('');
                    }}
                    className="btn btn-secondary"
                    style={{ fontSize: '0.85rem' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleCommitUpload}
                    disabled={isCommittingUpload}
                    className="btn btn-primary"
                    style={{ fontSize: '0.85rem' }}
                  >
                    {isCommittingUpload ? 'Saving to Database...' : 'Commit Import to Database'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 6: DELETE CONFIRMATION MODALS                       */}
      {/* ========================================================= */}
      {showDeleteStudentModal && deletingStudent && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem'
        }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '420px', padding: '1.75rem', background: '#FFFFFF', borderRadius: '16px', textAlign: 'center' }}>
            <AlertTriangle size={36} color="#DC2626" style={{ margin: '0 auto 0.75rem' }} />
            <h4 style={{ margin: '0 0 0.5rem', fontSize: '1.1rem', fontWeight: 800, color: '#0F172A' }}>Confirm Deletion</h4>
            <p style={{ fontSize: '0.82rem', color: '#64748B', lineHeight: 1.5, marginBottom: '1.25rem' }}>
              Are you sure you want to remove <strong>{deletingStudent.name}</strong> ({deletingStudent.student_id}) from the student roster?
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={() => setShowDeleteStudentModal(false)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteStudent}
                style={{
                  background: '#DC2626',
                  color: '#FFFFFF',
                  border: 'none',
                  padding: '0.55rem 1.25rem',
                  borderRadius: '8px',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer'
                }}
              >
                Delete Student
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteGradeModal && deletingGradeRecord && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          zIndex: 10600,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem'
        }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '420px', padding: '1.75rem', background: '#FFFFFF', borderRadius: '16px', textAlign: 'center' }}>
            <AlertTriangle size={36} color="#DC2626" style={{ margin: '0 auto 0.75rem' }} />
            <h4 style={{ margin: '0 0 0.5rem', fontSize: '1.1rem', fontWeight: 800, color: '#0F172A' }}>Confirm Grade Deletion</h4>
            <p style={{ fontSize: '0.82rem', color: '#64748B', lineHeight: 1.5, marginBottom: '1.25rem' }}>
              Are you sure you want to delete the grade record for <strong>{deletingGradeRecord.code}</strong> ({deletingGradeRecord.studentName})?
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={() => setShowDeleteGradeModal(false)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteGrade}
                style={{
                  background: '#DC2626',
                  color: '#FFFFFF',
                  border: 'none',
                  padding: '0.55rem 1.25rem',
                  borderRadius: '8px',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer'
                }}
              >
                Delete Grade
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentAcademicRecordsModule;
