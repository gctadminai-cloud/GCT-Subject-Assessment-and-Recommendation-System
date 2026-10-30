import React, { useState } from 'react';
import { useRegistrarData } from './RegistrarDataContext';
import { useUI } from '../context/UIContext';
import { fetchApi } from '../config/api';
import type { Student } from './types';
import {
  parseExcelOrCsvFile,
  downloadStudentsTemplate,
  exportStudentsToExcel
} from '../utils/exportUtils';
import {
  Search,
  Upload,
  Plus,
  Users,
  BookOpen,
  School,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronRight,
  FolderOpen,
  AlertTriangle,
  FileSpreadsheet,
  Camera,
  CheckCircle,
  RefreshCw,
  Sparkles,
  FileText,
  Download
} from 'lucide-react';

interface StudentRecordsModuleProps {
  onOpenUploadModal?: () => void;
}

export const StudentRecordsModule: React.FC<StudentRecordsModuleProps> = ({ onOpenUploadModal: _onOpenUploadModal }) => {
  const { mockStudents, setMockStudents, setMockAcademicGrades, refreshStudents, refreshAcademicGrades, PROGRAM_CATALOG, getSchedules, addSchedule, deleteSchedule } = useRegistrarData();
  const { showToast } = useUI();

  const [studentSearch, setStudentSearch] = useState('');
  const [recordViewMode, setRecordViewMode] = useState<'all' | 'course'>('all');
  const [selectedCourseCode, setSelectedCourseCode] = useState<string | null>(null);
  const [selectedYearLevel, setSelectedYearLevel] = useState<number | null>(null);
  const [selectedSchedule, setSelectedSchedule] = useState<string | null>(null);
  const [activeDropdownCourse, setActiveDropdownCourse] = useState<string | null>(null);
  const [activeFlyoutYear, setActiveFlyoutYear] = useState<number | null>(null);

  // Student CRUD Modal States
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [studentModalMode, setStudentModalMode] = useState<'add' | 'edit'>('add');
  const [studentFormId, setStudentFormId] = useState('');
  const [studentFormStudentId, setStudentFormStudentId] = useState('');
  const [studentFormName, setStudentFormName] = useState('');
  const [studentFormProgram, setStudentFormProgram] = useState('BSIT');
  const [studentFormYear, setStudentFormYear] = useState<number>(1);
  const [studentFormSchedule, setStudentFormSchedule] = useState('Schedule 1');

  const [showDeleteStudentModal, setShowDeleteStudentModal] = useState(false);
  const [deletingStudent, setDeletingStudent] = useState<Student | null>(null);

  // Student Bulk Upload & OCR Modal State
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadActiveTab, setUploadActiveTab] = useState<'excel' | 'image'>('excel');
  const [isCsvUploaded, setIsCsvUploaded] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [parsedUploadStudents, setParsedUploadStudents] = useState<Array<{
    student_id: string;
    name: string;
    program: string;
    year: number;
  }>>([]);

  const [isOcrProcessing, setIsOcrProcessing] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [isOcrUploaded, setIsOcrUploaded] = useState(false);
  const [ocrFileName, setOcrFileName] = useState('');
  const [ocrDetectedStudents, setOcrDetectedStudents] = useState<Array<{
    student_id: string;
    name: string;
    program: string;
    year: number;
    confidence: number;
  }>>([]);
  const [uploadSuccessAlert, setUploadSuccessAlert] = useState<string | null>(null);

  const handleOpenAddStudentModal = () => {
    setStudentModalMode('add');
    setStudentFormId('');
    setStudentFormStudentId(`GCT-2024-${Math.floor(1000 + Math.random() * 9000)}`);
    setStudentFormName('');
    setStudentFormProgram('BSIT');
    setStudentFormYear(1);
    setStudentFormSchedule('Schedule 1');
    setShowStudentModal(true);
  };

  const handleOpenEditStudentModal = (st: Student) => {
    setStudentModalMode('edit');
    setStudentFormId(st.id);
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
      showToast?.('Student ID and Full Name are required!', 'error');
      return;
    }

    const trimmedId = studentFormStudentId.trim();
    const trimmedName = studentFormName.trim();
    const yearNum = Number(studentFormYear) || 1;

    try {
      if (studentModalMode === 'add') {
        const newStudent: Student = {
          id: 's-' + Date.now(),
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

        showToast?.(`Student ${trimmedName} (${trimmedId}) registered successfully!`, 'success');
      } else {
        setMockStudents(prev => prev.map(s => {
          if (s.id === studentFormId || s.student_id === trimmedId) {
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

        await fetchApi(`/students/${trimmedId || studentFormId}`, {
          method: 'PUT',
          body: JSON.stringify({
            student_id: trimmedId,
            full_name: trimmedName,
            program: studentFormProgram,
            year_level: yearNum,
            schedule: studentFormSchedule
          })
        });

        showToast?.(`Student ${trimmedName} updated to Year ${yearNum}!`, 'success');
      }

      if (refreshStudents) await refreshStudents();
    } catch (err: any) {
      console.error('Error saving student in StudentRecordsModule:', err);
      showToast?.(err.message || 'Failed to update student', 'error');
    }

    setShowStudentModal(false);
  };

  const handleConfirmDeleteStudent = async () => {
    if (!deletingStudent) return;
    try {
      await fetchApi(`/students/${encodeURIComponent(deletingStudent.student_id || deletingStudent.id)}?cascade=true`, {
        method: 'DELETE'
      });
      const delSid = String(deletingStudent.student_id || deletingStudent.id).replace(/^student-/i, '').replace(/^acc-/i, '').replace(/^GCT-/i, '').toLowerCase().trim();
      setMockStudents(prev => prev.filter(s => {
        const sSid = String(s.student_id || s.id).replace(/^student-/i, '').replace(/^acc-/i, '').replace(/^GCT-/i, '').toLowerCase().trim();
        return sSid !== delSid;
      }));
      if (setMockAcademicGrades) {
        setMockAcademicGrades(prev => prev.filter(g => {
          const gSid = String(g.studentId).replace(/^student-/i, '').replace(/^acc-/i, '').replace(/^GCT-/i, '').toLowerCase().trim();
          return gSid !== delSid;
        }));
      }
      showToast?.(`Student ${deletingStudent.name} and all records removed from database.`, 'info');
      if (refreshStudents) await refreshStudents();
      if (refreshAcademicGrades) await refreshAcademicGrades('all');
    } catch (err: any) {
      console.error('Error deleting student:', err);
      showToast?.(err.message || 'Failed to delete student', 'error');
    }
    setShowDeleteStudentModal(false);
    setDeletingStudent(null);
  };

  // Upload Handlers
  const handleSimulateExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFileName(file.name);
    try {
      const rawRows = await parseExcelOrCsvFile(file);
      if (!rawRows || rawRows.length === 0) {
        setUploadSuccessAlert('No records found in uploaded file.');
        return;
      }

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

        const student_id = String(findVal('Student ID', 'student_id', 'ID', 'StudentNo') || `GCT-2024-000${idx + 1}`).trim();
        const name = String(findVal('Full Name', 'Name', 'Student Name', 'Student') || 'Student Name').trim();
        const program = String(findVal('Program / Course', 'Program', 'Course', 'Degree') || 'BSIT').trim();
        const year = Number(findVal('Year Level', 'Year', 'Yr')) || 1;

        return { student_id, name, program, year };
      });

      setParsedUploadStudents(parsed);
      setIsCsvUploaded(true);
      setUploadSuccessAlert(`Parsed ${parsed.length} student records from "${file.name}"!`);
    } catch (err: any) {
      console.error('Error parsing student roster file:', err);
      setUploadSuccessAlert(`Error parsing file: ${err?.message || 'Invalid format'}`);
    }
  };

  const handleLoadSampleExcel = () => {
    downloadStudentsTemplate('xlsx');
  };

  const handleSimulateImageOcr = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setOcrFileName(file.name);
      setIsOcrProcessing(true);
      setOcrProgress(20);
      
      setTimeout(() => setOcrProgress(50), 300);
      setTimeout(() => setOcrProgress(85), 650);
      setTimeout(() => {
        setOcrProgress(100);
        setIsOcrProcessing(false);
        setIsOcrUploaded(true);
        setOcrDetectedStudents([
          { student_id: `GCT-2025-${Math.floor(1100 + Math.random() * 8000)}`, name: 'Scanned Student A', program: 'BSIT', year: 1, confidence: 98 },
          { student_id: `GCT-2025-${Math.floor(1100 + Math.random() * 8000)}`, name: 'Scanned Student B', program: 'BSCS', year: 1, confidence: 96 }
        ]);
      }, 1000);
    }
  };

  const handleLoadSampleOcrImage = () => {
    setOcrFileName('Enrolled_Students_ClassList_Scanned.png');
    setIsOcrProcessing(true);
    setOcrProgress(25);
    
    setTimeout(() => setOcrProgress(60), 300);
    setTimeout(() => setOcrProgress(90), 650);
    setTimeout(() => {
      setOcrProgress(100);
      setIsOcrProcessing(false);
      setIsOcrUploaded(true);
      setOcrDetectedStudents([
        { student_id: `GCT-2025-${Math.floor(1100 + Math.random() * 8000)}`, name: 'Scanned Student A', program: 'BSIT', year: 1, confidence: 98 },
        { student_id: `GCT-2025-${Math.floor(1100 + Math.random() * 8000)}`, name: 'Scanned Student B', program: 'BSCS', year: 1, confidence: 96 }
      ]);
    }, 1000);
  };

  const handleCommitExcelImport = () => {
    if (parsedUploadStudents.length === 0) return;
    const newStudents: Student[] = parsedUploadStudents.map((item, idx) => ({
      id: `s-imp-${Date.now()}-${idx}`,
      student_id: item.student_id,
      name: item.name,
      email: `${item.student_id.toLowerCase().replace(/[^a-z0-9]/g, '')}@gct.edu.ph`,
      program: item.program,
      year: item.year,
      section: 'A',
      schedule: 'Schedule 1',
      status: 'approved'
    }));

    setMockStudents(prev => [...newStudents, ...prev]);
    setUploadSuccessAlert(`Successfully imported ${newStudents.length} student records from ${uploadedFileName || 'Excel file'}!`);
    setIsCsvUploaded(false);
    setParsedUploadStudents([]);
    setTimeout(() => {
      setShowUploadModal(false);
      setUploadSuccessAlert(null);
    }, 1200);
  };

  const handleCommitOcrImport = () => {
    if (ocrDetectedStudents.length === 0) return;
    const newStudents: Student[] = ocrDetectedStudents.map((item, idx) => ({
      id: `s-ocr-${Date.now()}-${idx}`,
      student_id: item.student_id,
      name: item.name,
      email: `${item.student_id.toLowerCase().replace(/[^a-z0-9]/g, '')}@gct.edu.ph`,
      program: item.program,
      year: item.year,
      section: 'A',
      schedule: 'Schedule 1',
      status: 'approved'
    }));

    setMockStudents(prev => [...newStudents, ...prev]);
    setUploadSuccessAlert(`Successfully auto-encoded ${newStudents.length} student records via OCR scan!`);
    setIsOcrUploaded(false);
    setOcrDetectedStudents([]);
    setTimeout(() => {
      setShowUploadModal(false);
      setUploadSuccessAlert(null);
    }, 1200);
  };

  return (
    <>
      {/* ROW 1: Search input | Upload Records button | Add Student button */}
      <div className="glass-card" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.65rem' }}>
          {/* 1. Search */}
          <div style={{ position: 'relative', width: '280px' }}>
            <input
              type="text"
              placeholder="Search Student Name or ID..."
              value={studentSearch}
              onChange={e => setStudentSearch(e.target.value)}
              className="form-input"
              style={{ paddingLeft: '2.2rem', fontSize: '0.85rem', height: '38px' }}
            />
            <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }} />
          </div>

          {/* Right: Upload Records Button | Add Student Button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>

            <button
              onClick={() => exportStudentsToExcel(mockStudents)}
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
              title="Export Student Roster to Microsoft Excel (.xlsx)"
            >
              <Download size={16} /> Export Excel
            </button>

            <button
              onClick={handleOpenAddStudentModal}
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
              <Plus size={16} /> Add Student
            </button>
          </div>
        </div>
      </div>

      {/* ROW 2: All Students tab | Browse by Course tab */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
        <div style={{ display: 'inline-flex', background: '#EFF6FF', padding: '4px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
          <button
            onClick={() => {
              setRecordViewMode('all');
              setSelectedCourseCode(null);
              setSelectedYearLevel(null);
              setSelectedSchedule(null);
              setActiveDropdownCourse(null);
              setActiveFlyoutYear(null);
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
              background: recordViewMode === 'all' ? '#FFFFFF' : 'transparent',
              color: recordViewMode === 'all' ? 'var(--primary)' : 'var(--text-muted)',
              boxShadow: recordViewMode === 'all' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
              transition: 'all 0.2s ease'
            }}
          >
            <Users size={16} />
            All Students
          </button>
          <button
            onClick={() => {
              setRecordViewMode('course');
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
              background: recordViewMode === 'course' ? '#FFFFFF' : 'transparent',
              color: recordViewMode === 'course' ? 'var(--primary)' : 'var(--text-muted)',
              boxShadow: recordViewMode === 'course' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
              transition: 'all 0.2s ease'
            }}
          >
            <BookOpen size={16} />
            Browse by Course
          </button>
        </div>

        {recordViewMode === 'course' && (
          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <School size={15} color="var(--primary)" />
            Select Course → Year List → Schedule Flyout
          </div>
        )}
      </div>

      {/* VIEW MODE 1: ALL STUDENTS FLAT TABLE */}
      {recordViewMode === 'all' && (
        <div className="glass-card" style={{ padding: '1.35rem' }}>
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Student ID</th>
                  <th>Name</th>
                  <th>Course</th>
                  <th>Year</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {mockStudents.filter(s => s.name.toLowerCase().includes(studentSearch.toLowerCase()) || s.student_id.toLowerCase().includes(studentSearch.toLowerCase())).map(st => (
                  <tr key={st.id}>
                    <td style={{ fontWeight: 800, color: 'var(--primary)' }}>{st.student_id}</td>
                    <td style={{ fontWeight: 700, color: 'var(--text-main)' }}>{st.name}</td>
                    <td>{st.program}</td>
                    <td>{st.year === 1 ? '1st Year' : st.year === 2 ? '2nd Year' : st.year === 3 ? '3rd Year' : '4th Year'}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <button
                          onClick={() => handleOpenEditStudentModal(st)}
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
                          title="Edit student record"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => {
                            setDeletingStudent(st);
                            setShowDeleteStudentModal(true);
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
                          title="Delete student record"
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
      )}

      {/* VIEW MODE 2: BROWSE BY COURSE */}
      {recordViewMode === 'course' && (
        <>
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Select Course / Program:
            </div>
            <div style={{ display: 'inline-flex', background: '#EFF6FF', padding: '4px', borderRadius: '12px', border: '1px solid var(--border-color)', flexWrap: 'wrap', gap: '4px', position: 'relative' }}>
              {PROGRAM_CATALOG.map((prog: any) => {
                const isSelected = selectedCourseCode === prog.code;
                const isDropdownOpen = activeDropdownCourse === prog.code;

                return (
                  <div key={prog.code} style={{ position: 'relative' }}>
                    <button
                      onClick={() => {
                        if (isDropdownOpen) {
                          setActiveDropdownCourse(null);
                          setActiveFlyoutYear(null);
                        } else {
                          setActiveDropdownCourse(prog.code);
                          setActiveFlyoutYear(null);
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

                    {/* YEAR LIST CONTEXT DROPDOWN MENU */}
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
                          const isFlyoutActive = activeFlyoutYear === yNum;

                          return (
                            <div
                              key={yNum}
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveFlyoutYear(isFlyoutActive ? null : yNum);
                              }}
                              onMouseEnter={() => setActiveFlyoutYear(yNum)}
                              style={{
                                padding: '0.55rem 0.85rem',
                                fontSize: '0.83rem',
                                fontWeight: selectedCourseCode === prog.code && selectedYearLevel === yNum ? 800 : 600,
                                color: isFlyoutActive || (selectedCourseCode === prog.code && selectedYearLevel === yNum) ? 'var(--primary)' : 'var(--text-main)',
                                background: isFlyoutActive || (selectedCourseCode === prog.code && selectedYearLevel === yNum) ? '#EFF6FF' : 'transparent',
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
                                    const isSchedSelected = selectedCourseCode === prog.code && selectedYearLevel === yNum && selectedSchedule === schedName;
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
                                          setSelectedCourseCode(prog.code);
                                          setSelectedYearLevel(yNum);
                                          setSelectedSchedule(schedName);
                                          setActiveDropdownCourse(null);
                                          setActiveFlyoutYear(null);
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
                                              if (deleted && selectedCourseCode === prog.code && selectedYearLevel === yNum && selectedSchedule === schedName) {
                                                setSelectedSchedule(null);
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

          {(selectedCourseCode === null || selectedYearLevel === null || selectedSchedule === null) && (
            <div className="glass-card" style={{ padding: '2.5rem 1.5rem', textAlign: 'center', background: '#FFFFFF', marginBottom: '1.5rem' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                <BookOpen size={28} color="#2563EB" />
              </div>
              <h4 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.35rem' }}>
                {selectedCourseCode ? `Select Year & Schedule for ${selectedCourseCode}` : 'Browse Students by Course, Year & Schedule'}
              </h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', maxWidth: '440px', margin: '0 auto 1.5rem' }}>
                {selectedCourseCode
                  ? `Click the "${selectedCourseCode}" tab above to open the year list, then hover/click a year to open its schedule flyout.`
                  : 'Click any course tab above (BSIT, BSCS) to expand its year dropdown & schedule flyout menu.'}
              </p>
            </div>
          )}

          {selectedCourseCode !== null && selectedYearLevel !== null && selectedSchedule !== null && (() => {
            const activeYearText = selectedYearLevel === 1 ? '1st Year' : selectedYearLevel === 2 ? '2nd Year' : selectedYearLevel === 3 ? '3rd Year' : '4th Year';

            const filteredCourseStudents = mockStudents.filter(s =>
              s.program === selectedCourseCode &&
              s.year === selectedYearLevel &&
              (s.schedule === selectedSchedule || (!s.schedule && selectedSchedule === 'Schedule 1'))
            );

            return (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', fontSize: '0.88rem', fontWeight: 700 }}>
                  <span
                    onClick={() => {
                      setSelectedCourseCode(null);
                      setSelectedYearLevel(null);
                      setSelectedSchedule(null);
                    }}
                    style={{ color: 'var(--primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                  >
                    Browse by Course
                  </span>
                  <ChevronRight size={14} color="var(--text-muted)" />
                  <span
                    onClick={() => {
                      setActiveDropdownCourse(selectedCourseCode);
                      setActiveFlyoutYear(null);
                    }}
                    style={{ color: 'var(--primary)', cursor: 'pointer' }}
                  >
                    {selectedCourseCode}
                  </span>
                  <ChevronRight size={14} color="var(--text-muted)" />
                  <span
                    onClick={() => {
                      setActiveDropdownCourse(selectedCourseCode);
                      setActiveFlyoutYear(selectedYearLevel);
                    }}
                    style={{ color: 'var(--primary)', cursor: 'pointer' }}
                  >
                    {activeYearText}
                  </span>
                  <ChevronRight size={14} color="var(--text-muted)" />
                  <span style={{ color: 'var(--text-main)', fontWeight: 800 }}>
                    {selectedSchedule}
                  </span>
                </div>

                <div className="glass-card" style={{ padding: '1rem 1.25rem', marginBottom: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                    <div style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-main)' }}>
                      {selectedCourseCode} {activeYearText} — {selectedSchedule}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                      Showing <strong style={{ color: 'var(--primary)' }}>{filteredCourseStudents.length}</strong> {filteredCourseStudents.length === 1 ? 'student' : 'students'}
                    </div>
                  </div>
                </div>

                {filteredCourseStudents.length > 0 ? (
                  <div className="glass-card" style={{ padding: '1.35rem' }}>
                    <div className="table-container">
                      <table className="custom-table">
                        <thead>
                          <tr>
                            <th>Student ID</th>
                            <th>Name</th>
                            <th>Course</th>
                            <th>Year</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredCourseStudents.map(st => (
                            <tr key={st.id}>
                              <td style={{ fontWeight: 800, color: 'var(--primary)' }}>{st.student_id}</td>
                              <td style={{ fontWeight: 700, color: 'var(--text-main)' }}>{st.name}</td>
                              <td>{st.program}</td>
                              <td>{st.year === 1 ? '1st Year' : st.year === 2 ? '2nd Year' : st.year === 3 ? '3rd Year' : '4th Year'}</td>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                  <button
                                    onClick={() => handleOpenEditStudentModal(st)}
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
                                    title="Edit student record"
                                  >
                                    <Pencil size={15} />
                                  </button>
                                  <button
                                    onClick={() => {
                                      setDeletingStudent(st);
                                      setShowDeleteStudentModal(true);
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
                                    title="Delete student record"
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
                  <div className="glass-card" style={{ padding: '3rem 1.5rem', textAlign: 'center', background: '#FFFFFF' }}>
                    <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                      <FolderOpen size={28} color="#D97706" />
                    </div>
                    <h4 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.35rem' }}>
                      No students found for {selectedCourseCode} - {activeYearText} - {selectedSchedule}
                    </h4>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', maxWidth: '440px', margin: '0 auto 1.25rem' }}>
                      There are currently no enrolled student records registered for this specific course, year, and schedule combination.
                    </p>
                  </div>
                )}
              </>
            );
          })()}
        </>
      )}

      {/* BULK UPLOAD / OCR AUTO-ENCODING MODAL */}
      {showUploadModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(45, 38, 30, 0.45)',
          backdropFilter: 'blur(5px)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem'
        }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '640px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', background: '#FFFFFF', boxShadow: 'var(--shadow-elevated)', borderRadius: '16px', overflow: 'hidden' }}>
            {/* Modal Header */}
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#F8FAFC' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Upload size={18} color="var(--primary)" />
                  </div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                    Upload Student Records
                  </h3>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, marginTop: '0.25rem' }}>
                  Import student records via Excel (.xlsx, .csv) or scan documents with OCR Auto-Encoding
                </div>
              </div>
            </div>

            {/* Success Alert Banner */}
            {uploadSuccessAlert && (
              <div style={{ margin: '1rem 1.5rem 0', padding: '0.75rem 1rem', background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#065F46', fontSize: '0.85rem', fontWeight: 700 }}>
                <CheckCircle size={18} color="#10B981" />
                <span>{uploadSuccessAlert}</span>
              </div>
            )}

            {/* Modal Tabs */}
            <div style={{ padding: '1rem 1.5rem 0', display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => setUploadActiveTab('excel')}
                style={{
                  flex: 1,
                  padding: '0.65rem 1rem',
                  borderRadius: '10px',
                  border: uploadActiveTab === 'excel' ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                  background: uploadActiveTab === 'excel' ? '#EFF6FF' : '#FFFFFF',
                  color: uploadActiveTab === 'excel' ? 'var(--primary)' : 'var(--text-muted)',
                  fontWeight: 800,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  transition: 'all 0.2s ease'
                }}
              >
                <FileSpreadsheet size={16} />
                Excel / CSV Spreadsheet
              </button>

              <button
                onClick={() => setUploadActiveTab('image')}
                style={{
                  flex: 1,
                  padding: '0.65rem 1rem',
                  borderRadius: '10px',
                  border: uploadActiveTab === 'image' ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                  background: uploadActiveTab === 'image' ? '#EFF6FF' : '#FFFFFF',
                  color: uploadActiveTab === 'image' ? 'var(--primary)' : 'var(--text-muted)',
                  fontWeight: 800,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  transition: 'all 0.2s ease'
                }}
              >
                <Camera size={16} />
                Image OCR Scan
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '1.25rem 1.5rem', overflowY: 'auto', flex: 1 }}>
              {/* TAB 1: EXCEL / CSV UPLOAD */}
              {uploadActiveTab === 'excel' && (
                <div>
                  <div style={{ background: '#F8FAFC', border: '1px dashed var(--border-color)', borderRadius: '12px', padding: '1.5rem', textAlign: 'center', position: 'relative', marginBottom: '1.25rem' }}>
                    <input
                      type="file"
                      accept=".xlsx, .xls, .csv"
                      onChange={handleSimulateExcelUpload}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        opacity: 0,
                        cursor: 'pointer'
                      }}
                    />
                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.75rem' }}>
                      <FileSpreadsheet size={24} color="var(--primary)" />
                    </div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.25rem' }}>
                      {uploadedFileName ? uploadedFileName : 'Click to Browse or Drag & Drop Excel/CSV File'}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                      Required columns: <strong style={{ color: 'var(--primary)' }}>Student ID</strong>, <strong style={{ color: 'var(--primary)' }}>Name</strong>, <strong style={{ color: 'var(--primary)' }}>Course</strong>, and <strong style={{ color: 'var(--primary)' }}>Year</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '0.75rem' }}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleLoadSampleExcel();
                        }}
                        style={{
                          padding: '0.35rem 0.75rem',
                          borderRadius: '6px',
                          border: '1px solid var(--border-color)',
                          background: '#FFFFFF',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          color: 'var(--primary)',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem'
                        }}
                      >
                        <FileText size={13} /> Load Sample 5-Student File
                      </button>
                    </div>
                  </div>

                  {/* Excel Parsed Records Preview */}
                  {isCsvUploaded && parsedUploadStudents.length > 0 && (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
                        <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-main)' }}>
                          Parsed Students Preview ({parsedUploadStudents.length} records detected)
                        </div>
                        <span style={{ fontSize: '0.72rem', background: '#DCFCE7', color: '#166534', padding: '0.15rem 0.5rem', borderRadius: '6px', fontWeight: 700 }}>
                          Ready to Import
                        </span>
                      </div>

                      <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                        <table className="custom-table" style={{ fontSize: '0.8rem', margin: 0 }}>
                          <thead>
                            <tr>
                              <th style={{ padding: '0.5rem 0.75rem' }}>Student ID</th>
                              <th style={{ padding: '0.5rem 0.75rem' }}>Name</th>
                              <th style={{ padding: '0.5rem 0.75rem' }}>Course</th>
                              <th style={{ padding: '0.5rem 0.75rem' }}>Year</th>
                            </tr>
                          </thead>
                          <tbody>
                            {parsedUploadStudents.map((item, idx) => (
                              <tr key={idx}>
                                <td style={{ fontWeight: 700, color: 'var(--primary)', padding: '0.45rem 0.75rem' }}>{item.student_id}</td>
                                <td style={{ fontWeight: 600, padding: '0.45rem 0.75rem' }}>{item.name}</td>
                                <td style={{ padding: '0.45rem 0.75rem' }}>{item.program}</td>
                                <td style={{ padding: '0.45rem 0.75rem' }}>{item.year === 1 ? '1st' : item.year === 2 ? '2nd' : item.year === 3 ? '3rd' : '4th'} Year</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: IMAGE / OCR SCAN */}
              {uploadActiveTab === 'image' && (
                <div>
                  <div style={{ background: '#F8FAFC', border: '1px dashed var(--border-color)', borderRadius: '12px', padding: '1.5rem', textAlign: 'center', position: 'relative', marginBottom: '1.25rem' }}>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={handleSimulateImageOcr}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        opacity: 0,
                        cursor: 'pointer'
                      }}
                    />
                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.75rem' }}>
                      <Camera size={24} color="var(--primary)" />
                    </div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.25rem' }}>
                      {ocrFileName ? ocrFileName : 'Upload Class Roster Image or Scan Photo'}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                      Automatic OCR text extraction for: <strong style={{ color: 'var(--primary)' }}>Student ID</strong>, <strong style={{ color: 'var(--primary)' }}>Name</strong>, <strong style={{ color: 'var(--primary)' }}>Course</strong>, and <strong style={{ color: 'var(--primary)' }}>Year</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '0.75rem' }}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleLoadSampleOcrImage();
                        }}
                        style={{
                          padding: '0.35rem 0.75rem',
                          borderRadius: '6px',
                          border: '1px solid var(--border-color)',
                          background: '#FFFFFF',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          color: 'var(--primary)',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem'
                        }}
                      >
                        <Sparkles size={13} /> Load Sample Image Scan
                      </button>
                    </div>
                  </div>

                  {/* OCR Processing Indicator */}
                  {isOcrProcessing && (
                    <div style={{ padding: '1rem', background: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: '10px', textAlign: 'center', marginBottom: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: '#0369A1', fontWeight: 800, fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                        <RefreshCw size={16} className="animate-spin" />
                        Scanning document & recognizing text ({ocrProgress}%)...
                      </div>
                      <div style={{ width: '100%', height: '6px', background: '#E0F2FE', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ width: `${ocrProgress}%`, height: '100%', background: 'var(--primary)', transition: 'width 0.3s ease' }} />
                      </div>
                    </div>
                  )}

                  {/* OCR Extracted Records Table */}
                  {isOcrUploaded && ocrDetectedStudents.length > 0 && (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
                        <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <Sparkles size={14} color="#D97706" />
                          OCR Auto-Encoded ({ocrDetectedStudents.length} records verified)
                        </div>
                        <span style={{ fontSize: '0.72rem', background: '#EFF6FF', color: 'var(--primary)', padding: '0.15rem 0.5rem', borderRadius: '6px', fontWeight: 700 }}>
                          High OCR Confidence (94%+)
                        </span>
                      </div>

                      <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                        <table className="custom-table" style={{ fontSize: '0.8rem', margin: 0 }}>
                          <thead>
                            <tr>
                              <th style={{ padding: '0.5rem 0.75rem' }}>Student ID</th>
                              <th style={{ padding: '0.5rem 0.75rem' }}>Name</th>
                              <th style={{ padding: '0.5rem 0.75rem' }}>Course</th>
                              <th style={{ padding: '0.5rem 0.75rem' }}>Year</th>
                              <th style={{ padding: '0.5rem 0.75rem' }}>Confidence</th>
                            </tr>
                          </thead>
                          <tbody>
                            {ocrDetectedStudents.map((item, idx) => (
                              <tr key={idx}>
                                <td style={{ fontWeight: 700, color: 'var(--primary)', padding: '0.45rem 0.75rem' }}>{item.student_id}</td>
                                <td style={{ fontWeight: 600, padding: '0.45rem 0.75rem' }}>{item.name}</td>
                                <td style={{ padding: '0.45rem 0.75rem' }}>{item.program}</td>
                                <td style={{ padding: '0.45rem 0.75rem' }}>{item.year === 1 ? '1st' : item.year === 2 ? '2nd' : item.year === 3 ? '3rd' : '4th'} Year</td>
                                <td style={{ padding: '0.45rem 0.75rem' }}>
                                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#166534', background: '#DCFCE7', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                                    {item.confidence}%
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border-color)', background: '#F8FAFC', display: 'flex', justifyContent: 'flex-end', gap: '0.65rem' }}>
              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                className="btn btn-secondary"
                style={{ padding: '0.65rem 1.15rem', fontSize: '0.88rem', fontWeight: 700 }}
              >
                Cancel
              </button>

              {uploadActiveTab === 'excel' && (
                <button
                  type="button"
                  disabled={!isCsvUploaded || parsedUploadStudents.length === 0}
                  onClick={handleCommitExcelImport}
                  className="btn btn-primary"
                  style={{
                    padding: '0.65rem 1.15rem',
                    fontSize: '0.88rem',
                    fontWeight: 700,
                    opacity: (!isCsvUploaded || parsedUploadStudents.length === 0) ? 0.5 : 1,
                    cursor: (!isCsvUploaded || parsedUploadStudents.length === 0) ? 'not-allowed' : 'pointer'
                  }}
                >
                  <CheckCircle size={16} /> Confirm & Import ({parsedUploadStudents.length})
                </button>
              )}

              {uploadActiveTab === 'image' && (
                <button
                  type="button"
                  disabled={!isOcrUploaded || ocrDetectedStudents.length === 0 || isOcrProcessing}
                  onClick={handleCommitOcrImport}
                  className="btn btn-primary"
                  style={{
                    padding: '0.65rem 1.15rem',
                    fontSize: '0.88rem',
                    fontWeight: 700,
                    opacity: (!isOcrUploaded || ocrDetectedStudents.length === 0 || isOcrProcessing) ? 0.5 : 1,
                    cursor: (!isOcrUploaded || ocrDetectedStudents.length === 0 || isOcrProcessing) ? 'not-allowed' : 'pointer'
                  }}
                >
                  <Sparkles size={16} /> Confirm OCR Auto-Encoding ({ocrDetectedStudents.length})
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ADD / EDIT STUDENT MODAL */}
      {showStudentModal && (
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
          <div className="glass-card" style={{ width: '100%', maxWidth: '520px', padding: '2rem', background: '#FFFFFF', boxShadow: 'var(--shadow-elevated)' }}>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div style={{ textAlign: 'center' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                  {studentModalMode === 'add' ? 'Add New Student Record' : 'Edit Student Record'}
                </h3>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, marginTop: '0.2rem' }}>
                  {studentModalMode === 'add' ? 'Register a student into the system' : `Updating ${studentFormStudentId}`}
                </div>
              </div>
            </div>

            <form onSubmit={handleSaveStudent}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-main)', display: 'block', marginBottom: '0.35rem' }}>
                    Student ID
                  </label>
                  <input
                    type="text"
                    value={studentFormStudentId}
                    onChange={e => setStudentFormStudentId(e.target.value)}
                    className="form-input"
                    placeholder="e.g. GCT-2024-0019"
                    required
                    style={{ width: '100%', padding: '0.65rem', fontSize: '0.88rem' }}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-main)', display: 'block', marginBottom: '0.35rem' }}>
                    Full Name (Last, First)
                  </label>
                  <input
                    type="text"
                    value={studentFormName}
                    onChange={e => setStudentFormName(e.target.value)}
                    className="form-input"
                    placeholder="Enter student full name"
                    required
                    style={{ width: '100%', padding: '0.65rem', fontSize: '0.88rem' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '1.5rem' }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-main)', display: 'block', marginBottom: '0.35rem' }}>
                    Program
                  </label>
                  <select
                    value={studentFormProgram}
                    onChange={e => setStudentFormProgram(e.target.value)}
                    className="form-input"
                    style={{ width: '100%', padding: '0.65rem', fontSize: '0.85rem' }}
                  >
                    <option value="BSIT">BSIT</option>
                    <option value="BSCS">BSCS</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-main)', display: 'block', marginBottom: '0.35rem' }}>
                    Year Level
                  </label>
                  <select
                    value={studentFormYear}
                    onChange={e => setStudentFormYear(Number(e.target.value))}
                    className="form-input"
                    style={{ width: '100%', padding: '0.65rem', fontSize: '0.85rem' }}
                  >
                    <option value={1}>1st Year</option>
                    <option value={2}>2nd Year</option>
                    <option value={3}>3rd Year</option>
                    <option value={4}>4th Year</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-main)', display: 'block', marginBottom: '0.35rem' }}>
                    Schedule
                  </label>
                  <select
                    value={studentFormSchedule}
                    onChange={e => setStudentFormSchedule(e.target.value)}
                    className="form-input"
                    style={{ width: '100%', padding: '0.65rem', fontSize: '0.85rem' }}
                  >
                    {getSchedules(studentFormProgram, Number(studentFormYear)).map(sched => (
                      <option key={sched} value={sched}>{sched}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowStudentModal(false)}
                  className="btn btn-secondary"
                  style={{ padding: '0.65rem 1.15rem', fontSize: '0.88rem', fontWeight: 700 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ padding: '0.65rem 1.15rem', fontSize: '0.88rem', fontWeight: 700 }}
                >
                  {studentModalMode === 'add' ? 'Add Student' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE STUDENT CONFIRMATION MODAL */}
      {showDeleteStudentModal && deletingStudent && (
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
                  Delete Student Record?
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.45 }}>
                  Are you sure you want to permanently remove <strong style={{ color: 'var(--text-main)' }}>{deletingStudent.name} ({deletingStudent.student_id})</strong>?
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.55rem', justifyContent: 'flex-end', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)' }}>
              <button
                type="button"
                onClick={() => {
                  setShowDeleteStudentModal(false);
                  setDeletingStudent(null);
                }}
                className="btn btn-secondary btn-sm"
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
                <Trash2 size={14} /> Delete Student
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
