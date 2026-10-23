import React, { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useRegistrarData } from './RegistrarDataContext';
import { PROGRAM_CATALOG, GCT_GRADE_SCALE } from './mockData';
import type { AcademicGrade, CsvPreviewRow } from './types';
import { fetchApi } from '../config/api';
import {
  parseExcelOrCsvFile,
  downloadAcademicRecordsTemplate,
  exportAcademicProgressExcel
} from '../utils/exportUtils';
import {
  Search,
  Send,
  Upload,
  Plus,
  Users,
  BookOpen,
  School,
  Award,
  Eye,
  Pencil,
  Trash2,
  Filter,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  AlertTriangle,
  X,
  FileSpreadsheet,
  Image,
  Loader2,
  Download,
  CheckCircle2,
  Calendar
} from 'lucide-react';

interface AcademicRecordsModuleProps {
  showUploadModalExternal?: boolean;
  setShowUploadModalExternal?: (show: boolean) => void;
}

export const AcademicRecordsModule: React.FC<AcademicRecordsModuleProps> = ({
  showUploadModalExternal,
  setShowUploadModalExternal
}) => {
  const { user } = useAuth();
  const {
    mockStudents,
    mockAcademicGrades,
    setMockAcademicGrades,
    csvPreviewRows,
    setCsvPreviewRows,
    ocrDetectedRows,
    curriculumSubjects,
    getSchedules,
    addSchedule,
    deleteSchedule,
    showToast,
    refreshAcademicGrades,
    refreshStudents,
    activeAcademicYear
  } = useRegistrarData();

  // Filter & Navigation States
  const [recordSearch, setRecordSearch] = useState('');
  const [recordTermFilter, setRecordTermFilter] = useState('ALL');
  const [recordStatusFilter, setRecordStatusFilter] = useState('ALL');

  // Course Navigation View States
  const [acadRecordViewMode, setAcadRecordViewMode] = useState<'all' | 'course'>('all');
  const [selectedAcadCourseCode, setSelectedAcadCourseCode] = useState<string | null>(null);
  const [selectedAcadYearLevel, setSelectedAcadYearLevel] = useState<number | null>(null);
  const [selectedAcadSchedule, setSelectedAcadSchedule] = useState<string | null>(null);
  const [activeAcadDropdownCourse, setActiveAcadDropdownCourse] = useState<string | null>(null);
  const [activeAcadFlyoutYear, setActiveAcadFlyoutYear] = useState<number | null>(null);

  // Grade Encoding / Editing Form State
  const [showEncodeModal, setShowEncodeModal] = useState(false);
  const [gradeModalMode, setGradeModalMode] = useState<'add' | 'edit'>('add');
  const [gradeFormRecordId, setGradeFormRecordId] = useState('');
  const [gradeFormStudentId, setGradeFormStudentId] = useState('');
  const [studentSearchInput, setStudentSearchInput] = useState('');
  const [showStudentSuggestions, setShowStudentSuggestions] = useState(false);
  const [gradeFormCode, setGradeFormCode] = useState('IT 101');
  const [gradeFormTitle, setGradeFormTitle] = useState('Introduction to Computing');
  const [gradeFormUnits, setGradeFormUnits] = useState<number>(3);
  const [gradeFormGrade, setGradeFormGrade] = useState('1.75');
  const [gradeFormTerm, setGradeFormTerm] = useState('2024-2025 1st Sem');
  const [gradeFormStatus, setGradeFormStatus] = useState<'passed' | 'failed'>('passed');
  const [encodingSuccess, setEncodingSuccess] = useState('');

  // Delete Grade Record State
  const [showDeleteGradeModal, setShowDeleteGradeModal] = useState(false);
  const [deletingGradeRecord, setDeletingGradeRecord] = useState<any>(null);

  // Subject Picker Modal States
  const [showSubjectPickerModal, setShowSubjectPickerModal] = useState(false);
  const [subjectPickerStudent, setSubjectPickerStudent] = useState<any>(null);
  const [subjectPickerMode, setSubjectPickerMode] = useState<'edit' | 'delete'>('edit');

  // Release Grades Modal States
  const [showReleaseModal, setShowReleaseModal] = useState(false);
  const [showReleaseEditWarningModal, setShowReleaseEditWarningModal] = useState(false);
  const [pendingEditRecord, setPendingEditRecord] = useState<any>(null);
  const [releaseSuccess, setReleaseSuccess] = useState('');

  // Upload Records Modal States
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [internalUploadModal, setInternalUploadModal] = useState(false);
  const showUploadModal = showUploadModalExternal !== undefined ? showUploadModalExternal : internalUploadModal;
  const setShowUploadModal = setShowUploadModalExternal || setInternalUploadModal;

  const [uploadActiveTab, setUploadActiveTab] = useState<'csv' | 'image'>('csv');
  const [isCsvUploaded, setIsCsvUploaded] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [csvUploadSuccess, setCsvUploadSuccess] = useState('');

  // Real Excel / CSV File Parsing Handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFileName(file.name);
    try {
      const rawRows = await parseExcelOrCsvFile(file);
      if (!rawRows || rawRows.length === 0) {
        setCsvUploadSuccess(`No valid data rows found in "${file.name}".`);
        return;
      }

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

        const studentId = String(findVal('Student ID', 'student_id', 'ID', 'Student ID Number', 'StudentNo', 'id') || `STUDENT-${idx + 1}`).trim();
        const name = String(findVal('Full Name', 'full_name', 'Name', 'Student Name', 'FullName', 'Student') || 'Student Name').trim();
        const course = String(findVal('Course', 'course', 'Program', 'program', 'Degree Program', 'Degree') || 'BSIT').trim();
        const yearVal = findVal('Year Level', 'year_level', 'Year', 'Yr', 'YearLevel', 'year');
        const year = Number(yearVal) || 1;
        const code = String(findVal('Subject', 'subject', 'Cat No.', 'Cat No', 'Subject Code', 'Code', 'code', 'SubjectCode', 'CatNo') || 'IT 101').trim();
        const title = String(findVal('Descriptive Title', 'Title', 'Subject Title', 'Description', 'DescriptiveTitle') || code).trim();
        const unitsVal = findVal('Units', 'units', 'Unit', 'Subject Units');
        const units = Number(unitsVal) || 3;
        const gradeVal = findVal('Grade', 'grade', 'raw_grade', 'Grade (%)', 'Final Grade', 'Mark');
        const grade = gradeVal !== '' && gradeVal != null ? String(gradeVal) : '';

        // Intelligently construct term from semester + academic_year if separate
        const semVal = String(findVal('Semester', 'semester', 'Sem', 'sem')).trim();
        const ayVal = String(findVal('Academic Year', 'academic_year', 'AY', 'ay')).trim();
        let term = String(findVal('Term', 'Academic Term', 'term')).trim();
        if (!term && ayVal) {
          const semClean = /2nd|second/i.test(semVal) ? '2nd Sem' : /summer/i.test(semVal) ? 'Summer' : '1st Sem';
          term = `${ayVal} ${semClean}`;
        } else if (!term) {
          term = recordTermFilter !== 'ALL' ? recordTermFilter : `${activeAcademicYear || '2025-2026'} 1st Sem`;
        }

        const numGrade = grade !== '' ? parseFloat(grade) : null;
        let status: CsvPreviewRow['status'] = 'valid';
        let errorMsg = '';

        if (numGrade !== null && (isNaN(numGrade) || numGrade < 1.0 || numGrade > 5.0)) {
          status = 'invalid_grade';
          errorMsg = 'Grade must be between 1.00 and 5.00';
        } else if (numGrade === null) {
          status = 'valid_pending';
          errorMsg = 'Grade pending encoding';
        }

        const existing = mockAcademicGrades.find(g => g.studentId.toLowerCase() === studentId.toLowerCase() && g.code.toLowerCase() === code.toLowerCase());
        if (existing && status === 'valid') {
          status = 'will_update';
          errorMsg = 'Will update existing grade record';
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
      setCsvUploadSuccess(`Successfully parsed ${parsedPreview.length} records from "${file.name}"!`);
    } catch (err: any) {
      console.error('Failed to parse Excel/CSV file:', err);
      setCsvUploadSuccess(`Error parsing file: ${err?.message || 'Invalid format'}`);
    }
  };

  // Image OCR Auto-Encode States
  const [isOcrProcessing, setIsOcrProcessing] = useState(false);
  const [isOcrUploaded, setIsOcrUploaded] = useState(false);
  const [ocrSuccess, setOcrSuccess] = useState('');

  // Academic History Modal States
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedHistoryStudent, setSelectedHistoryStudent] = useState<any>(null);
  const [activeHistoryYearAccordion, setActiveHistoryYearAccordion] = useState<number | null>(null);

  // Joined Grade Records
  const joinedGradeRecords = mockAcademicGrades.map(g => {
    const student = mockStudents.find(s => s.student_id === g.studentId);
    const course = student?.program || (g.code.startsWith('CS') ? 'BSCS' : 'BSIT');
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

  // Filtered Grade Records
  const filteredGradeRecords = joinedGradeRecords.filter(rec => {
    const matchesSearch = !recordSearch ||
      rec.studentId.toLowerCase().includes(recordSearch.toLowerCase()) ||
      rec.studentName.toLowerCase().includes(recordSearch.toLowerCase()) ||
      rec.code.toLowerCase().includes(recordSearch.toLowerCase()) ||
      rec.title.toLowerCase().includes(recordSearch.toLowerCase());

    const matchesTerm = recordTermFilter === 'ALL' || rec.term === recordTermFilter;
    const matchesStatus = recordStatusFilter === 'ALL' || rec.status === recordStatusFilter;

    if (acadRecordViewMode === 'course') {
      if (selectedAcadCourseCode !== null && selectedAcadYearLevel !== null && selectedAcadSchedule !== null) {
        const matchesCourse = rec.course === selectedAcadCourseCode;
        const matchesYear = rec.yearLevel === selectedAcadYearLevel;
        const matchesSchedule = rec.schedule === selectedAcadSchedule;
        return matchesCourse && matchesYear && matchesSchedule && matchesSearch && matchesTerm && matchesStatus;
      }
      return false;
    }

    return matchesSearch && matchesTerm && matchesStatus;
  });

  const handleOpenAddGradeModal = () => {
    setGradeModalMode('add');
    setGradeFormRecordId('');
    setGradeFormStudentId('');
    setStudentSearchInput('');
    setShowStudentSuggestions(false);
    setGradeFormCode('');
    setGradeFormTitle('');
    setGradeFormUnits(3);
    setGradeFormGrade('1.75');
    setGradeFormTerm('2024-2025 1st Sem');
    setGradeFormStatus('passed');
    setEncodingSuccess('');
    setShowEncodeModal(true);
  };

  const handleOpenEditGradeModal = (rec: any) => {
    setGradeModalMode('edit');
    setGradeFormRecordId(rec.id);
    setGradeFormStudentId(rec.studentId);
    const stObj = mockStudents.find(s => s.student_id === rec.studentId);
    setStudentSearchInput(stObj ? `${stObj.name} (${stObj.student_id})` : rec.studentName);
    setShowStudentSuggestions(false);
    setGradeFormCode(rec.code);
    setGradeFormTitle(rec.title || '');
    setGradeFormUnits(rec.units || 3);
    const numGradeStr = rec.grade != null ? Number(rec.grade).toFixed(2) : '1.75';
    setGradeFormGrade(numGradeStr);
    setGradeFormTerm(rec.term || '2024-2025 1st Sem');
    const numG = rec.grade != null ? Number(rec.grade) : 1.75;
    setGradeFormStatus(numG <= 3.0 ? 'passed' : 'failed');
    setEncodingSuccess('');
    setShowEncodeModal(true);
  };

  const handleSaveGradeRecord = (e: React.FormEvent) => {
    e.preventDefault();
    const stObj = mockStudents.find(s => s.student_id === gradeFormStudentId);
    const studentName = stObj ? stObj.name : studentSearchInput || 'Unknown Student';
    const parsedGrade = parseFloat(gradeFormGrade) || 1.75;
    const computedStatus = parsedGrade <= 3.0 ? 'passed' : 'failed';
    const yearLevel = stObj ? stObj.year : 1;

    if (gradeModalMode === 'add') {
      const newGrade: AcademicGrade = {
        id: 'g-' + Date.now(),
        studentId: gradeFormStudentId,
        studentName: studentName,
        code: gradeFormCode,
        title: gradeFormTitle,
        units: Number(gradeFormUnits) || 3,
        grade: parsedGrade,
        term: gradeFormTerm,
        yearLevel: yearLevel,
        status: computedStatus
      };
      setMockAcademicGrades(prev => [newGrade, ...prev]);
      setEncodingSuccess(`Grade record for ${gradeFormCode} (${parsedGrade.toFixed(2)}) successfully encoded for ${studentName}!`);
      try {
        fetchApi('/academic-records', {
          method: 'POST',
          body: JSON.stringify({
            student_id: gradeFormStudentId,
            studentName: studentName,
            subject_id: gradeFormCode,
            title: gradeFormTitle,
            units: Number(gradeFormUnits) || 3,
            grade: parsedGrade,
            term: gradeFormTerm
          })
        });
      } catch (err) {
        console.warn('Backend sync warning:', err);
      }
    } else {
      setMockAcademicGrades(prev => prev.map(g => {
        if (g.id === gradeFormRecordId) {
          return {
            ...g,
            studentId: gradeFormStudentId,
            studentName: studentName,
            code: gradeFormCode,
            title: gradeFormTitle,
            units: Number(gradeFormUnits) || 3,
            grade: parsedGrade,
            term: gradeFormTerm,
            yearLevel: yearLevel,
            status: computedStatus
          };
        }
        return g;
      }));
      setEncodingSuccess(`Grade record for ${gradeFormCode} (${parsedGrade.toFixed(2)}) successfully updated!`);
      try {
        fetchApi('/academic-records', {
          method: 'POST',
          body: JSON.stringify({
            record_id: gradeFormRecordId,
            student_id: gradeFormStudentId,
            studentName: studentName,
            subject_id: gradeFormCode,
            title: gradeFormTitle,
            units: Number(gradeFormUnits) || 3,
            grade: parsedGrade,
            term: gradeFormTerm
          })
        });
      } catch (err) {
        console.warn('Backend sync warning:', err);
      }
    }

    setTimeout(() => {
      setEncodingSuccess('');
      setShowEncodeModal(false);
    }, 1200);
  };

  const handleDownloadTemplate = (format: 'xlsx' | 'csv' = 'xlsx') => {
    downloadAcademicRecordsTemplate(format);
  };

  const handleConfirmCsvUpload = async () => {
    const importableRows = csvPreviewRows.filter(r => r.status === 'valid' || r.status === 'valid_pending' || r.status === 'will_update');

    if (importableRows.length === 0) {
      setCsvUploadSuccess('No valid rows available to import.');
      return;
    }

    setMockAcademicGrades(prev => {
      let updatedGrades = [...prev];

      importableRows.forEach((r, idx) => {
        const parsedGrade = (r.grade !== '' && r.grade != null) ? parseFloat(String(r.grade)) : null;
        const computedStatus = parsedGrade == null ? 'pending' : parsedGrade <= 3.0 ? 'passed' : 'failed';

        const existingIdx = updatedGrades.findIndex(g => g.studentId.toLowerCase() === r.studentId.toLowerCase() && g.code.toLowerCase() === r.code.toLowerCase());

        if (existingIdx >= 0) {
          updatedGrades[existingIdx] = {
            ...updatedGrades[existingIdx],
            studentName: r.name,
            yearLevel: Number(r.year) || updatedGrades[existingIdx].yearLevel,
            title: r.title || updatedGrades[existingIdx].title,
            units: Number(r.units) || updatedGrades[existingIdx].units,
            grade: parsedGrade !== null ? parsedGrade : updatedGrades[existingIdx].grade,
            status: parsedGrade !== null ? computedStatus : updatedGrades[existingIdx].status,
            term: r.term || updatedGrades[existingIdx].term
          };
        } else {
          const newRecord: AcademicGrade = {
            id: 'csv-' + Date.now() + '-' + idx,
            studentId: r.studentId,
            studentName: r.name,
            code: r.code,
            title: r.title,
            units: Number(r.units) || 3,
            grade: parsedGrade,
            term: r.term || '2025-2026 1st Sem',
            yearLevel: Number(r.year) || 1,
            status: computedStatus
          };
          updatedGrades.unshift(newRecord);
        }
      });

      return updatedGrades;
    });

    try {
      const apiPayload = importableRows.map(r => ({
        student_id: r.studentId,
        studentName: r.name,
        code: r.code,
        title: r.title,
        units: Number(r.units) || 3,
        course: r.course || 'BSIT',
        year_level: Number(r.year) || 1,
        grade: r.grade !== '' && r.grade != null ? parseFloat(String(r.grade)) : null,
        term: r.term || `${activeAcademicYear || '2027-2028'} 1st Sem`
      }));
      await fetchApi('/academic-records/batch', {
        method: 'POST',
        body: JSON.stringify({ records: apiPayload })
      });
      if (refreshAcademicGrades) await refreshAcademicGrades();
      if (refreshStudents) await refreshStudents();
    } catch (err) {
      console.warn('Backend batch sync skipped/failed:', err);
    }

    setCsvUploadSuccess(`Successfully imported ${importableRows.length} grade records into database!`);
    setTimeout(() => {
      setCsvUploadSuccess('');
      setShowUploadModal(false);
      setIsCsvUploaded(false);
    }, 1500);
  };

  const handleRunOcrScan = () => {
    setIsOcrProcessing(true);
    setTimeout(() => {
      setIsOcrProcessing(false);
      setIsOcrUploaded(true);
    }, 1200);
  };

  const handleConfirmOcrEncode = async () => {
    const validOcrEntries = ocrDetectedRows.filter(r => r.matchedStudentId !== '');
    const newGrades: AcademicGrade[] = validOcrEntries.map((r, idx) => {
      const st = mockStudents.find(s => s.student_id === r.matchedStudentId);
      return {
        id: 'ocr-' + Date.now() + '-' + idx,
        studentId: r.matchedStudentId,
        studentName: st ? st.name : r.rawName,
        code: r.code,
        title: r.code === 'IT 104' ? 'Data Structures & Algorithms' : r.code === 'CS 201' ? 'Data Structures & Algorithms' : 'Web Systems & Tech',
        units: 3,
        grade: Number(r.grade),
        term: r.term || `${activeAcademicYear || '2027-2028'} 1st Sem`,
        yearLevel: st ? st.year : 1,
        status: Number(r.grade) <= 3.0 ? 'passed' : 'failed'
      };
    });

    setMockAcademicGrades(prev => [...newGrades, ...prev]);

    try {
      const apiPayload = validOcrEntries.map(r => {
        const st = mockStudents.find(s => s.student_id === r.matchedStudentId);
        return {
          student_id: r.matchedStudentId,
          studentName: st ? st.name : r.rawName,
          code: r.code,
          title: r.code === 'IT 104' ? 'Data Structures & Algorithms' : r.code === 'CS 201' ? 'Data Structures & Algorithms' : 'Web Systems & Tech',
          units: 3,
          grade: Number(r.grade),
          term: r.term || `${activeAcademicYear || '2027-2028'} 1st Sem`,
          course: st?.course || 'BSIT',
          year_level: st?.year || 1
        };
      });
      await fetchApi('/academic-records/batch', {
        method: 'POST',
        body: JSON.stringify({ records: apiPayload })
      });
      if (refreshAcademicGrades) await refreshAcademicGrades();
      if (refreshStudents) await refreshStudents();
    } catch (err) {
      console.warn('Backend batch sync skipped/failed for OCR:', err);
    }

    setOcrSuccess(`Successfully auto-encoded ${validOcrEntries.length} student grade entries into database!`);
    setTimeout(() => {
      setOcrSuccess('');
      setShowUploadModal(false);
      setIsOcrUploaded(false);
    }, 1500);
  };

  const handleConfirmReleaseGrades = () => {
    if (selectedAcadCourseCode === null || selectedAcadYearLevel === null || selectedAcadSchedule === null || recordTermFilter === 'ALL') return;

    const courseStudentIds = mockStudents
      .filter(s => s.program === selectedAcadCourseCode && s.year === selectedAcadYearLevel && (s.schedule === selectedAcadSchedule || (!s.schedule && selectedAcadSchedule === 'Schedule 1')))
      .map(s => s.student_id);

    let countReleased = 0;

    setMockAcademicGrades(prev => prev.map(g => {
      if (
        courseStudentIds.includes(g.studentId) &&
        g.yearLevel === selectedAcadYearLevel &&
        g.term === recordTermFilter &&
        g.status !== 'pending' &&
        g.grade != null
      ) {
        countReleased++;
        return {
          ...g,
          released: true,
          releasedAt: '2026-08-22',
          releasedBy: user ? `${user.email} (${user.role})` : 'Registrar Staff'
        };
      }
      return g;
    }));

    setReleaseSuccess(`Successfully released ${countReleased} grade records for ${selectedAcadCourseCode} ${selectedAcadYearLevel === 1 ? '1st Year' : selectedAcadYearLevel === 2 ? '2nd Year' : selectedAcadYearLevel === 3 ? '3rd Year' : '4th Year'} — ${selectedAcadSchedule} (${recordTermFilter})!`);
    setTimeout(() => {
      setReleaseSuccess('');
      setShowReleaseModal(false);
    }, 1500);
  };

  const handleConfirmDeleteGradeRecord = async () => {
    if (!deletingGradeRecord) return;
    const target = deletingGradeRecord;
    try {
      await fetchApi(`/academic-records/${encodeURIComponent(target.id)}?student_id=${encodeURIComponent(target.studentId || '')}&code=${encodeURIComponent(target.code || '')}&term=${encodeURIComponent(target.term || '')}`, {
        method: 'DELETE'
      });
      showToast?.(`Grade record for ${target.code} deleted successfully from database.`, 'info');
    } catch (err: any) {
      console.error('Failed to delete grade record:', err);
      showToast?.(`Could not delete record: ${err.message || 'Error'}`, 'error');
    }
    setMockAcademicGrades(prev => prev.filter(g => g.id !== target.id));
    setShowDeleteGradeModal(false);
    setDeletingGradeRecord(null);
  };

  return (
    <>
      {/* ROW 1: Search input | All Semesters | All Statuses | Release Grades | Upload Records | Encode Grade Record button */}
      <div className="glass-card" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.65rem' }}>
          {/* 1. Search */}
          <div style={{ position: 'relative', width: '220px' }}>
            <input
              type="text"
              placeholder="Search Student ID, Name, Code..."
              value={recordSearch}
              onChange={e => setRecordSearch(e.target.value)}
              className="form-input"
              style={{ paddingLeft: '2.2rem', fontSize: '0.85rem', height: '38px' }}
            />
            <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }} />
          </div>

          {/* 2. All Semesters Dropdown */}
          <select
            value={recordTermFilter}
            onChange={e => setRecordTermFilter(e.target.value)}
            className="form-select"
            style={{ width: '160px', fontSize: '0.85rem', height: '38px' }}
          >
            <option value="ALL">All Semesters</option>
            <option value="2024-2025 1st Sem">2024-2025 1st Sem</option>
            <option value="2024-2025 2nd Sem">2024-2025 2nd Sem</option>
          </select>

          {/* 3. All Statuses Dropdown */}
          <select
            value={recordStatusFilter}
            onChange={e => setRecordStatusFilter(e.target.value)}
            className="form-select"
            style={{ width: '135px', fontSize: '0.85rem', height: '38px' }}
          >
            <option value="ALL">All Statuses</option>
            <option value="passed">Passed</option>
            <option value="failed">Failed</option>
          </select>

          {/* 4. Release Grades Button */}
          <button
            onClick={() => {
              if (selectedAcadCourseCode && selectedAcadYearLevel && selectedAcadSchedule) {
                setShowReleaseModal(true);
              } else {
                setAcadRecordViewMode('course');
              }
            }}
            disabled={recordTermFilter === 'ALL'}
            style={{
              height: '38px',
              padding: '0 0.95rem',
              borderRadius: '8px',
              fontSize: '0.85rem',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              transition: 'all 0.2s ease',
              background: recordTermFilter === 'ALL' ? '#F3F4F6' : '#15803D',
              color: recordTermFilter === 'ALL' ? '#9CA3AF' : '#FFFFFF',
              border: recordTermFilter === 'ALL' ? '1px solid #E5E7EB' : '1px solid #166534',
              cursor: recordTermFilter === 'ALL' ? 'not-allowed' : 'pointer',
              boxShadow: recordTermFilter === 'ALL' ? 'none' : '0 2px 6px rgba(21, 128, 61, 0.25)',
              opacity: recordTermFilter === 'ALL' ? 0.7 : 1
            }}
            title={recordTermFilter === 'ALL' ? 'Select a specific semester to release grades' : 'Release grades to students for this semester'}
          >
            <Send size={16} /> Release Grades
          </button>

          {/* 5. Upload Records Button */}
          <button
            onClick={() => setShowUploadModal(true)}
            className="btn btn-secondary"
            style={{
              height: '38px',
              padding: '0 0.95rem',
              fontSize: '0.85rem',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem'
            }}
          >
            <Upload size={16} /> Upload Records
          </button>

          {/* 5b. Export Records to Excel */}
          <button
            onClick={() => exportAcademicProgressExcel(filteredGradeRecords)}
            className="btn btn-secondary"
            style={{
              height: '38px',
              padding: '0 0.95rem',
              fontSize: '0.85rem',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              background: '#F0FDF4',
              borderColor: '#86EFAC',
              color: '#15803D'
            }}
            title="Export filtered records to Microsoft Excel (.xlsx)"
          >
            <Download size={16} /> Export Excel
          </button>

          {/* 6. Encode Grade Record Button */}
          <button
            onClick={handleOpenAddGradeModal}
            className="btn btn-primary"
            style={{
              height: '38px',
              padding: '0 0.95rem',
              fontSize: '0.85rem',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem'
            }}
          >
            <Plus size={16} /> Encode Grade Record
          </button>
        </div>
      </div>

      {/* ROW 2: All Records tab | Browse by Course tab */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
        <div style={{ display: 'inline-flex', background: '#EFF6FF', padding: '4px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
          <button
            onClick={() => {
              setAcadRecordViewMode('all');
              setSelectedAcadCourseCode(null);
              setSelectedAcadYearLevel(null);
              setSelectedAcadSchedule(null);
              setActiveAcadDropdownCourse(null);
              setActiveAcadFlyoutYear(null);
            }}
            style={{
              padding: '0.55rem 1.15rem',
              borderRadius: '8px',
              border: 'none',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              background: acadRecordViewMode === 'all' ? '#FFFFFF' : 'transparent',
              color: acadRecordViewMode === 'all' ? 'var(--primary)' : 'var(--text-muted)',
              boxShadow: acadRecordViewMode === 'all' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
              transition: 'all 0.2s ease'
            }}
          >
            <Users size={16} />
            All Records
          </button>
          <button
            onClick={() => {
              setAcadRecordViewMode('course');
            }}
            style={{
              padding: '0.55rem 1.15rem',
              borderRadius: '8px',
              border: 'none',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              background: acadRecordViewMode === 'course' ? '#FFFFFF' : 'transparent',
              color: acadRecordViewMode === 'course' ? 'var(--primary)' : 'var(--text-muted)',
              boxShadow: acadRecordViewMode === 'course' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
              transition: 'all 0.2s ease'
            }}
          >
            <BookOpen size={16} />
            Browse by Course
          </button>
        </div>

        {acadRecordViewMode === 'course' && (
          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <School size={15} color="var(--primary)" />
            Select Course → Year List → Schedule Flyout
          </div>
        )}
      </div>

      {/* VIEW MODE 1: ALL RECORDS FLAT TABLE */}
      {acadRecordViewMode === 'all' && (
        <div className="glass-card" style={{ padding: '1.35rem' }}>
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Student ID</th>
                  <th>Name</th>
                  <th>Course</th>
                  <th>Year</th>
                  <th>Cat No.</th>
                  <th>Descriptive Title</th>
                  <th>Units</th>
                  <th>Grade</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredGradeRecords.map(rec => {
                  const yearText = rec.yearLevel === 1 ? '1st Year' : rec.yearLevel === 2 ? '2nd Year' : rec.yearLevel === 3 ? '3rd Year' : '4th Year';

                  return (
                    <tr key={rec.id}>
                      <td style={{ fontWeight: 800, color: 'var(--primary)' }}>{rec.studentId}</td>
                      <td style={{ fontWeight: 700, color: 'var(--text-main)' }}>{rec.studentName}</td>
                      <td>{rec.course}</td>
                      <td>{yearText}</td>
                      <td style={{ fontWeight: 700, color: 'var(--text-main)' }}>{rec.code}</td>
                      <td>{rec.title}</td>
                      <td>{rec.units}</td>
                      <td style={{ fontWeight: 800, color: rec.grade == null ? 'var(--text-muted)' : rec.status === 'passed' ? 'var(--success)' : 'var(--danger)' }}>
                        {rec.grade != null ? Number(rec.grade).toFixed(2) : '—'}
                      </td>
                      <td>
                        <span className={`badge ${rec.status === 'passed' ? 'badge-passed' : rec.status === 'failed' ? 'badge-failed' : 'badge-pending'}`}>
                          {rec.status}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <button
                            onClick={() => handleOpenEditGradeModal(rec)}
                            style={{
                              background: 'var(--bg-main)',
                              border: '1px solid var(--border-color)',
                              borderRadius: '6px',
                              padding: '0.35rem 0.55rem',
                              color: 'var(--primary)',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'all 0.2s ease'
                            }}
                            title="Edit grade record"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            onClick={() => {
                              setDeletingGradeRecord(rec);
                              setShowDeleteGradeModal(true);
                            }}
                            style={{
                              background: '#FEF2F2',
                              border: '1px solid #FCA5A5',
                              borderRadius: '6px',
                              padding: '0.35rem 0.55rem',
                              color: '#DC2626',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'all 0.2s ease'
                            }}
                            title="Delete grade record"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filteredGradeRecords.length === 0 && (
            <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Filter size={32} style={{ marginBottom: '0.5rem', opacity: 0.5 }} />
              <p style={{ fontWeight: 600, margin: 0 }}>No matching academic grade records found 🎉</p>
              <span style={{ fontSize: '0.8rem' }}>Try broadening your search term or filters above.</span>
            </div>
          )}
        </div>
      )}

      {/* VIEW MODE 2: BROWSE BY COURSE */}
      {acadRecordViewMode === 'course' && (
        <>
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Select Course / Program:
            </div>
            <div style={{ display: 'inline-flex', background: '#EFF6FF', padding: '4px', borderRadius: '12px', border: '1px solid var(--border-color)', flexWrap: 'wrap', gap: '4px', position: 'relative' }}>
              {PROGRAM_CATALOG.map(prog => {
                const isSelected = selectedAcadCourseCode === prog.code;
                const isDropdownOpen = activeAcadDropdownCourse === prog.code;

                return (
                  <div key={prog.code} style={{ position: 'relative' }}>
                    <button
                      onClick={() => {
                        if (isDropdownOpen) {
                          setActiveAcadDropdownCourse(null);
                          setActiveAcadFlyoutYear(null);
                        } else {
                          setActiveAcadDropdownCourse(prog.code);
                          setActiveAcadFlyoutYear(null);
                        }
                      }}
                      style={{
                        padding: '0.55rem 1.15rem',
                        borderRadius: '8px',
                        border: 'none',
                        fontWeight: 700,
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.45rem',
                        background: isSelected ? '#FFFFFF' : 'transparent',
                        color: isSelected ? 'var(--primary)' : 'var(--text-muted)',
                        boxShadow: isSelected ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <span>{prog.code}</span>
                      <ChevronDown
                        size={14}
                        style={{
                          transform: isDropdownOpen ? 'rotate(180deg)' : 'none',
                          transition: 'transform 0.2s ease',
                          color: isSelected ? 'var(--primary)' : 'var(--text-muted)'
                        }}
                      />
                    </button>

                    {isDropdownOpen && (
                      <div
                        style={{
                          position: 'absolute',
                          top: 'calc(100% + 6px)',
                          left: 0,
                          zIndex: 100,
                          minWidth: '165px',
                          background: '#FFFFFF',
                          borderRadius: '10px',
                          border: '1px solid var(--border-color)',
                          boxShadow: '0 10px 25px -4px rgba(45, 38, 30, 0.18)',
                          padding: '0.35rem 0',
                          animation: 'fadeIn 0.12s ease'
                        }}
                      >
                        {[1, 2, 3, 4].map(yNum => {
                          const yearText = yNum === 1 ? '1st Year' : yNum === 2 ? '2nd Year' : yNum === 3 ? '3rd Year' : '4th Year';
                          const isFlyoutActive = activeAcadFlyoutYear === yNum;

                          return (
                            <div
                              key={yNum}
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveAcadFlyoutYear(isFlyoutActive ? null : yNum);
                              }}
                              onMouseEnter={() => setActiveAcadFlyoutYear(yNum)}
                              style={{
                                padding: '0.55rem 0.85rem',
                                fontSize: '0.83rem',
                                fontWeight: selectedAcadCourseCode === prog.code && selectedAcadYearLevel === yNum ? 800 : 600,
                                color: isFlyoutActive || (selectedAcadCourseCode === prog.code && selectedAcadYearLevel === yNum) ? 'var(--primary)' : 'var(--text-main)',
                                background: isFlyoutActive || (selectedAcadCourseCode === prog.code && selectedAcadYearLevel === yNum) ? '#EFF6FF' : 'transparent',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                position: 'relative',
                                transition: 'background 0.12s ease'
                              }}
                            >
                              <span>{yearText}</span>
                              <ChevronRight size={14} color={isFlyoutActive ? 'var(--primary)' : 'var(--text-muted)'} />

                              {/* SCHEDULE FLYOUT SUBMENU */}
                              {isFlyoutActive && (
                                <div
                                  style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 'calc(100% + 4px)',
                                    zIndex: 110,
                                    minWidth: '185px',
                                    background: '#FFFFFF',
                                    borderRadius: '10px',
                                    border: '1px solid var(--border-color)',
                                    boxShadow: '0 10px 25px -4px rgba(45, 38, 30, 0.18)',
                                    padding: '0.35rem 0',
                                    animation: 'fadeIn 0.12s ease'
                                  }}
                                >
                                  {getSchedules(prog.code, yNum).map(schedName => {
                                    const isSchedSelected = selectedAcadCourseCode === prog.code && selectedAcadYearLevel === yNum && selectedAcadSchedule === schedName;
                                    const enrolledCount = mockStudents.filter(s =>
                                      s.program === prog.code &&
                                      s.year === yNum &&
                                      (s.schedule === schedName || (!s.schedule && schedName === 'Schedule 1'))
                                    ).length;

                                    return (
                                      <div
                                        key={schedName}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedAcadCourseCode(prog.code);
                                          setSelectedAcadYearLevel(yNum);
                                          setSelectedAcadSchedule(schedName);
                                          setActiveAcadDropdownCourse(null);
                                          setActiveAcadFlyoutYear(null);
                                        }}
                                        style={{
                                          padding: '0.5rem 0.85rem',
                                          fontSize: '0.83rem',
                                          fontWeight: isSchedSelected ? 800 : 600,
                                          color: isSchedSelected ? 'var(--primary)' : 'var(--text-main)',
                                          background: isSchedSelected ? '#EFF6FF' : 'transparent',
                                          cursor: 'pointer',
                                          whiteSpace: 'nowrap',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'space-between',
                                          gap: '0.5rem',
                                          transition: 'background 0.12s ease'
                                        }}
                                      >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                          <span>{schedName}</span>
                                          <span
                                            style={{
                                              fontSize: '0.7rem',
                                              padding: '0.1rem 0.35rem',
                                              borderRadius: '6px',
                                              background: enrolledCount > 0 ? '#E0E7FF' : '#F1F5F9',
                                              color: enrolledCount > 0 ? '#3730A3' : '#94A3B8',
                                              fontWeight: 700
                                            }}
                                            title={`${enrolledCount} student(s) enrolled`}
                                          >
                                            {enrolledCount}
                                          </span>
                                        </div>

                                        {enrolledCount === 0 && (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              const deleted = deleteSchedule(prog.code, yNum, schedName);
                                              if (deleted && selectedAcadCourseCode === prog.code && selectedAcadYearLevel === yNum && selectedAcadSchedule === schedName) {
                                                setSelectedAcadSchedule(null);
                                              }
                                            }}
                                            style={{
                                              background: 'transparent',
                                              border: 'none',
                                              color: '#EF4444',
                                              cursor: 'pointer',
                                              padding: '2px 4px',
                                              borderRadius: '4px',
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              justifyContent: 'center'
                                            }}
                                            title="Delete empty schedule"
                                          >
                                            <Trash2 size={13} />
                                          </button>
                                        )}
                                      </div>
                                    );
                                  })}

                                  <div style={{ borderTop: '1px solid var(--border-color)', marginTop: '0.35rem', paddingTop: '0.35rem', paddingLeft: '0.5rem', paddingRight: '0.5rem' }}>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        addSchedule(prog.code, yNum);
                                      }}
                                      style={{
                                        width: '100%',
                                        padding: '0.4rem 0.6rem',
                                        borderRadius: '6px',
                                        border: '1px dashed var(--primary)',
                                        background: '#EFF6FF',
                                        color: 'var(--primary)',
                                        fontSize: '0.78rem',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '0.35rem'
                                      }}
                                    >
                                      <Plus size={13} /> Add Schedule
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {(selectedAcadCourseCode === null || selectedAcadYearLevel === null || selectedAcadSchedule === null) && (
            <div className="glass-card" style={{ padding: '2.5rem 1.5rem', textAlign: 'center', background: '#FFFFFF', marginBottom: '1.5rem' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                <BookOpen size={28} color="#2563EB" />
              </div>
              <h4 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.35rem' }}>
                {selectedAcadCourseCode ? `Select Year & Schedule for ${selectedAcadCourseCode}` : 'Browse Academic Grade Records by Course, Year & Schedule'}
              </h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', maxWidth: '440px', margin: '0 auto 1.5rem' }}>
                {selectedAcadCourseCode
                  ? `Click the "${selectedAcadCourseCode}" tab above to open the year list, then hover/click a year to open its schedule flyout.`
                  : 'Click any course tab above (BSIT, BSCS) to expand its year dropdown & schedule flyout menu.'}
              </p>
            </div>
          )}

          {selectedAcadCourseCode !== null && selectedAcadYearLevel !== null && selectedAcadSchedule !== null && (() => {
            const activeYearText = selectedAcadYearLevel === 1 ? '1st Year' : selectedAcadYearLevel === 2 ? '2nd Year' : selectedAcadYearLevel === 3 ? '3rd Year' : '4th Year';

            const filteredCourseStudents = mockStudents.filter(s =>
              s.program === selectedAcadCourseCode &&
              s.year === selectedAcadYearLevel &&
              (s.schedule === selectedAcadSchedule || (!s.schedule && selectedAcadSchedule === 'Schedule 1')) &&
              (recordSearch.trim() === '' || s.name.toLowerCase().includes(recordSearch.toLowerCase()) || s.student_id.toLowerCase().includes(recordSearch.toLowerCase()))
            );

            return (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', fontSize: '0.88rem', fontWeight: 700 }}>
                  <span
                    onClick={() => {
                      setSelectedAcadCourseCode(null);
                      setSelectedAcadYearLevel(null);
                      setSelectedAcadSchedule(null);
                    }}
                    style={{ color: 'var(--primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                  >
                    Browse by Course
                  </span>
                  <ChevronRight size={14} color="var(--text-muted)" />
                  <span
                    onClick={() => {
                      setActiveAcadDropdownCourse(selectedAcadCourseCode);
                      setActiveAcadFlyoutYear(null);
                    }}
                    style={{ color: 'var(--primary)', cursor: 'pointer' }}
                  >
                    {selectedAcadCourseCode}
                  </span>
                  <ChevronRight size={14} color="var(--text-muted)" />
                  <span
                    onClick={() => {
                      setActiveAcadDropdownCourse(selectedAcadCourseCode);
                      setActiveAcadFlyoutYear(selectedAcadYearLevel);
                    }}
                    style={{ color: 'var(--primary)', cursor: 'pointer' }}
                  >
                    {activeYearText}
                  </span>
                  <ChevronRight size={14} color="var(--text-muted)" />
                  <span style={{ color: 'var(--text-main)', fontWeight: 800 }}>
                    {selectedAcadSchedule}
                  </span>
                </div>

                {/* Release Status Banner */}
                <div style={{ background: '#F8FAFC', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '0.65rem 1rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.83rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <Award size={18} color="var(--primary)" />
                    <span>
                      <strong>Release Scope Status ({recordTermFilter}):</strong>{' '}
                      {(() => {
                        if (recordTermFilter === 'ALL') {
                          return <span style={{ color: 'var(--text-muted)' }}>Select a specific semester to view release status & release grades.</span>;
                        }
                        const scopeGrades = mockAcademicGrades.filter(g =>
                          g.term === recordTermFilter &&
                          g.yearLevel === selectedAcadYearLevel &&
                          filteredCourseStudents.some(s => s.student_id === g.studentId)
                        );
                        const relCount = scopeGrades.filter(g => g.released).length;
                        if (relCount === 0) return <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Not yet released to students</span>;
                        return <strong style={{ color: '#15803D' }}>Released ({relCount}/{scopeGrades.length} records published)</strong>;
                      })()}
                    </span>
                  </div>

                  {recordTermFilter !== 'ALL' && (() => {
                    const scopeGrades = mockAcademicGrades.filter(g =>
                      g.term === recordTermFilter &&
                      g.yearLevel === selectedAcadYearLevel &&
                      filteredCourseStudents.some(s => s.student_id === g.studentId)
                    );
                    const relCount = scopeGrades.filter(g => g.released).length;
                    return (
                      <span className={relCount > 0 ? 'badge badge-approved' : 'badge badge-returned'}>
                        {relCount > 0 ? 'Released' : 'Unreleased'}
                      </span>
                    );
                  })()}
                </div>

                {/* Collapsed Student Roster Table */}
                {filteredCourseStudents.length > 0 ? (
                  <div className="glass-card" style={{ padding: '1.35rem' }}>
                    <div className="table-container">
                      <table className="custom-table">
                        <thead>
                          <tr>
                            <th>Student ID</th>
                            <th>Name</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredCourseStudents.map(st => (
                            <tr key={st.id}>
                              <td style={{ fontWeight: 800, color: 'var(--primary)' }}>{st.student_id}</td>
                              <td style={{ fontWeight: 700, color: 'var(--text-main)' }}>{st.name}</td>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                  <button
                                    onClick={() => {
                                      setSelectedHistoryStudent(st);
                                      setActiveHistoryYearAccordion(st.year);
                                      setShowHistoryModal(true);
                                    }}
                                    style={{
                                      background: 'var(--bg-main)',
                                      border: '1px solid var(--border-color)',
                                      borderRadius: '6px',
                                      padding: '0.35rem 0.55rem',
                                      color: 'var(--primary)',
                                      cursor: 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      transition: 'all 0.2s ease'
                                    }}
                                    title="View complete academic history"
                                  >
                                    <Eye size={15} />
                                  </button>

                                  <button
                                    onClick={() => {
                                      const studentGrades = mockAcademicGrades.filter(g => g.studentId === st.student_id);
                                      if (studentGrades.length === 1) {
                                        if (studentGrades[0].released) {
                                          setPendingEditRecord(studentGrades[0]);
                                          setShowReleaseEditWarningModal(true);
                                        } else {
                                          handleOpenEditGradeModal(studentGrades[0]);
                                        }
                                      } else {
                                        setSubjectPickerStudent(st);
                                        setSubjectPickerMode('edit');
                                        setShowSubjectPickerModal(true);
                                      }
                                    }}
                                    style={{
                                      background: 'var(--bg-main)',
                                      border: '1px solid var(--border-color)',
                                      borderRadius: '6px',
                                      padding: '0.35rem 0.55rem',
                                      color: 'var(--primary)',
                                      cursor: 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      transition: 'all 0.2s ease'
                                    }}
                                    title="Edit grade record"
                                  >
                                    <Pencil size={15} />
                                  </button>

                                  <button
                                    onClick={() => {
                                      const studentGrades = mockAcademicGrades.filter(g => g.studentId === st.student_id);
                                      if (studentGrades.length === 1) {
                                        setDeletingGradeRecord({
                                          ...studentGrades[0],
                                          studentName: st.name
                                        });
                                        setShowDeleteGradeModal(true);
                                      } else {
                                        setSubjectPickerStudent(st);
                                        setSubjectPickerMode('delete');
                                        setShowSubjectPickerModal(true);
                                      }
                                    }}
                                    style={{
                                      background: '#FEF2F2',
                                      border: '1px solid #FCA5A5',
                                      borderRadius: '6px',
                                      padding: '0.35rem 0.55rem',
                                      color: '#DC2626',
                                      cursor: 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      transition: 'all 0.2s ease'
                                    }}
                                    title="Delete grade record"
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="glass-card" style={{ padding: '2.5rem 1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No students enrolled in {selectedAcadCourseCode} {activeYearText} — {selectedAcadSchedule} yet.
                  </div>
                )}
              </>
            );
          })()}
        </>
      )}

      {/* MODAL 1: ENCODE / EDIT GRADE RECORD MODAL */}
      {showEncodeModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(45, 38, 30, 0.4)',
          backdropFilter: 'blur(4px)',
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem'
        }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '540px', padding: '2rem', background: '#FFFFFF', boxShadow: 'var(--shadow-elevated)' }}>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div style={{ textAlign: 'center' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                  {gradeModalMode === 'add' ? 'Encode Subject Grade' : 'Edit Subject Grade Record'}
                </h3>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, marginTop: '0.2rem' }}>
                  {gradeModalMode === 'add' ? 'Enter numerical grade according to GCT scale' : `Editing record for ${gradeFormCode}`}
                </div>
              </div>
            </div>

            <form onSubmit={handleSaveGradeRecord}>
              <div className="form-group" style={{ position: 'relative', marginBottom: '1rem' }}>
                <label className="form-label">Student Name or ID</label>
                <input
                  type="text"
                  placeholder="Type student name or ID..."
                  value={studentSearchInput}
                  onChange={e => {
                    setStudentSearchInput(e.target.value);
                    setShowStudentSuggestions(e.target.value.trim().length > 0);
                  }}
                  className="form-input"
                  required
                />
                {showStudentSuggestions && studentSearchInput.trim().length > 0 && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    background: '#FFFFFF',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    boxShadow: '0 8px 16px rgba(0,0,0,0.1)',
                    zIndex: 10,
                    maxHeight: '160px',
                    overflowY: 'auto'
                  }}>
                    {mockStudents
                      .filter(s => s.name.toLowerCase().includes(studentSearchInput.toLowerCase()) || s.student_id.toLowerCase().includes(studentSearchInput.toLowerCase()))
                      .map(s => (
                        <div
                          key={s.id}
                          onClick={() => {
                            setGradeFormStudentId(s.student_id);
                            setStudentSearchInput(`${s.name} (${s.student_id})`);
                            setShowStudentSuggestions(false);
                          }}
                          style={{ padding: '0.5rem 0.75rem', cursor: 'pointer', fontSize: '0.82rem', borderBottom: '1px solid #F3F4F6' }}
                        >
                          <strong>{s.name}</strong> <span style={{ color: 'var(--text-muted)' }}>({s.student_id}) • {s.program} Yr {s.year}</span>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Subject Code</label>
                  <input
                    type="text"
                    value={gradeFormCode}
                    onChange={e => setGradeFormCode(e.target.value.toUpperCase())}
                    className="form-input"
                    placeholder="e.g. IT 101"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Descriptive Title</label>
                  <input
                    type="text"
                    value={gradeFormTitle}
                    onChange={e => setGradeFormTitle(e.target.value)}
                    className="form-input"
                    placeholder="e.g. Intro to Computing"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Units</label>
                  <input
                    type="number"
                    value={gradeFormUnits}
                    onChange={e => setGradeFormUnits(Number(e.target.value))}
                    className="form-input"
                    required
                    min="1"
                    max="6"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Term / Semester</label>
                  <input
                    type="text"
                    value={gradeFormTerm}
                    onChange={e => setGradeFormTerm(e.target.value)}
                    className="form-input"
                    placeholder="2024-2025 1st Sem"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Grade (GCT Scale 1.0–5.0)</label>
                  <select
                    value={gradeFormGrade}
                    onChange={e => {
                      const val = e.target.value;
                      setGradeFormGrade(val);
                      const num = parseFloat(val);
                      setGradeFormStatus(num <= 3.0 ? 'passed' : 'failed');
                    }}
                    className="form-select"
                  >
                    {GCT_GRADE_SCALE.map(gVal => (
                      <option key={gVal} value={gVal.toFixed(2)}>
                        {gVal.toFixed(2)} {gVal <= 3.0 ? '(Passed)' : '(Failed)'}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label className="form-label">Auto-Calculated Status</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className={`badge ${gradeFormStatus === 'passed' ? 'badge-passed' : 'badge-failed'}`} style={{ padding: '0.4rem 0.85rem', fontSize: '0.85rem' }}>
                    {gradeFormStatus.toUpperCase()}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    ({parseFloat(gradeFormGrade) <= 3.0 ? 'Grade 1.0–3.0 = Passed' : 'Grade > 3.0 = Failed'})
                  </span>
                </div>
              </div>

              {encodingSuccess && (
                <div style={{ padding: '0.75rem', background: '#E6F4EA', border: '1px solid #C3E6CD', borderRadius: '8px', color: '#15803D', fontSize: '0.82rem', marginBottom: '1rem' }}>
                  {encodingSuccess}
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
                <button type="button" onClick={() => setShowEncodeModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {gradeModalMode === 'add' ? 'Save Grade Record' : 'Update Grade Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: DELETE GRADE RECORD CONFIRMATION MODAL */}
      {showDeleteGradeModal && deletingGradeRecord && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(45, 38, 30, 0.4)',
          backdropFilter: 'blur(4px)',
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem'
        }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '440px', padding: '1.75rem', background: '#FFFFFF', boxShadow: 'var(--shadow-elevated)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', marginBottom: '1.25rem' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <AlertTriangle size={22} color="#DC2626" />
              </div>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)', margin: 0, marginBottom: '0.35rem' }}>
                  Delete Grade Record?
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.45 }}>
                  Remove <strong style={{ color: 'var(--text-main)' }}>{deletingGradeRecord.code}</strong> record for <strong style={{ color: 'var(--text-main)' }}>{deletingGradeRecord.studentName}</strong>?
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.55rem', justifyContent: 'flex-end', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)' }}>
              <button
                type="button"
                onClick={() => {
                  setShowDeleteGradeModal(false);
                  setDeletingGradeRecord(null);
                }}
                className="btn btn-secondary btn-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteGradeRecord}
                style={{
                  background: '#DC2626',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0.45rem 1rem',
                  fontWeight: 700,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem'
                }}
              >
                <Trash2 size={14} /> Delete Record
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: SUBJECT PICKER MODAL */}
      {showSubjectPickerModal && subjectPickerStudent && (() => {
        const studentGrades = mockAcademicGrades.filter(g => g.studentId === subjectPickerStudent.student_id);

        return (
          <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(45, 38, 30, 0.4)',
            backdropFilter: 'blur(4px)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem'
          }}>
            <div className="glass-card" style={{ width: '100%', maxWidth: '520px', padding: '1.75rem', background: '#FFFFFF', boxShadow: 'var(--shadow-elevated)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                    {subjectPickerMode === 'edit' ? 'Select Subject to Edit' : 'Select Subject to Delete'}
                  </h3>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {subjectPickerStudent.name} ({subjectPickerStudent.student_id})
                  </div>
                </div>
                <button onClick={() => setShowSubjectPickerModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                  <X size={20} />
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '300px', overflowY: 'auto' }}>
                {studentGrades.map(g => (
                  <div
                    key={g.id}
                    onClick={() => {
                      setShowSubjectPickerModal(false);
                      if (subjectPickerMode === 'edit') {
                        if (g.released) {
                          setPendingEditRecord(g);
                          setShowReleaseEditWarningModal(true);
                        } else {
                          handleOpenEditGradeModal(g);
                        }
                      } else {
                        setDeletingGradeRecord({
                          ...g,
                          studentName: subjectPickerStudent.name
                        });
                        setShowDeleteGradeModal(true);
                      }
                    }}
                    style={{
                      padding: '0.75rem 1rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-main)',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <span style={{ fontWeight: 800, color: 'var(--primary)', marginRight: '0.5rem' }}>{g.code}</span>
                      <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{g.title}</span>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{g.term} • {g.units} Units</div>
                    </div>
                    <span style={{ fontWeight: 800, color: g.grade == null ? 'var(--text-muted)' : g.status === 'passed' ? 'var(--success)' : 'var(--danger)' }}>
                      {g.grade != null ? Number(g.grade).toFixed(2) : '—'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL 4: RELEASE GRADES CONFIRMATION MODAL */}
      {showReleaseModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(45, 38, 30, 0.4)',
          backdropFilter: 'blur(4px)',
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem'
        }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '480px', padding: '2rem', background: '#FFFFFF', boxShadow: 'var(--shadow-elevated)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1rem' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#E6F4EA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Send size={20} color="#15803D" />
              </div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                Release Grades to Students?
              </h3>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.25rem', lineHeight: 1.5 }}>
              This action will publish all encoded grades for <strong>{selectedAcadCourseCode} {selectedAcadYearLevel === 1 ? '1st Year' : selectedAcadYearLevel === 2 ? '2nd Year' : selectedAcadYearLevel === 3 ? '3rd Year' : '4th Year'} ({recordTermFilter})</strong> directly to students in their Academic Portal.
            </p>

            {releaseSuccess && (
              <div style={{ padding: '0.75rem', background: '#E6F4EA', border: '1px solid #C3E6CD', borderRadius: '8px', color: '#15803D', fontSize: '0.82rem', marginBottom: '1rem' }}>
                {releaseSuccess}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setShowReleaseModal(false)} className="btn btn-secondary">
                Cancel
              </button>
              <button type="button" onClick={handleConfirmReleaseGrades} className="btn btn-success">
                <Send size={15} /> Confirm & Release Grades
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: UPLOAD RECORDS MODAL (CSV & OCR) */}
      {showUploadModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(45, 38, 30, 0.5)',
          backdropFilter: 'blur(4px)',
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem'
        }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '640px', padding: '0 0 0 0', background: '#FFFFFF', maxHeight: '90vh', overflowY: 'auto', borderRadius: '16px', boxShadow: 'var(--shadow-elevated)' }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#F8FAFC' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
                <Upload size={22} color="var(--primary)" />
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                  Upload & Auto-Encode Academic Records
                </h3>
              </div>
            </div>

            <div style={{ padding: '1.25rem 1.5rem 1rem', overflowY: 'auto' }}>
              {/* Tab switch for CSV vs Image OCR */}
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                <button
                  onClick={() => setUploadActiveTab('csv')}
                  className="btn"
                  style={{
                    flex: 1,
                    background: uploadActiveTab === 'csv' ? 'var(--primary)' : 'transparent',
                    color: uploadActiveTab === 'csv' ? '#FFFFFF' : 'var(--text-muted)',
                    borderRadius: '10px',
                    padding: '0.55rem 0.85rem',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.35rem'
                  }}
                >
                  <FileSpreadsheet size={16} /> Excel / CSV Batch Import
                </button>
                <button
                  onClick={() => setUploadActiveTab('image')}
                  className="btn"
                  style={{
                    flex: 1,
                    background: uploadActiveTab === 'image' ? 'var(--primary)' : 'transparent',
                    color: uploadActiveTab === 'image' ? '#FFFFFF' : 'var(--text-muted)',
                    borderRadius: '10px',
                    padding: '0.55rem 0.85rem',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.35rem'
                  }}
                >
                  <Image size={16} /> Image OCR Auto-Scan
                </button>
              </div>

              {uploadActiveTab === 'csv' ? (
                <div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept=".xlsx, .xls, .csv"
                    style={{ display: 'none' }}
                  />

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                      Upload Registrar Excel (.xlsx, .xls) or CSV spreadsheet file.
                    </span>
                    <div style={{ display: 'flex', gap: '0.35rem' }}>
                      <button onClick={() => handleDownloadTemplate('xlsx')} className="btn btn-secondary btn-sm" style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}>
                        <Download size={13} /> Sample Excel (.xlsx)
                      </button>
                      <button onClick={() => handleDownloadTemplate('csv')} className="btn btn-secondary btn-sm" style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}>
                        <Download size={13} /> Sample CSV
                      </button>
                    </div>
                  </div>

                  <div
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      border: '2px dashed var(--border-color)',
                      borderRadius: '12px',
                      padding: '1.75rem 1rem',
                      textAlign: 'center',
                      cursor: 'pointer',
                      background: isCsvUploaded ? '#F0FDF4' : 'var(--bg-main)',
                      marginBottom: '1rem',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <FileSpreadsheet size={36} color={isCsvUploaded ? '#15803D' : 'var(--primary)'} style={{ margin: '0 auto 0.5rem' }} />
                    <div style={{ fontWeight: 800, fontSize: '0.92rem', color: isCsvUploaded ? '#15803D' : 'var(--text-main)', marginBottom: '0.25rem' }}>
                      {isCsvUploaded && uploadedFileName ? `${uploadedFileName} (Parsed ${csvPreviewRows.length} Rows)` : 'Click or Drag & Drop Excel (.xlsx / .xls) or CSV File'}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      {isCsvUploaded ? 'Click to upload a different spreadsheet' : 'Supports Microsoft Excel (.xlsx, .xls) and standard CSV format'}
                    </div>
                  </div>

                  {isCsvUploaded && csvPreviewRows.length > 0 && (
                    <div className="table-container" style={{ maxHeight: '220px', overflowY: 'auto', marginBottom: '0.75rem' }}>
                      <table className="custom-table" style={{ fontSize: '0.78rem' }}>
                        <thead>
                          <tr>
                            <th>Student ID</th>
                            <th>Name</th>
                            <th>Course</th>
                            <th>Subject</th>
                            <th>Units</th>
                            <th>Grade</th>
                            <th>Status Note</th>
                          </tr>
                        </thead>
                        <tbody>
                          {csvPreviewRows.map(row => (
                            <tr key={row.id}>
                              <td style={{ fontWeight: 700, color: 'var(--primary)' }}>{row.studentId}</td>
                              <td>{row.name}</td>
                              <td>{row.course} (Yr {row.year})</td>
                              <td style={{ fontWeight: 700 }}>{row.code}</td>
                              <td>{row.units}</td>
                              <td style={{ fontWeight: 800 }}>{row.grade || '—'}</td>
                              <td>
                                <span className={`badge ${row.status === 'valid' || row.status === 'will_update' ? 'badge-passed' : row.status === 'valid_pending' ? 'badge-pending' : 'badge-failed'}`} style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem' }}>
                                  {row.status === 'will_update' ? 'Will Update' : row.status === 'valid' ? 'Valid New' : row.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {csvUploadSuccess && (
                    <div style={{ padding: '0.6rem 0.8rem', background: '#E6F4EA', border: '1px solid #C3E6CD', borderRadius: '8px', color: '#15803D', fontSize: '0.8rem', marginBottom: '0.75rem' }}>
                      {csvUploadSuccess}
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                    Capture or upload an image of a physical grade sheet or report card to extract grades via OCR.
                  </p>

                  <div
                    onClick={handleRunOcrScan}
                    style={{
                      border: '2px dashed var(--border-color)',
                      borderRadius: '12px',
                      padding: '1.5rem',
                      textAlign: 'center',
                      cursor: 'pointer',
                      background: isOcrUploaded ? '#F0FDF4' : 'var(--bg-main)',
                      marginBottom: '1rem'
                    }}
                  >
                    {isOcrProcessing ? (
                      <Loader2 size={32} color="var(--primary)" className="spin-icon" style={{ margin: '0 auto 0.5rem' }} />
                    ) : (
                      <Image size={32} color={isOcrUploaded ? '#15803D' : 'var(--text-muted)'} style={{ margin: '0 auto 0.5rem' }} />
                    )}
                    <div style={{ fontWeight: 700, fontSize: '0.88rem', color: isOcrUploaded ? '#15803D' : 'var(--text-main)' }}>
                      {isOcrProcessing ? 'Analyzing Grade Sheet via OCR Engine...' : isOcrUploaded ? 'Grade Sheet Image Analyzed (5 Rows Detected)' : 'Click to Upload or Capture Grade Sheet Image'}
                    </div>
                  </div>

                  {isOcrUploaded && (
                    <div className="table-container" style={{ maxHeight: '200px', overflowY: 'auto', marginBottom: '0.75rem' }}>
                      <table className="custom-table" style={{ fontSize: '0.78rem' }}>
                        <thead>
                          <tr>
                            <th>Raw Text Extracted</th>
                            <th>Matched Student ID</th>
                            <th>Code</th>
                            <th>Grade</th>
                            <th>Confidence</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ocrDetectedRows.map(row => (
                            <tr key={row.id}>
                              <td style={{ fontWeight: 600 }}>{row.rawName}</td>
                              <td style={{ fontWeight: 700, color: 'var(--primary)' }}>{row.matchedStudentId || 'Unmatched'}</td>
                              <td>{row.code}</td>
                              <td style={{ fontWeight: 800 }}>{row.grade.toFixed(2)}</td>
                              <td>
                                <span className={`badge ${row.status === 'matched' ? 'badge-passed' : 'badge-failed'}`} style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem' }}>
                                  {row.confidence}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {ocrSuccess && (
                    <div style={{ padding: '0.6rem 0.8rem', background: '#E6F4EA', border: '1px solid #C3E6CD', borderRadius: '8px', color: '#15803D', fontSize: '0.8rem', marginBottom: '0.75rem' }}>
                      {ocrSuccess}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border-color)', background: '#F8FAFC', display: 'flex', justifyContent: 'flex-end', gap: '0.65rem', borderRadius: '0 0 16px 16px' }}>
              <button
                onClick={() => setShowUploadModal(false)}
                className="btn btn-secondary"
                style={{ padding: '0.65rem 1.15rem', fontSize: '0.88rem', fontWeight: 700 }}
              >
                Cancel
              </button>
              {uploadActiveTab === 'csv' && (
                <button
                  onClick={handleConfirmCsvUpload}
                  disabled={!isCsvUploaded}
                  className="btn btn-primary"
                  style={{
                    padding: '0.65rem 1.15rem',
                    fontSize: '0.88rem',
                    fontWeight: 700,
                    opacity: !isCsvUploaded ? 0.5 : 1,
                    cursor: !isCsvUploaded ? 'not-allowed' : 'pointer'
                  }}
                >
                  <CheckCircle2 size={16} /> Confirm & Import Grades
                </button>
              )}
              {uploadActiveTab === 'image' && (
                <button
                  onClick={handleConfirmOcrEncode}
                  disabled={!isOcrUploaded}
                  className="btn btn-primary"
                  style={{
                    padding: '0.65rem 1.15rem',
                    fontSize: '0.88rem',
                    fontWeight: 700,
                    opacity: !isOcrUploaded ? 0.5 : 1,
                    cursor: !isOcrUploaded ? 'not-allowed' : 'pointer'
                  }}
                >
                  <CheckCircle2 size={16} /> Confirm OCR Auto-Encoding
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 6: ACADEMIC HISTORY MODAL */}
      {showHistoryModal && selectedHistoryStudent && (() => {
        const studentGrades = mockAcademicGrades.filter(g => g.studentId === selectedHistoryStudent.student_id);
        const currentYear = selectedHistoryStudent.year || 1;
        const visibleYears = Array.from({ length: currentYear }, (_, i) => i + 1);

        return (
          <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(45, 38, 30, 0.4)',
            backdropFilter: 'blur(4px)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem'
          }}>
            <div className="glass-card" style={{ width: '100%', maxWidth: '700px', padding: '2rem', background: '#FFFFFF', maxHeight: '90vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-color)' }}>
                <div style={{ textAlign: 'center' }}>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                    Academic History Record
                  </h3>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600, marginTop: '0.2rem' }}>
                    {selectedHistoryStudent.name} ({selectedHistoryStudent.student_id}) • {selectedHistoryStudent.program} • Year {selectedHistoryStudent.year}
                  </div>
                </div>
              </div>

              {/* Year Accordions (Filtered up to student's current year) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {visibleYears.map(yNum => {
                  const yearGrades = studentGrades.filter(g => g.yearLevel === yNum);
                  const isOpen = activeHistoryYearAccordion === yNum;
                  const yearText = yNum === 1 ? '1st Year' : yNum === 2 ? '2nd Year' : yNum === 3 ? '3rd Year' : '4th Year';

                  // Split into 1st Semester and 2nd Semester
                  const sem1Grades = yearGrades.filter(g => {
                    if (g.term && g.term.includes('1st')) return true;
                    if (g.term && g.term.includes('2nd')) return false;
                    const currSub = curriculumSubjects.find(cs => cs.code === g.code && cs.program === selectedHistoryStudent.program);
                    return currSub ? currSub.semester === 1 : true;
                  });

                  const sem2Grades = yearGrades.filter(g => {
                    if (g.term && g.term.includes('2nd')) return true;
                    if (g.term && g.term.includes('1st')) return false;
                    const currSub = curriculumSubjects.find(cs => cs.code === g.code && cs.program === selectedHistoryStudent.program);
                    return currSub ? currSub.semester === 2 : false;
                  });

                  return (
                    <div key={yNum} style={{ border: '1px solid var(--border-color)', borderRadius: '10px', overflow: 'hidden' }}>
                      <div
                        onClick={() => setActiveHistoryYearAccordion(isOpen ? null : yNum)}
                        style={{
                          padding: '0.75rem 1rem',
                          background: isOpen ? '#EFF6FF' : 'var(--bg-main)',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          fontWeight: 700,
                          fontSize: '0.85rem'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <BookOpen size={16} color="var(--primary)" />
                          <span>{yearText}</span>
                          <span style={{ fontSize: '0.72rem', background: '#DBEAFE', color: 'var(--primary)', padding: '1px 6px', borderRadius: '6px', fontWeight: 700 }}>
                            {yearGrades.length} {yearGrades.length === 1 ? 'Subject' : 'Subjects'}
                          </span>
                          {yNum === currentYear && (
                            <span style={{ fontSize: '0.68rem', background: 'var(--primary)', color: '#FFFFFF', padding: '1px 6px', borderRadius: '10px', fontWeight: 800 }}>
                              Current Year
                            </span>
                          )}
                        </div>
                        {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </div>

                      {isOpen && (
                        <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                          {/* 1st SEMESTER */}
                          <div>
                            <div style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              marginBottom: '0.5rem',
                              paddingBottom: '0.35rem',
                              borderBottom: '1px solid var(--border-color)'
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-main)' }}>
                                <Calendar size={14} color="var(--primary)" />
                                <span>1st Semester</span>
                              </div>
                              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--primary)', background: '#EFF6FF', padding: '1px 6px', borderRadius: '4px' }}>
                                {sem1Grades.reduce((sum, g) => sum + (g.units || 0), 0)} Units ({sem1Grades.length} {sem1Grades.length === 1 ? 'subject' : 'subjects'})
                              </span>
                            </div>

                            {sem1Grades.length > 0 ? (
                              <div className="table-container">
                                <table className="custom-table" style={{ fontSize: '0.78rem' }}>
                                  <thead>
                                    <tr>
                                      <th>Code</th>
                                      <th>Title</th>
                                      <th>Units</th>
                                      <th>Grade</th>
                                      <th>Status</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {sem1Grades.map(g => {
                                      const isReleased = Boolean(g.released);
                                      const showGrade = isReleased && g.grade != null;
                                      return (
                                        <tr key={g.id}>
                                          <td style={{ fontWeight: 700, color: 'var(--primary)' }}>{g.code}</td>
                                          <td>{g.title}</td>
                                          <td>{g.units}</td>
                                          <td style={{ fontWeight: 800 }}>
                                            {showGrade ? Number(g.grade).toFixed(2) : '-'}
                                          </td>
                                          <td>
                                            {showGrade ? (
                                              <span className={`badge ${g.status === 'passed' ? 'badge-passed' : 'badge-failed'}`}>
                                                {g.status}
                                              </span>
                                            ) : (
                                              <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>-</span>
                                            )}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', padding: '0.4rem 0', fontStyle: 'italic' }}>
                                No recorded subjects for 1st Semester.
                              </div>
                            )}
                          </div>

                          {/* 2nd SEMESTER */}
                          <div>
                            <div style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              marginBottom: '0.5rem',
                              paddingBottom: '0.35rem',
                              borderBottom: '1px solid var(--border-color)'
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-main)' }}>
                                <Calendar size={14} color="var(--primary)" />
                                <span>2nd Semester</span>
                              </div>
                              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--primary)', background: '#EFF6FF', padding: '1px 6px', borderRadius: '4px' }}>
                                {sem2Grades.reduce((sum, g) => sum + (g.units || 0), 0)} Units ({sem2Grades.length} {sem2Grades.length === 1 ? 'subject' : 'subjects'})
                              </span>
                            </div>

                            {sem2Grades.length > 0 ? (
                              <div className="table-container">
                                <table className="custom-table" style={{ fontSize: '0.78rem' }}>
                                  <thead>
                                    <tr>
                                      <th>Code</th>
                                      <th>Title</th>
                                      <th>Units</th>
                                      <th>Grade</th>
                                      <th>Status</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {sem2Grades.map(g => {
                                      const isReleased = Boolean(g.released);
                                      const showGrade = isReleased && g.grade != null;
                                      return (
                                        <tr key={g.id}>
                                          <td style={{ fontWeight: 700, color: 'var(--primary)' }}>{g.code}</td>
                                          <td>{g.title}</td>
                                          <td>{g.units}</td>
                                          <td style={{ fontWeight: 800 }}>
                                            {showGrade ? Number(g.grade).toFixed(2) : '-'}
                                          </td>
                                          <td>
                                            {showGrade ? (
                                              <span className={`badge ${g.status === 'passed' ? 'badge-passed' : 'badge-failed'}`}>
                                                {g.status}
                                              </span>
                                            ) : (
                                              <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>-</span>
                                            )}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', padding: '0.4rem 0', fontStyle: 'italic' }}>
                                No recorded subjects for 2nd Semester.
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1.25rem' }}>
                <button onClick={() => setShowHistoryModal(false)} className="btn btn-secondary">
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Released Grade Edit Warning Modal */}
      {showReleaseEditWarningModal && pendingEditRecord && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(45, 38, 30, 0.4)',
          backdropFilter: 'blur(4px)',
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem'
        }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '460px', padding: '2rem', background: '#FFFFFF', boxShadow: 'var(--shadow-elevated)', borderRadius: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', color: '#D97706' }}>
              <AlertTriangle size={24} />
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                Grade Sheet Already Released
              </h3>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem', lineHeight: 1.5 }}>
              The grade record for <strong style={{ color: 'var(--text-main)' }}>{pendingEditRecord.code}</strong> has already been published to the student portal. Editing this grade will immediately update the student's published grade view.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowReleaseEditWarningModal(false);
                  setPendingEditRecord(null);
                }}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const rec = pendingEditRecord;
                  setShowReleaseEditWarningModal(false);
                  setPendingEditRecord(null);
                  handleOpenEditGradeModal(rec);
                }}
                className="btn btn-primary"
              >
                Proceed to Edit
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
