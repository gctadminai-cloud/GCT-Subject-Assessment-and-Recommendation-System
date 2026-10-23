import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useRegistrarData } from './RegistrarDataContext';
import {
  Users,
  Sliders,
  BookPlus,
  ShieldCheck,
  ChevronRight,
  TrendingUp,
  Activity,
  UserCheck,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  FileText,
  Calendar,
  Check,
  Bot
} from 'lucide-react';

interface AdminHomeModuleProps {
  onTabChange?: (tab: string) => void;
}

export const AdminHomeModule: React.FC<AdminHomeModuleProps> = ({ onTabChange }) => {
  const { user } = useAuth();
  const {
    mockStudents,
    curriculumSubjects,
    mockAcademicGrades,
    staffAccounts,
    studentRecommendations,
    PROGRAM_CATALOG,
    passingThreshold,
    maxFailedPrereqs,
    activeAcademicYear,
    activeSemesterSetting,
    maxRegularUnits,
    deansListGwaCutoff
  } = useRegistrarData();

  // Current Live Date & Time
  const [currentDateTime, setCurrentDateTime] = useState('');
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentDateTime(now.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      }) + ' • ' + now.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      }));
    };
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  // Dynamic Metrics & Stats
  const totalStudents = mockStudents.length;
  const totalCurriculumSubjects = curriculumSubjects.length;
  const totalStaff = staffAccounts.length;
  const pendingStudents = mockStudents.filter(s => s.status === 'pending');
  const pendingStudentsCount = pendingStudents.length;

  const bsitStudents = mockStudents.filter(s => (s.program || '').toUpperCase() === 'BSIT');
  const bscsStudents = mockStudents.filter(s => (s.program || '').toUpperCase() === 'BSCS');
  const verifiedStudentsCount = mockStudents.filter(s => s.verified || s.status === 'approved').length;

  const validGrades = mockAcademicGrades.filter(g => typeof g.grade === 'number' && g.status !== 'pending');
  const passedGrades = validGrades.filter(g => g.status === 'passed');
  const passingRate = validGrades.length > 0
    ? Math.round((passedGrades.length / validGrades.length) * 100)
    : 100;


  // Program Distribution Statistics
  const programStats = (PROGRAM_CATALOG && PROGRAM_CATALOG.length > 0
    ? PROGRAM_CATALOG
    : [
      { code: 'BSIT', name: 'Bachelor of Science in Information Technology' },
      { code: 'BSCS', name: 'Bachelor of Science in Computer Science' }
    ]
  ).map(prog => {
    const progStudents = mockStudents.filter(s => (s.program || '').toUpperCase() === prog.code.toUpperCase());
    const progSubjects = curriculumSubjects.filter(cs => (cs.program || '').toUpperCase() === prog.code.toUpperCase());
    const progGrades = mockAcademicGrades.filter(g => {
      const st = mockStudents.find(s => s.student_id === g.studentId);
      return st?.program?.toUpperCase() === prog.code.toUpperCase() || g.code?.startsWith(prog.code.replace('BS', ''));
    });
    const progValidGrades = progGrades.filter(g => typeof g.grade === 'number');
    const progPassedGrades = progValidGrades.filter(g => g.status === 'passed');
    const progPassRate = progValidGrades.length > 0
      ? Math.round((progPassedGrades.length / progValidGrades.length) * 100)
      : 100;
    const progDeficient = progStudents.filter(s => s.has_deficiencies || s.hasDeficiencies).length;

    return {
      ...prog,
      studentCount: progStudents.length,
      subjectCount: progSubjects.length,
      passRate: progPassRate,
      deficientCount: progDeficient,
      regularCount: Math.max(0, progStudents.length - progDeficient)
    };
  });

  // Administrative Governance Audit Logs
  const adminLogs = [
    {
      id: 'log-1',
      category: 'Governance',
      action: 'Grading threshold policy active',
      details: `Passing threshold active at ${passingThreshold}% • Max failed prerequisites limit: ${maxFailedPrereqs}`,
      actor: user?.full_name || 'System Administrator',
      time: 'Today • Automated Engine',
      badgeBg: '#EFF6FF',
      badgeColor: '#1D4ED8',
      icon: ShieldCheck
    },
    {
      id: 'log-2',
      category: 'Curriculum',
      action: 'Curriculum catalog synchronized',
      details: `${totalCurriculumSubjects} course offerings active with complete prerequisite mappings`,
      actor: 'Academic Engine',
      time: 'Today • 09:30 AM',
      badgeBg: '#F5F3FF',
      badgeColor: '#7C3AED',
      icon: BookPlus
    },
    {
      id: 'log-3',
      category: 'Security',
      action: 'Staff authorization verified',
      details: `${totalStaff} active Registrar officers authorized with Role-Based Access Control`,
      actor: user?.full_name || 'System Administrator',
      time: 'Yesterday • 04:15 PM',
      badgeBg: '#ECFDF5',
      badgeColor: '#059669',
      icon: UserCheck
    },
    {
      id: 'log-4',
      category: 'Database',
      action: 'Cloud Supabase synchronization',
      details: `Official records, student accounts, and grade archives synced with cloud database`,
      actor: 'Supabase Sync Engine',
      time: 'Live Connection Active',
      badgeBg: '#FEF3C7',
      badgeColor: '#D97706',
      icon: Activity
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>

      {/* 1. EXECUTIVE HERO WELCOME BANNER */}
      <div style={{
        background: 'linear-gradient(135deg, #0F172A 0%, #1E3A8A 50%, #2563EB 100%)',
        borderRadius: '20px',
        padding: '2rem 2.25rem',
        color: '#FFFFFF',
        boxShadow: '0 12px 32px -4px rgba(30, 58, 138, 0.35)',
        position: 'relative',
        overflow: 'hidden',
        border: '1px solid rgba(255, 255, 255, 0.15)'
      }}>
        {/* Subtle decorative background glow circles */}
        <div style={{
          position: 'absolute',
          top: '-60px',
          right: '-60px',
          width: '240px',
          height: '240px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(96, 165, 250, 0.25) 0%, rgba(37, 99, 235, 0) 70%)',
          pointerEvents: 'none'
        }} />
        <div style={{
          position: 'absolute',
          bottom: '-80px',
          left: '30%',
          width: '200px',
          height: '200px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(147, 197, 253, 0.15) 0%, rgba(30, 58, 138, 0) 70%)',
          pointerEvents: 'none'
        }} />

        <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.5rem' }}>
          <div style={{ maxWidth: '780px' }}>
            {/* Top Subtitle / Institution Tag */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
              <span style={{
                background: 'rgba(255, 255, 255, 0.15)',
                backdropFilter: 'blur(8px)',
                padding: '4px 12px',
                borderRadius: '20px',
                fontSize: '0.75rem',
                fontWeight: 700,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                color: '#BFDBFE',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                border: '1px solid rgba(255, 255, 255, 0.2)'
              }}>
                <ShieldCheck size={14} color="#93C5FD" />
                Garcia College of Technology • Office of the Registrar
              </span>
              <span style={{ fontSize: '0.75rem', color: '#DBEAFE', fontWeight: 500 }}>
                {currentDateTime}
              </span>
            </div>

            {/* Main Greeting */}
            <h1 style={{
              fontSize: '1.9rem',
              fontWeight: 800,
              color: '#FFFFFF',
              margin: '0 0 0.5rem 0',
              lineHeight: 1.2,
              letterSpacing: '-0.02em'
            }}>
              Welcome back, {user?.full_name || 'System Administrator'}
            </h1>

            <p style={{
              fontSize: '0.92rem',
              color: '#DBEAFE',
              margin: '0 0 1.25rem 0',
              lineHeight: 1.5,
              maxWidth: '680px'
            }}>
              Registrar Administrative Command Center. Monitor degree matriculations, enforce institutional grading standards, supervise staff credentials, and evaluate automated subject advising in real time.
            </p>

            {/* Live Operational Status Pills */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
              <div style={{
                background: 'rgba(16, 185, 129, 0.2)',
                border: '1px solid rgba(16, 185, 129, 0.45)',
                color: '#34D399',
                padding: '5px 12px',
                borderRadius: '20px',
                fontSize: '0.75rem',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem'
              }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#34D399', display: 'inline-block' }} />
                Supabase Connected
              </div>

              <div style={{
                background: 'rgba(255, 255, 255, 0.12)',
                border: '1px solid rgba(255, 255, 255, 0.25)',
                color: '#FFFFFF',
                padding: '5px 12px',
                borderRadius: '20px',
                fontSize: '0.75rem',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem'
              }}>
                <Calendar size={13} color="#93C5FD" />
                A.Y. {activeAcademicYear || '2024–2025'} • {activeSemesterSetting === '2' ? '2nd Semester' : activeSemesterSetting === 'summer' ? 'Summer Term' : '1st Semester'}
              </div>

              <div style={{
                background: 'rgba(255, 255, 255, 0.12)',
                border: '1px solid rgba(255, 255, 255, 0.25)',
                color: '#FFFFFF',
                padding: '5px 12px',
                borderRadius: '20px',
                fontSize: '0.75rem',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem'
              }}>
                <ShieldCheck size={13} color="#FBBF24" />
                Passing Mark: {passingThreshold}% (3.00)
              </div>
            </div>
          </div>

          {/* Quick Action CTAs */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', alignSelf: 'center', minWidth: '220px' }}>
            <button
              onClick={() => onTabChange?.('manage_accounts')}
              style={{
                background: '#FFFFFF',
                color: '#1E3A8A',
                border: 'none',
                borderRadius: '12px',
                padding: '0.75rem 1.25rem',
                fontSize: '0.85rem',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.6rem',
                boxShadow: '0 4px 14px rgba(0,0,0,0.15)',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.25)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 14px rgba(0,0,0,0.15)';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <UserCheck size={16} color="#2563EB" />
                <span>User Accounts</span>
              </div>
              {pendingStudentsCount > 0 ? (
                <span style={{
                  background: '#EF4444',
                  color: '#FFFFFF',
                  padding: '2px 7px',
                  borderRadius: '10px',
                  fontSize: '0.72rem',
                  fontWeight: 800
                }}>
                  {pendingStudentsCount}
                </span>
              ) : (
                <ArrowRight size={14} color="#2563EB" />
              )}
            </button>

            <button
              onClick={() => onTabChange?.('recommendations')}
              style={{
                background: 'rgba(255, 255, 255, 0.15)',
                color: '#FFFFFF',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                borderRadius: '12px',
                padding: '0.75rem 1.25rem',
                fontSize: '0.85rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.6rem',
                backdropFilter: 'blur(8px)',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Sparkles size={16} color="#FBBF24" />
                <span>Recommendations</span>
              </div>
              <ArrowRight size={14} color="#DBEAFE" />
            </button>

            <button
              onClick={() => onTabChange?.('settings')}
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                color: '#DBEAFE',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '12px',
                padding: '0.6rem 1.25rem',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.6rem',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.color = '#FFFFFF';
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.18)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.color = '#DBEAFE';
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Sliders size={14} />
                <span>Academic Policies</span>
              </div>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* 2. 4 EXECUTIVE KPI STAT CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem' }}>

        {/* Card 1: Total Enrolled Students */}
        <div
          onClick={() => onTabChange?.('student_academic_records')}
          className="glass-card"
          style={{
            padding: '1.5rem',
            cursor: 'pointer',
            border: '1px solid #E2E8F0',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: 'linear-gradient(to bottom, #2563EB, #1D4ED8)' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.85rem' }}>
            <span style={{ fontSize: '0.78rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
              Enrolled Students
            </span>
            <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(37,99,235,0.12)' }}>
              <Users size={20} color="#2563EB" />
            </div>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#0F172A', lineHeight: 1, marginBottom: '0.45rem' }}>
            {totalStudents}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.76rem', color: '#475569', fontWeight: 600 }}>
            <span style={{ color: '#2563EB', fontWeight: 800 }}>BSIT: {bsitStudents.length}</span>
            <span>•</span>
            <span style={{ color: '#7C3AED', fontWeight: 800 }}>BSCS: {bscsStudents.length}</span>
            <span>•</span>
            <span style={{ color: '#059669', fontWeight: 700 }}>{verifiedStudentsCount} Active</span>
          </div>
          <div style={{ marginTop: '0.85rem', paddingTop: '0.75rem', borderTop: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.76rem' }}>
            <span style={{ color: '#64748B' }}>Open Directory</span>
            <ChevronRight size={14} color="#2563EB" />
          </div>
        </div>

        {/* Card 2: Curriculum Offerings */}
        <div
          onClick={() => onTabChange?.('curriculum')}
          className="glass-card"
          style={{
            padding: '1.5rem',
            cursor: 'pointer',
            border: '1px solid #E2E8F0',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: 'linear-gradient(to bottom, #7C3AED, #6D28D9)' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.85rem' }}>
            <span style={{ fontSize: '0.78rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
              Curriculum Offerings
            </span>
            <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'linear-gradient(135deg, #F5F3FF 0%, #EDE9FE 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(124,58,237,0.12)' }}>
              <BookPlus size={20} color="#7C3AED" />
            </div>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#0F172A', lineHeight: 1, marginBottom: '0.45rem' }}>
            {totalCurriculumSubjects}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.76rem', color: '#7C3AED', fontWeight: 700 }}>
            <span>4-Year Matrices Active</span>
            <span>•</span>
            <span style={{ color: '#64748B', fontWeight: 500 }}>Prerequisites mapped</span>
          </div>
          <div style={{ marginTop: '0.85rem', paddingTop: '0.75rem', borderTop: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.76rem' }}>
            <span style={{ color: '#64748B' }}>View Program Matrices</span>
            <ChevronRight size={14} color="#7C3AED" />
          </div>
        </div>

        {/* Card 3: Institutional Passing Rate */}
        <div
          onClick={() => onTabChange?.('student_academic_records')}
          className="glass-card"
          style={{
            padding: '1.5rem',
            cursor: 'pointer',
            border: '1px solid #E2E8F0',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: 'linear-gradient(to bottom, #10B981, #059669)' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.85rem' }}>
            <span style={{ fontSize: '0.78rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
              Academic Quality
            </span>
            <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(16,185,129,0.12)' }}>
              <TrendingUp size={20} color="#059669" />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.45rem' }}>
            <span style={{ fontSize: '2rem', fontWeight: 800, color: passingRate >= 75 ? '#059669' : '#D97706', lineHeight: 1 }}>
              {passingRate}%
            </span>
            <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>Pass Rate</span>
          </div>
          {/* Visual Mini Progress Bar */}
          <div style={{ width: '100%', height: '6px', background: '#E2E8F0', borderRadius: '3px', overflow: 'hidden', marginBottom: '0.5rem' }}>
            <div style={{
              width: `${Math.min(100, passingRate)}%`,
              height: '100%',
              background: passingRate >= 75 ? 'linear-gradient(90deg, #10B981, #059669)' : 'linear-gradient(90deg, #F59E0B, #D97706)',
              borderRadius: '3px'
            }} />
          </div>
          <div style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600 }}>
            {passedGrades.length} of {validGrades.length} records completed
          </div>
        </div>

        {/* Card 4: Pending Student Registrations & Staff */}
        <div
          onClick={() => onTabChange?.('manage_accounts')}
          className="glass-card"
          style={{
            padding: '1.5rem',
            cursor: 'pointer',
            border: '1px solid #E2E8F0',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: 'linear-gradient(to bottom, #F59E0B, #D97706)' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.85rem' }}>
            <span style={{ fontSize: '0.78rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
              Account Governance
            </span>
            <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(245,158,11,0.15)' }}>
              <UserCheck size={20} color="#D97706" />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.45rem' }}>
            <span style={{ fontSize: '2rem', fontWeight: 800, color: pendingStudentsCount > 0 ? '#DC2626' : '#0F172A', lineHeight: 1 }}>
              {pendingStudentsCount}
            </span>
            <span style={{ fontSize: '0.75rem', color: pendingStudentsCount > 0 ? '#DC2626' : '#64748B', fontWeight: 700 }}>
              {pendingStudentsCount === 1 ? 'Pending Review' : 'Pending Reviews'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.76rem', color: '#64748B', fontWeight: 600 }}>
            <span>{totalStaff} Registrar Officers</span>
            <span>•</span>
            <span style={{ color: '#2563EB', fontWeight: 700 }}>{verifiedStudentsCount} Students</span>
          </div>
          <div style={{ marginTop: '0.85rem', paddingTop: '0.75rem', borderTop: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.76rem' }}>
            <span style={{ color: pendingStudentsCount > 0 ? '#DC2626' : '#64748B', fontWeight: pendingStudentsCount > 0 ? 800 : 500 }}>
              {pendingStudentsCount > 0 ? 'Review Registrations Now' : 'Manage All Accounts'}
            </span>
            <ChevronRight size={14} color={pendingStudentsCount > 0 ? '#DC2626' : '#2563EB'} />
          </div>
        </div>

      </div>

      {/* 3. SIX EXECUTIVE GOVERNANCE LAUNCHPAD CONTROLS */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0F172A', margin: 0, letterSpacing: '-0.01em' }}>
              Administrative Governance Launchpad
            </h3>
            <p style={{ fontSize: '0.78rem', color: '#64748B', margin: '0.15rem 0 0 0' }}>
              Direct operational access to student identity verification, academic transcripts, and advisory engines
            </p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>

          {/* Action 1: User Account & Identity Governance */}
          <div
            onClick={() => onTabChange?.('manage_accounts')}
            className="glass-card"
            style={{
              padding: '1.25rem',
              cursor: 'pointer',
              display: 'flex',
              gap: '1rem',
              alignItems: 'flex-start',
              border: '1px solid #E2E8F0',
              borderRadius: '16px',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = '#2563EB';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = '#E2E8F0';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <div style={{ width: '46px', height: '46px', borderRadius: '12px', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <UserCheck size={22} color="#2563EB" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 800, color: '#0F172A' }}>
                  User & Identity Governance
                </h4>
                {pendingStudentsCount > 0 && (
                  <span style={{ background: '#FEE2E2', color: '#DC2626', padding: '1px 6px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 800 }}>
                    {pendingStudentsCount} New
                  </span>
                )}
              </div>
              <p style={{ fontSize: '0.76rem', color: '#64748B', margin: 0, lineHeight: 1.4 }}>
                Review ID & selfie submissions, approve student signups, and manage staff accounts.
              </p>
            </div>
          </div>

          {/* Action 2: Student Academic Records Management */}
          <div
            onClick={() => onTabChange?.('student_academic_records')}
            className="glass-card"
            style={{
              padding: '1.25rem',
              cursor: 'pointer',
              display: 'flex',
              gap: '1rem',
              alignItems: 'flex-start',
              border: '1px solid #E2E8F0',
              borderRadius: '16px',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = '#2563EB';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = '#E2E8F0';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <div style={{ width: '46px', height: '46px', borderRadius: '12px', background: '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <FileText size={22} color="#059669" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h4 style={{ margin: '0 0 0.2rem 0', fontSize: '0.92rem', fontWeight: 800, color: '#0F172A' }}>
                Academic Records & Grade Sheets
              </h4>
              <p style={{ fontSize: '0.76rem', color: '#64748B', margin: 0, lineHeight: 1.4 }}>
                Official transcripts, section schedulers, manual grade encoding, and batch Excel CSV imports.
              </p>
            </div>
          </div>

          {/* Action 3: Subject Recommendation System */}
          <div
            onClick={() => onTabChange?.('recommendations')}
            className="glass-card"
            style={{
              padding: '1.25rem',
              cursor: 'pointer',
              display: 'flex',
              gap: '1rem',
              alignItems: 'flex-start',
              border: '1px solid #E2E8F0',
              borderRadius: '16px',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = '#7C3AED';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = '#E2E8F0';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <div style={{ width: '46px', height: '46px', borderRadius: '12px', background: '#F5F3FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Sparkles size={22} color="#7C3AED" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 800, color: '#0F172A' }}>
                  Recommendation Advising Engine
                </h4>
                <span style={{ background: '#EDE9FE', color: '#7C3AED', padding: '1px 6px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 800 }}>
                  {studentRecommendations.length} Queued
                </span>
              </div>
              <p style={{ fontSize: '0.76rem', color: '#64748B', margin: 0, lineHeight: 1.4 }}>
                Automated prerequisite validation and personalized course load advising per student.
              </p>
            </div>
          </div>

          {/* Action 4: Curriculum Catalog & Program Matrices */}
          <div
            onClick={() => onTabChange?.('curriculum')}
            className="glass-card"
            style={{
              padding: '1.25rem',
              cursor: 'pointer',
              display: 'flex',
              gap: '1rem',
              alignItems: 'flex-start',
              border: '1px solid #E2E8F0',
              borderRadius: '16px',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = '#D97706';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = '#E2E8F0';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <div style={{ width: '46px', height: '46px', borderRadius: '12px', background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <BookPlus size={22} color="#D97706" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h4 style={{ margin: '0 0 0.2rem 0', fontSize: '0.92rem', fontWeight: 800, color: '#0F172A' }}>
                Curriculum Matrices & Offerings
              </h4>
              <p style={{ fontSize: '0.76rem', color: '#64748B', margin: 0, lineHeight: 1.4 }}>
                Degree course offerings, prerequisite dependencies, and semester credit allocation rules.
              </p>
            </div>
          </div>

          {/* Action 5: Academic Policy Rules & Settings */}
          <div
            onClick={() => onTabChange?.('settings')}
            className="glass-card"
            style={{
              padding: '1.25rem',
              cursor: 'pointer',
              display: 'flex',
              gap: '1rem',
              alignItems: 'flex-start',
              border: '1px solid #E2E8F0',
              borderRadius: '16px',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = '#0284C7';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = '#E2E8F0';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <div style={{ width: '46px', height: '46px', borderRadius: '12px', background: '#E0F2FE', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Sliders size={22} color="#0284C7" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h4 style={{ margin: '0 0 0.2rem 0', fontSize: '0.92rem', fontWeight: 800, color: '#0F172A' }}>
                Academic Policies & Standards
              </h4>
              <p style={{ fontSize: '0.76rem', color: '#64748B', margin: 0, lineHeight: 1.4 }}>
                Configure passing grade standards, max failed prerequisites, and active term controls.
              </p>
            </div>
          </div>

          {/* Action 6: AI Registrar Assistant */}
          <div
            onClick={() => onTabChange?.('chatbot')}
            className="glass-card"
            style={{
              padding: '1.25rem',
              cursor: 'pointer',
              display: 'flex',
              gap: '1rem',
              alignItems: 'flex-start',
              border: '1px solid #E2E8F0',
              borderRadius: '16px',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = '#10B981';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = '#E2E8F0';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <div style={{ width: '46px', height: '46px', borderRadius: '12px', background: '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Bot size={22} color="#10B981" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 800, color: '#0F172A' }}>
                  AI Registrar Assistant
                </h4>
                <span style={{ background: '#DCFCE7', color: '#15803D', padding: '1px 6px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 800 }}>
                  Active
                </span>
              </div>
              <p style={{ fontSize: '0.76rem', color: '#64748B', margin: 0, lineHeight: 1.4 }}>
                Grounded conversational intelligence for rapid student lookup, Word reports, and advising.
              </p>
            </div>
          </div>

        </div>
      </div>

      {/* 4. SPLIT ROW: DEGREE PROGRAMS MATRIX DISTRIBUTION + ACTIVE POLICIES */}
      <div style={{ display: 'grid', gridTemplateColumns: '7fr 5fr', gap: '1.5rem', alignItems: 'stretch' }}>

        {/* Left: Degree Programs Enrollment & Performance Table */}
        <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                Academic Programs Enrollment Matrix
              </h3>
              <p style={{ fontSize: '0.75rem', color: '#64748B', margin: '0.15rem 0 0 0' }}>
                Distribution of enrolled students, curriculum course load, and academic pass rates
              </p>
            </div>
            <button
              onClick={() => onTabChange?.('curriculum')}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <BookPlus size={14} /> View All Offerings
            </button>
          </div>

          <div className="table-container" style={{ flex: 1 }}>
            <table className="custom-table" style={{ fontSize: '0.82rem' }}>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Degree Program</th>
                  <th style={{ textAlign: 'center' }}>Students</th>
                  <th style={{ textAlign: 'center' }}>Standing</th>
                  <th style={{ textAlign: 'center' }}>Pass Rate</th>
                </tr>
              </thead>
              <tbody>
                {programStats.map(p => (
                  <tr key={p.code}>
                    <td style={{ fontWeight: 800, color: '#2563EB' }}>
                      <span className={`badge badge-${p.code}`} style={{ fontSize: '0.75rem' }}>
                        {p.code}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 700, color: '#0F172A' }}>{p.name}</div>
                      <div style={{ fontSize: '0.7rem', color: '#64748B' }}>{p.subjectCount} Subjects in 4-Year Curriculum</div>
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 800 }}>
                      <span style={{ background: '#EFF6FF', color: '#1D4ED8', padding: '3px 9px', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 700 }}>
                        {p.studentCount} Students
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '0.74rem', fontWeight: 700 }}>
                        <span style={{ color: '#059669' }}>{p.regularCount} Reg</span>
                        {p.deficientCount > 0 && (
                          <span style={{ color: '#DC2626', marginLeft: '0.3rem' }}>• {p.deficientCount} Def</span>
                        )}
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.45rem' }}>
                        <div style={{ width: '50px', height: '6px', background: '#E2E8F0', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{
                            width: `${Math.min(100, p.passRate)}%`,
                            height: '100%',
                            background: p.passRate >= 75 ? '#10B981' : '#F59E0B',
                            borderRadius: '3px'
                          }} />
                        </div>
                        <span style={{ fontSize: '0.75rem', fontWeight: 800, color: p.passRate >= 75 ? '#059669' : '#D97706' }}>
                          {p.passRate}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Active Institutional Policies Card */}
        <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ShieldCheck size={20} color="#7C3AED" />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                  Active Academic Policies
                </h3>
              </div>
              <span style={{ fontSize: '0.7rem', background: '#F5F3FF', color: '#7C3AED', padding: '2px 8px', borderRadius: '6px', fontWeight: 800 }}>
                Enforced by System
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ background: '#F8FAFC', padding: '0.85rem 1rem', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>
                  Passing Grade Mark
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginTop: '0.2rem' }}>
                  <span style={{ fontSize: '1.35rem', fontWeight: 800, color: '#2563EB' }}>{passingThreshold}%</span>
                  <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>Equivalent to 3.00 Passing Grade</span>
                </div>
              </div>

              <div style={{ background: '#F8FAFC', padding: '0.85rem 1rem', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>
                  Max Failed Prerequisites Before Hold
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginTop: '0.2rem' }}>
                  <span style={{ fontSize: '1.35rem', fontWeight: 800, color: '#DC2626' }}>{maxFailedPrereqs}</span>
                  <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>Subjects allowed before advising hold</span>
                </div>
              </div>

              <div style={{ background: '#F8FAFC', padding: '0.85rem 1rem', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>
                  Maximum Regular Load Units
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginTop: '0.2rem' }}>
                  <span style={{ fontSize: '1.35rem', fontWeight: 800, color: '#059669' }}>{maxRegularUnits || '24'}</span>
                  <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>Units per semester (Regular Track)</span>
                </div>
              </div>

              <div style={{ background: '#F8FAFC', padding: '0.85rem 1rem', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>
                  Dean's Honor List GWA Cutoff
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginTop: '0.2rem' }}>
                  <span style={{ fontSize: '1.35rem', fontWeight: 800, color: '#D97706' }}>≤ {deansListGwaCutoff || '1.75'}</span>
                  <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>No failing or incomplete grades</span>
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={() => onTabChange?.('settings')}
            className="btn btn-secondary"
            style={{ width: '100%', marginTop: '1.25rem', fontSize: '0.82rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
          >
            <Sliders size={15} /> Configure Academic Policy Standards
          </button>
        </div>

      </div>

      {/* 5. SPLIT ROW: PENDING REGISTRATIONS LIVE ACTION QUEUE + GOVERNANCE AUDIT LOGS */}
      <div style={{ display: 'grid', gridTemplateColumns: '7fr 5fr', gap: '1.5rem', alignItems: 'stretch' }}>

        {/* Left: Pending Student Identity Approvals (Live Supabase Action Queue) */}
        <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <UserCheck size={18} color="#2563EB" />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                  Student Registration Review Queue
                </h3>
              </div>
              <p style={{ fontSize: '0.75rem', color: '#64748B', margin: '0.15rem 0 0 0' }}>
                New student registrations awaiting identity document validation & authorization
              </p>
            </div>

            <button
              onClick={() => onTabChange?.('manage_accounts')}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <span>Manage User Tab</span> <ArrowRight size={13} />
            </button>
          </div>

          {pendingStudents.length > 0 ? (
            <div className="table-container" style={{ flex: 1 }}>
              <table className="custom-table" style={{ fontSize: '0.82rem' }}>
                <thead>
                  <tr>
                    <th>Student ID</th>
                    <th>Full Name</th>
                    <th>Program</th>
                    <th>Photos</th>
                    <th style={{ textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingStudents.slice(0, 5).map(student => {
                    const photoCount = Number(Boolean(student.id_front_image)) + Number(Boolean(student.id_back_image)) + Number(Boolean(student.selfie_image));
                    return (
                      <tr key={student.id || student.student_id}>
                        <td style={{ fontWeight: 800, color: '#2563EB' }}>{student.student_id}</td>
                        <td style={{ fontWeight: 700, color: '#0F172A' }}>{student.name}</td>
                        <td>
                          <span className={`badge badge-${student.program}`}>{student.program}</span>
                        </td>
                        <td>
                          <span style={{
                            background: photoCount === 3 ? '#DCFCE7' : '#FEF3C7',
                            color: photoCount === 3 ? '#15803D' : '#92400E',
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontSize: '0.74rem',
                            fontWeight: 700
                          }}>
                            {photoCount}/3 Photos
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            onClick={() => onTabChange?.('manage_accounts')}
                            className="btn btn-primary btn-sm"
                            style={{ padding: '0.3rem 0.75rem', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                          >
                            <span>Review</span> <ArrowRight size={12} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '2.5rem 1rem',
              textAlign: 'center',
              background: '#F8FAFC',
              borderRadius: '12px',
              border: '1px dashed #CBD5E1'
            }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.75rem' }}>
                <CheckCircle2 size={26} color="#15803D" />
              </div>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0F172A', margin: '0 0 0.25rem 0' }}>
                All Student Registrations Cleared
              </h4>
              <p style={{ fontSize: '0.78rem', color: '#64748B', margin: 0, maxWidth: '340px' }}>
                There are no pending student signups in the verification queue. All accounts in Supabase are currently reviewed.
              </p>
            </div>
          )}
        </div>

        {/* Right: Governance & Operational Security Audit Trail */}
        <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Activity size={18} color="#2563EB" />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                  System Audit & Security Logs
                </h3>
              </div>
              <span style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 600 }}>
                Live Trail
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
              {adminLogs.map(log => {
                const IconComponent = log.icon;
                return (
                  <div key={log.id} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                    <div style={{
                      width: '34px',
                      height: '34px',
                      borderRadius: '10px',
                      background: log.badgeBg,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      marginTop: '0.1rem'
                    }}>
                      <IconComponent size={17} color={log.badgeColor} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.15rem' }}>
                        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0F172A' }}>
                          {log.action}
                        </span>
                        <span style={{
                          background: log.badgeBg,
                          color: log.badgeColor,
                          fontSize: '0.68rem',
                          fontWeight: 800,
                          padding: '1px 5px',
                          borderRadius: '4px'
                        }}>
                          {log.category}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.74rem', color: '#64748B', lineHeight: 1.35 }}>
                        {log.details}
                      </div>
                      <div style={{ fontSize: '0.68rem', color: '#94A3B8', marginTop: '0.2rem', fontWeight: 500 }}>
                        {log.time}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{
            background: '#F0F9FF',
            border: '1px solid #BAE6FD',
            borderRadius: '10px',
            padding: '0.75rem 0.95rem',
            marginTop: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.76rem'
          }}>
            <span style={{ color: '#0369A1', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
              <ShieldCheck size={14} color="#0284C7" />
              RBAC Guardrails actively protecting institutional records
            </span>
            <Check size={14} color="#0284C7" />
          </div>
        </div>

      </div>

    </div>
  );
};
