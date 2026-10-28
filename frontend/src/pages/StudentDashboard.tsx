import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import { fetchApi } from '../config/api';
import { buildCompleteStudentGrades } from '../utils/curriculumData';
import type { AcademicGrade, Student } from '../modules/types';
import {
  BookOpen,
  Calendar,
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  GraduationCap,
  Layers,
  Loader2,
  Award,
  TrendingUp,
  RotateCcw
} from 'lucide-react';

interface StudentDashboardProps {
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

export const StudentDashboard: React.FC<StudentDashboardProps> = () => {
  const { user, student, logout } = useAuth();
  const { confirmAction } = useUI();
  const [liveStudentData, setLiveStudentData] = useState<{ year_level?: number; program?: string; full_name?: string } | null>(null);

  const targetStudentId = useMemo(() => {
    return String(student?.student_id || user?.student_id || user?.username || '').trim();
  }, [student?.student_id, user?.student_id, user?.username]);

  // Construct student profile object matching Student interface expected by buildCompleteStudentGrades
  const studentObj: Student = useMemo(() => {
    const sId = targetStudentId || '12310';
    const sName = liveStudentData?.full_name || user?.full_name || (student as any)?.name || 'Student';
    const sProg = (liveStudentData?.program || student?.program || user?.program || 'BSIT').toUpperCase();
    const sYr = Number(liveStudentData?.year_level || student?.year_level || user?.year_level) || 1;
    const sSem = Number((student as any)?.semester) || 1;

    return {
      id: student?.id || user?.id || sId,
      student_id: sId,
      name: sName,
      email: user?.email || '',
      program: sProg,
      year: sYr,
      section: student?.section || 'A',
      schedule: user?.schedule || 'Schedule 1',
      semester: sSem,
      status: 'approved'
    };
  }, [targetStudentId, student, user, liveStudentData]);

  const studentYear = studentObj.year;
  const [selectedYearTab, setSelectedYearTab] = useState<number>(studentYear);
  const [searchTerm, setSearchTerm] = useState('');
  const [rawDbGrades, setRawDbGrades] = useState<AcademicGrade[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [expandedAttempts, setExpandedAttempts] = useState<Record<string, boolean>>({});

  // Navigation button (CP) & swipe gesture (laptop / touch) logout confirmation guard
  useEffect(() => {
    let isMounted = true;
    let modalOpen = false;

    // Push guard state so phone back button / swipe back gesture triggers popstate instead of abrupt exit
    window.history.pushState({ page: 'gct_student_hub' }, '', window.location.href);

    const handlePopState = () => {
      if (!isMounted) return;
      if (modalOpen) return;
      modalOpen = true;

      confirmAction({
        title: 'Sign Out Confirmation',
        message: 'Are you sure you want to log out of your student account?',
        confirmText: 'Yes, Log Out',
        cancelText: 'No, Stay',
        type: 'danger',
        onConfirm: async () => {
          modalOpen = false;
          logout();
        },
        onCancel: () => {
          modalOpen = false;
          // Re-push history guard ONLY when student cancels, keeping them smoothly on the dashboard
          window.history.pushState({ page: 'gct_student_hub' }, '', window.location.href);
        }
      });
    };

    const timer = setTimeout(() => {
      window.addEventListener('popstate', handlePopState);
    }, 300);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [logout, confirmAction]);

  // Sync default selected tab when student year is updated (including when admin edits year)
  useEffect(() => {
    setSelectedYearTab(studentYear);
  }, [studentYear]);

  // Auto-sync student year level whenever tab is focused or becomes visible
  useEffect(() => {
    const handleSync = async () => {
      if (document.visibilityState === 'visible' && targetStudentId) {
        try {
          const sRes = await fetchApi(`/students/${encodeURIComponent(targetStudentId)}`, {}, user);
          if (sRes && (sRes.year_level || sRes.program || sRes.full_name)) {
            setLiveStudentData(prev => {
              const newYr = Number(sRes.year_level) || prev?.year_level;
              const newProg = sRes.program || prev?.program;
              const newName = sRes.full_name || prev?.full_name;
              if (prev && prev.year_level === newYr && prev.program === newProg && prev.full_name === newName) {
                return prev;
              }
              return { year_level: newYr, program: newProg, full_name: newName };
            });
          }
        } catch (e) {}
      }
    };
    window.addEventListener('focus', handleSync);
    document.addEventListener('visibilitychange', handleSync);
    return () => {
      window.removeEventListener('focus', handleSync);
      document.removeEventListener('visibilitychange', handleSync);
    };
  }, [targetStudentId, user]);

  // Fetch real academic records from Supabase DB via backend API
  useEffect(() => {
    let isMounted = true;
    const fallbackTimer = setTimeout(() => {
      if (isMounted) setLoading(false);
    }, 3000);

    async function loadStudentRecords() {
      const activeId = targetStudentId || '12310';
      try {
        setLoading(true);

        // 1. Fetch live student profile to reflect any admin edits (e.g. corrected year level) immediately
        try {
          const sRes = await fetchApi(`/students/${encodeURIComponent(activeId)}`, {}, user);
          if (sRes && (sRes.year_level || sRes.program || sRes.full_name)) {
            if (isMounted) {
              setLiveStudentData(prev => {
                const newYr = Number(sRes.year_level) || prev?.year_level;
                const newProg = sRes.program || prev?.program;
                const newName = sRes.full_name || prev?.full_name;
                if (prev && prev.year_level === newYr && prev.program === newProg && prev.full_name === newName) {
                  return prev;
                }
                return { year_level: newYr, program: newProg, full_name: newName };
              });
            }
          }
        } catch (e) {
          try {
            const meRes = await fetchApi('/auth/me', {}, user);
            if (meRes?.user?.year_level && isMounted) {
              setLiveStudentData(prev => {
                const newYr = Number(meRes.user.year_level) || prev?.year_level;
                const newProg = meRes.user.program || prev?.program;
                const newName = meRes.user.full_name || prev?.full_name;
                if (prev && prev.year_level === newYr && prev.program === newProg && prev.full_name === newName) {
                  return prev;
                }
                return { year_level: newYr, program: newProg, full_name: newName };
              });
            }
          } catch (err) {}
        }

        // 2. Fetch student's specific academic records directly with student_id query param
        const data = await fetchApi(`/academic-records?student_id=${encodeURIComponent(activeId)}`, {}, user);
        if (isMounted && Array.isArray(data)) {
          const mappedRaw: AcademicGrade[] = data.map((r: any) => {
            const subCode = r.subject?.code || r.subject_id || r.code || r.subject || '';
            const subTitle = r.subject?.title || r.subject_id || r.title || r.subject || '';
            const unitsNum = Number(r.subject?.units || r.units || 3);
            const yrLevel = Number(r.subject?.year_level || r.year_level || 1);

            let semNum = 1;
            const rawSem = r.semester || r.subject?.semester || r.term;
            if (typeof rawSem === 'number' && !isNaN(rawSem)) {
              semNum = rawSem;
            } else if (typeof rawSem === 'string') {
              const s = rawSem.toLowerCase();
              if (s.includes('2') || s.includes('second')) semNum = 2;
              else if (s.includes('3') || s.includes('summer')) semNum = 3;
              else semNum = 1;
            }

            const isDrop = r.is_dropped || r.raw_grade === '9' || r.grade === 9 || r.status === 'dropped';
            const numGrade = isDrop ? null : (r.grade != null ? Number(r.grade) : null);

            let statusStr: 'passed' | 'failed' | 'dropped' = 'failed';
            if (isDrop) {
              statusStr = 'dropped';
            } else if (r.status === 'passed' || (numGrade != null && (numGrade <= 3.0 || numGrade >= 75))) {
              statusStr = 'passed';
            } else if (r.status === 'failed' || numGrade === 5 || r.raw_grade === '5') {
              statusStr = 'failed';
            } else if (numGrade != null) {
              statusStr = numGrade <= 3.0 ? 'passed' : 'failed';
            }

            return {
              id: String(r.id || Math.random()),
              studentId: activeId,
              studentName: r.studentName || r.full_name || '',
              code: subCode,
              title: subTitle,
              units: unitsNum,
              grade: numGrade,
              rawGrade: r.raw_grade || (numGrade != null ? String(numGrade) : null),
              term: r.term || r.academic_year || '2025-2026 1st Sem',
              academicYear: r.academic_year || '2025-2026',
              semester: semNum,
              yearLevel: yrLevel,
              status: statusStr,
              isDropped: isDrop
            };
          });

          setRawDbGrades(mappedRaw);
        }
      } catch (err) {
        console.warn('Failed to load academic records from Supabase:', err);
      } finally {
        clearTimeout(fallbackTimer);
        if (isMounted) setLoading(false);
      }
    }

    loadStudentRecords();
    return () => {
      isMounted = false;
      clearTimeout(fallbackTimer);
    };
  }, [targetStudentId, user]);

  // Build strict curriculum-aligned grade list based on official GCT catalog
  const completeCurriculumGrades = useMemo(() => {
    return buildCompleteStudentGrades(studentObj, rawDbGrades);
  }, [studentObj, rawDbGrades]);

  // Overall Academic Statistics & Metrics Calculation
  const academicMetrics = useMemo(() => {
    const gradedTaken = completeCurriculumGrades.filter(
      g => g.status !== 'not_taken' && g.status !== 'dropped' && !g.isDropped && g.grade !== null && !isNaN(Number(g.grade)) && Number(g.grade) > 0
    );

    let totalGradePoints = 0;
    let totalGradedUnits = 0;

    gradedTaken.forEach(g => {
      const gNum = Number(g.grade);
      totalGradePoints += gNum * g.units;
      totalGradedUnits += g.units;
    });

    const gwa = totalGradedUnits > 0 ? (totalGradePoints / totalGradedUnits).toFixed(2) : '0.00';

    const totalCurriculumUnits = completeCurriculumGrades.reduce((acc, g) => acc + g.units, 0);
    const passedGrades = completeCurriculumGrades.filter(g => g.status === 'passed');
    const passedUnits = passedGrades.reduce((acc, g) => acc + g.units, 0);
    const failedGrades = completeCurriculumGrades.filter(g => g.status === 'failed');
    const droppedGrades = completeCurriculumGrades.filter(g => g.status === 'dropped');
    const notTakenGrades = completeCurriculumGrades.filter(g => g.status === 'not_taken');
    const retakenGrades = completeCurriculumGrades.filter(g => g.isRetake);

    const progressPercentage = totalCurriculumUnits > 0
      ? Math.min(100, Math.round((passedUnits / totalCurriculumUnits) * 100))
      : 0;

    return {
      gwa,
      passedUnits,
      totalCurriculumUnits,
      progressPercentage,
      passedCount: passedGrades.length,
      failedCount: failedGrades.length,
      droppedCount: droppedGrades.length,
      notTakenCount: notTakenGrades.length,
      retakeCount: retakenGrades.length,
      totalSubjectCount: completeCurriculumGrades.length
    };
  }, [completeCurriculumGrades]);

  // Filter records by search term
  const searchLower = searchTerm.toLowerCase().trim();
  const filteredCurriculumGrades = useMemo(() => {
    if (!searchLower) return completeCurriculumGrades;
    return completeCurriculumGrades.filter(
      g => g.code.toLowerCase().includes(searchLower) || g.title.toLowerCase().includes(searchLower)
    );
  }, [completeCurriculumGrades, searchLower]);

  // Group records for active year tab
  const activeYearRecords = useMemo(() => {
    return filteredCurriculumGrades.filter(g => g.yearLevel === selectedYearTab);
  }, [filteredCurriculumGrades, selectedYearTab]);

  const sem1Records = useMemo(() => activeYearRecords.filter(g => g.semester === 1), [activeYearRecords]);
  const sem2Records = useMemo(() => activeYearRecords.filter(g => g.semester === 2), [activeYearRecords]);
  const sem3Records = useMemo(() => activeYearRecords.filter(g => g.semester === 3), [activeYearRecords]);

  // Helper stats for year tabs
  const getYearTabStats = (yearNum: number) => {
    const yearGrades = completeCurriculumGrades.filter(g => g.yearLevel === yearNum);
    const totalUnits = yearGrades.reduce((acc, g) => acc + g.units, 0);
    const passedUnits = yearGrades.filter(g => g.status === 'passed').reduce((acc, g) => acc + g.units, 0);
    const isCompleted = totalUnits > 0 && passedUnits === totalUnits;
    const isCurrent = yearNum === studentYear;

    return {
      totalUnits,
      passedUnits,
      subjectCount: yearGrades.length,
      isCompleted,
      isCurrent
    };
  };

  const toggleAttemptsExpand = (recId: string) => {
    setExpandedAttempts(prev => ({ ...prev, [recId]: !prev[recId] }));
  };

  const yearLabel = selectedYearTab === 1 ? '1st Year' : selectedYearTab === 2 ? '2nd Year' : selectedYearTab === 3 ? '3rd Year' : '4th Year';

  return (
    <div style={{
      background: '#F8FAFC',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      maxWidth: '100vw',
      overflowX: 'hidden'
    }}>

      {/* BRAND HEADER BAR */}
      <header style={{
        background: 'linear-gradient(135deg, #1E3A8A 0%, #2563EB 55%, #1D4ED8 100%)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.15)',
        padding: '1rem 1.5rem',
        position: 'sticky',
        top: 0,
        zIndex: 40,
        boxShadow: '0 4px 20px -2px rgba(30, 58, 138, 0.25)'
      }}>
        <div style={{
          maxWidth: '1100px',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.9rem',
            textAlign: 'center',
            flexWrap: 'wrap'
          }}>
            <img
              src="/logo.png"
              alt="Garcia College of Technology Logo"
              style={{
                width: '46px',
                height: '46px',
                minWidth: '46px',
                objectFit: 'contain',
                filter: 'drop-shadow(0 4px 8px rgba(0, 0, 0, 0.25))'
              }}
            />
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center'
            }}>
              <h1 style={{
                fontSize: 'clamp(1rem, 2.4vw, 1.45rem)',
                fontWeight: 800,
                color: '#FFFFFF',
                margin: 0,
                lineHeight: 1.25,
                letterSpacing: '-0.02em',
                textShadow: '0 2px 4px rgba(0, 0, 0, 0.15)',
                textAlign: 'center'
              }}>
                AI-Based Subject Assessment & Recommendation System
              </h1>
              <p style={{
                fontSize: 'clamp(0.75rem, 1.5vw, 0.88rem)',
                fontWeight: 600,
                color: '#DBEAFE',
                margin: '0.15rem 0 0 0',
                lineHeight: 1.2,
                letterSpacing: '0.02em',
                textAlign: 'center'
              }}>
                Garcia College of Technology • Student Portal
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT AREA */}
      <main style={{
        flex: 1,
        padding: 'clamp(1rem, 2vw, 1.5rem) clamp(0.75rem, 2vw, 1rem) 5rem clamp(0.75rem, 2vw, 1rem)',
        maxWidth: '1100px',
        margin: '0 auto',
        width: '100%',
        minWidth: 0,
        boxSizing: 'border-box'
      }}>

        {/* STUDENT ACADEMIC PROFILE & SUMMARY DASHBOARD CARD */}
        <div style={{
          background: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid #E2E8F0',
          padding: 'clamp(1rem, 2vw, 1.35rem)',
          marginBottom: '1.25rem',
          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.03)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          width: '100%',
          maxWidth: '100%',
          minWidth: 0,
          boxSizing: 'border-box',
          overflow: 'hidden'
        }}>
          {/* Top Row: Student Identity & Academic Program Badges */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.75rem'
          }}>
            {/* Left: Name & ID */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0F172A', margin: 0, lineHeight: 1.2 }}>
                  {studentObj.name}
                </h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem' }}>
                  <span style={{
                    background: '#EFF6FF',
                    color: 'var(--primary)',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: '6px',
                    border: '1px solid #BFDBFE'
                  }}>
                    Student ID: {studentObj.student_id}
                  </span>
                  <span style={{
                    background: '#F1F5F9',
                    color: '#475569',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '6px'
                  }}>
                    Official Curriculum Track
                  </span>
                </div>
              </div>
            </div>

            {/* Right: Program & Year Badges */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
                padding: '0.4rem 0.8rem',
                borderRadius: '8px',
                fontSize: '0.8rem',
                color: '#334155',
                fontWeight: 700
              }}>
                <GraduationCap size={15} color="var(--primary)" />
                <span>Program: <strong style={{ color: '#0F172A' }}>{studentObj.program}</strong></span>
              </div>

              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
                padding: '0.4rem 0.8rem',
                borderRadius: '8px',
                fontSize: '0.8rem',
                color: '#334155',
                fontWeight: 700
              }}>
                <Calendar size={15} color="var(--primary)" />
                <span>Current Year: <strong style={{ color: '#0F172A' }}>{studentYear === 1 ? '1st Year' : studentYear === 2 ? '2nd Year' : studentYear === 3 ? '3rd Year' : '4th Year'}</strong></span>
              </div>
            </div>
          </div>

          {/* ACADEMIC METRICS CARDS ROW */}
          <div className="student-metrics-grid">
            {/* GWA Card */}
            <div style={{
              background: 'linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)',
              borderRadius: '12px',
              padding: '0.85rem 1rem',
              border: '1px solid #BFDBFE',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              minWidth: 0
            }}>
              <div>
                <p style={{ fontSize: '0.72rem', fontWeight: 700, color: '#1E40AF', margin: 0, textTransform: 'uppercase' }}>
                  General Weighted Average (GWA)
                </p>
                <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#1E3A8A', margin: '0.15rem 0 0 0' }}>
                  {academicMetrics.gwa}
                </h3>
              </div>
              <Award size={26} color="#2563EB" />
            </div>

            {/* Units Earned Card */}
            <div style={{
              background: 'linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 100%)',
              borderRadius: '12px',
              padding: '0.85rem 1rem',
              border: '1px solid #BBF7D0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              minWidth: 0
            }}>
              <div>
                <p style={{ fontSize: '0.72rem', fontWeight: 700, color: '#166534', margin: 0, textTransform: 'uppercase' }}>
                  Units Completed
                </p>
                <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#14532D', margin: '0.15rem 0 0 0' }}>
                  {academicMetrics.passedUnits} <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#166534' }}>/ {academicMetrics.totalCurriculumUnits} Units</span>
                </h3>
              </div>
              <TrendingUp size={26} color="#16A34A" />
            </div>

            {/* Curriculum Progress Card */}
            <div style={{
              background: '#F8FAFC',
              borderRadius: '12px',
              padding: '0.85rem 1rem',
              border: '1px solid #E2E8F0',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              minWidth: 0
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
                  Curriculum Progress
                </span>
                <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--primary)' }}>
                  {academicMetrics.progressPercentage}%
                </span>
              </div>
              <div style={{ background: '#E2E8F0', height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{
                  background: 'linear-gradient(90deg, #2563EB 0%, #1D4ED8 100%)',
                  height: '100%',
                  width: `${academicMetrics.progressPercentage}%`,
                  borderRadius: '4px',
                  transition: 'width 0.5s ease-in-out'
                }} />
              </div>
            </div>

            {/* Subject Status Counters Card */}
            <div style={{
              background: '#F8FAFC',
              borderRadius: '12px',
              padding: '0.75rem 0.6rem',
              border: '1px solid #E2E8F0',
              display: 'grid',
              gridTemplateColumns: '1fr auto 1fr auto 1fr auto 1fr',
              alignItems: 'center',
              textAlign: 'center',
              gap: '0.2rem',
              minWidth: 0,
              overflow: 'hidden'
            }}>
              <div style={{ textAlign: 'center', minWidth: 0 }}>
                <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#16A34A', display: 'block' }}>{academicMetrics.passedCount}</span>
                <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748B', display: 'block' }}>Passed</span>
              </div>
              <div style={{ height: '24px', width: '1px', background: '#CBD5E1' }} />
              <div style={{ textAlign: 'center', minWidth: 0 }}>
                <span style={{ fontSize: '0.95rem', fontWeight: 800, color: academicMetrics.failedCount > 0 ? '#DC2626' : '#64748B', display: 'block' }}>{academicMetrics.failedCount}</span>
                <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748B', display: 'block' }}>Failed</span>
              </div>
              <div style={{ height: '24px', width: '1px', background: '#CBD5E1' }} />
              <div style={{ textAlign: 'center', minWidth: 0 }}>
                <span style={{ fontSize: '0.95rem', fontWeight: 800, color: academicMetrics.droppedCount > 0 ? '#D97706' : '#64748B', display: 'block' }}>{academicMetrics.droppedCount}</span>
                <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748B', display: 'block' }}>Dropped</span>
              </div>
              <div style={{ height: '24px', width: '1px', background: '#CBD5E1' }} />
              <div style={{ textAlign: 'center', minWidth: 0 }}>
                <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#64748B', display: 'block' }}>{academicMetrics.notTakenCount}</span>
                <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748B', display: 'block' }}>Remaining</span>
              </div>
            </div>
          </div>

          {/* Bottom Row: Year Switcher Pills & Live Search Bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.75rem',
            paddingTop: '0.75rem',
            borderTop: '1px solid #F1F5F9'
          }}>
            {/* Year Switcher Pills */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
              {[1, 2, 3, 4].map(yearNum => {
                const label = yearNum === 1 ? '1st Year' : yearNum === 2 ? '2nd Year' : yearNum === 3 ? '3rd Year' : '4th Year';
                const isSelected = yearNum === selectedYearTab;
                const stats = getYearTabStats(yearNum);

                return (
                  <button
                    key={yearNum}
                    type="button"
                    onClick={() => setSelectedYearTab(yearNum)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      padding: '0.45rem 0.85rem',
                      borderRadius: '8px',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      background: isSelected ? 'var(--primary)' : '#F1F5F9',
                      color: isSelected ? '#FFFFFF' : '#475569',
                      border: isSelected ? '1px solid var(--primary)' : '1px solid #E2E8F0',
                      boxShadow: isSelected ? '0 2px 8px rgba(37, 99, 235, 0.28)' : 'none'
                    }}
                  >
                    <Layers size={13} />
                    <span>{label}</span>
                    {stats.isCurrent ? (
                      <span style={{
                        fontSize: '0.65rem',
                        background: isSelected ? 'rgba(255, 255, 255, 0.25)' : 'var(--primary)',
                        color: '#FFFFFF',
                        padding: '1px 6px',
                        borderRadius: '10px',
                        fontWeight: 800
                      }}>
                        Current
                      </span>
                    ) : stats.isCompleted ? (
                      <span style={{
                        fontSize: '0.65rem',
                        background: isSelected ? 'rgba(255, 255, 255, 0.25)' : '#DCFCE7',
                        color: isSelected ? '#FFFFFF' : '#166534',
                        padding: '1px 6px',
                        borderRadius: '10px',
                        fontWeight: 700
                      }}>
                        Completed
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>

            {/* Live Search Bar */}
            <div style={{ position: 'relative', width: '280px', maxWidth: '100%' }}>
              <input
                type="text"
                placeholder="Search subject code or title..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="form-input"
                style={{
                  paddingLeft: '2.1rem',
                  fontSize: '0.82rem',
                  height: '36px',
                  width: '100%',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  background: '#F8FAFC'
                }}
              />
              <Search size={14} color="#94A3B8" style={{ position: 'absolute', left: '0.7rem', top: '50%', transform: 'translateY(-50%)' }} />
            </div>
          </div>
        </div>

        {/* SECTION TITLE */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1rem',
          padding: '0 0.2rem',
          flexWrap: 'wrap',
          gap: '0.5rem'
        }}>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0F172A', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <BookOpen size={16} color="var(--primary)" />
              {yearLabel} Official Curriculum Grade Sheet
            </h3>
            <p style={{ fontSize: '0.78rem', color: '#64748B', margin: '0.15rem 0 0 0' }}>
              Official GCT {studentObj.program} catalog subjects and student academic marks recorded in Supabase DB
            </p>
          </div>
          <span style={{
            fontWeight: 800,
            color: 'var(--primary)',
            background: '#EFF6FF',
            padding: '4px 10px',
            borderRadius: '8px',
            fontSize: '0.78rem',
            border: '1px solid #BFDBFE'
          }}>
            {activeYearRecords.length} {activeYearRecords.length === 1 ? 'Subject' : 'Subjects'} ({activeYearRecords.reduce((acc, g) => acc + g.units, 0)} Total Units)
          </span>
        </div>

        {/* SEMESTER TABLES SECTION */}
        {loading ? (
          <div style={{
            background: '#FFFFFF',
            borderRadius: '16px',
            border: '1px solid #E2E8F0',
            padding: '3.5rem',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.75rem',
            color: '#64748B'
          }}>
            <Loader2 size={30} color="var(--primary)" style={{ animation: 'spin 1s linear infinite' }} />
            <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600 }}>Syncing official curriculum grades with Supabase database...</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

            {/* Render Semester Card Helper */}
            {[
              { semNum: 1, title: '1st Semester', records: sem1Records },
              { semNum: 2, title: '2nd Semester', records: sem2Records },
              { semNum: 3, title: 'Summer Term', records: sem3Records }
            ].map(({ semNum, title, records }) => {
              // Hide Summer Term if empty for this year level
              if (semNum === 3 && records.length === 0) return null;

              const semUnits = records.reduce((acc, g) => acc + g.units, 0);
              const semPassedUnits = records.filter(g => g.status === 'passed').reduce((acc, g) => acc + g.units, 0);

              return (
                <div key={semNum} style={{
                  background: '#FFFFFF',
                  borderRadius: '16px',
                  border: '1px solid #E2E8F0',
                  padding: 'clamp(1rem, 2vw, 1.4rem)',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)',
                  width: '100%',
                  maxWidth: '100%',
                  minWidth: 0,
                  boxSizing: 'border-box',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '1rem',
                    paddingBottom: '0.75rem',
                    borderBottom: '1px solid #F1F5F9',
                    flexWrap: 'wrap',
                    gap: '0.5rem'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Calendar size={17} color={semNum === 3 ? '#D97706' : 'var(--primary)'} />
                      <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: semNum === 3 ? '#D97706' : '#0F172A', margin: 0 }}>
                        {title}
                      </h4>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{
                        fontSize: '0.76rem',
                        fontWeight: 700,
                        color: semNum === 3 ? '#D97706' : 'var(--primary)',
                        background: semNum === 3 ? '#FEF3C7' : '#EFF6FF',
                        padding: '3px 9px',
                        borderRadius: '6px',
                        border: semNum === 3 ? '1px solid #FDE68A' : '1px solid #BFDBFE'
                      }}>
                        {semUnits} Units ({records.length} {records.length === 1 ? 'subject' : 'subjects'})
                      </span>
                      {semPassedUnits > 0 && (
                        <span style={{
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          color: '#166534',
                          background: '#DCFCE7',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          border: '1px solid #86EFAC'
                        }}>
                          {semPassedUnits} Units Cleared
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="table-container" style={{ width: '100%', maxWidth: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                    <table className="custom-table" style={{ fontSize: '0.84rem', minWidth: '580px' }}>
                      <thead>
                        <tr>
                          <th>Subject Code</th>
                          <th>Subject Title</th>
                          <th>Units</th>
                          <th>Grade</th>
                          <th>Status</th>
                          <th>Retake History</th>
                        </tr>
                      </thead>
                      <tbody>
                        {records.map(rec => {
                          const isExpanded = !!expandedAttempts[rec.id];
                          const hasAttempts = rec.attempts && rec.attempts.length > 1;

                          return (
                            <React.Fragment key={rec.id}>
                              <tr>
                                <td style={{ fontWeight: 800, color: semNum === 3 ? '#D97706' : 'var(--primary)' }}>
                                  {rec.code}
                                </td>
                                <td style={{ fontWeight: 600, color: '#1E293B' }}>
                                  {rec.title}
                                </td>
                                <td style={{ fontWeight: 700 }}>
                                  {rec.units} {rec.units === 1 ? 'Unit' : 'Units'}
                                </td>
                                <td style={{
                                  fontWeight: 800,
                                  color: rec.status === 'dropped'
                                    ? '#D97706'
                                    : rec.status === 'passed'
                                      ? '#16A34A'
                                      : rec.status === 'failed'
                                        ? '#DC2626'
                                        : '#94A3B8'
                                }}>
                                  {rec.status === 'dropped'
                                    ? 'DRP'
                                    : rec.status === 'not_taken' || rec.grade == null
                                      ? '—'
                                      : (Number(rec.grade) <= 5.0 ? Number(rec.grade).toFixed(2) : `${Number(rec.grade).toFixed(1)}%`)}
                                </td>
                                <td>
                                  {rec.status === 'passed' ? (
                                    <span className="badge badge-passed" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                                      <CheckCircle2 size={12} /> Passed
                                    </span>
                                  ) : rec.status === 'failed' ? (
                                    <span className="badge badge-failed" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                                      <AlertTriangle size={12} /> Failed
                                    </span>
                                  ) : rec.status === 'dropped' ? (
                                    <span className="badge" style={{ background: '#FEF3C7', color: '#B45309', border: '1px solid #FDE68A', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                                      <AlertTriangle size={12} /> Dropped (DRP)
                                    </span>
                                  ) : (
                                    <span style={{
                                      fontSize: '0.74rem',
                                      fontWeight: 600,
                                      color: '#64748B',
                                      background: '#F1F5F9',
                                      padding: '3px 8px',
                                      borderRadius: '6px',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '0.3rem'
                                    }}>
                                      <Clock size={12} /> Not Yet Taken
                                    </span>
                                  )}
                                </td>
                                <td>
                                  {hasAttempts ? (
                                    <button
                                      type="button"
                                      onClick={() => toggleAttemptsExpand(rec.id)}
                                      style={{
                                        background: isExpanded ? '#EFF6FF' : '#F8FAFC',
                                        border: '1px solid #BFDBFE',
                                        color: '#1E40AF',
                                        borderRadius: '6px',
                                        padding: '2px 8px',
                                        fontSize: '0.72rem',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '0.3rem'
                                      }}
                                    >
                                      <RotateCcw size={11} />
                                      {rec.attempts ? rec.attempts.length : 0} Attempts {isExpanded ? '▲' : '▼'}
                                    </button>
                                  ) : rec.isRetake ? (
                                    <span style={{ fontSize: '0.72rem', color: '#D97706', fontWeight: 700 }}>
                                      Retaken Subject
                                    </span>
                                  ) : (
                                    <span style={{ fontSize: '0.72rem', color: '#94A3B8' }}>
                                      Standard
                                    </span>
                                  )}
                                </td>
                              </tr>

                              {/* Expanded Retake Attempt History Rows */}
                              {isExpanded && rec.attempts && (
                                <tr>
                                  <td colSpan={6} style={{ background: '#F8FAFC', padding: '0.75rem 1rem', borderLeft: '3px solid var(--primary)' }}>
                                    <div style={{ fontSize: '0.76rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                                      📜 Attempt History for {rec.code} - {rec.title}:
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                      {rec.attempts.map((att: any, attIdx: number) => (
                                        <div key={attIdx} style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'space-between',
                                          fontSize: '0.74rem',
                                          padding: '4px 8px',
                                          background: '#FFFFFF',
                                          borderRadius: '4px',
                                          border: '1px solid #E2E8F0'
                                        }}>
                                          <span>
                                            <strong>Attempt {attIdx + 1}:</strong> {att.academicYear || att.term || 'Recorded Term'} ({att.semester ? `Sem ${att.semester}` : 'Regular'})
                                          </span>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <span style={{ fontWeight: 700 }}>
                                              {att.status === 'dropped' ? 'DRP' : att.grade != null ? Number(att.grade).toFixed(2) : '—'}
                                            </span>
                                            <span style={{
                                              color: att.status === 'passed' ? '#16A34A' : att.status === 'dropped' ? '#D97706' : '#DC2626',
                                              fontWeight: 700
                                            }}>
                                              {att.status.toUpperCase()}
                                            </span>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}

                        {records.length === 0 && (
                          <tr>
                            <td colSpan={6} style={{ textAlign: 'center', padding: '1.75rem', color: '#94A3B8', fontSize: '0.82rem' }}>
                              No official curriculum subjects found for {title} matching search filter.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}

          </div>
        )}

      </main>

      {/* FOOTER */}
      <footer style={{
        background: '#FFFFFF',
        borderTop: '1px solid #E2E8F0',
        padding: '1.25rem 1.5rem',
        textAlign: 'center',
        fontSize: '0.78rem',
        color: '#64748B',
        marginTop: 'auto'
      }}>
        © 2026 Garcia College of Technology. All rights reserved.
      </footer>

    </div>
  );
};

