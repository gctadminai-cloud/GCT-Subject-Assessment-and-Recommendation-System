import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useRegistrarData } from './RegistrarDataContext';
import {
  Users,
  Sparkles,
  Plus,
  Upload,
  CheckCircle2,
  ChevronRight,
  FileCheck,
  Activity,
  AlertTriangle,
  ArrowRight,
  Calendar,
  Search,
  ShieldCheck,
  Check,
  BookOpen
} from 'lucide-react';

interface StaffHomeModuleProps {
  onTabChange?: (tab: string) => void;
  onOpenEncodeModal?: () => void;
  onOpenUploadModal?: () => void;
  onSelectRecStudent?: (studentId: string) => void;
}

export const StaffHomeModule: React.FC<StaffHomeModuleProps> = ({
  onTabChange
}) => {
  const { user } = useAuth();
  const {
    mockStudents,
    mockAcademicGrades,
    curriculumSubjects,
    activeAcademicYear,
    activeSemesterSetting
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

  // Dynamic Operational Counts
  const totalStudents = mockStudents.length;
  const bsitStudents = mockStudents.filter(s => (s.program || '').toUpperCase() === 'BSIT');
  const bscsStudents = mockStudents.filter(s => (s.program || '').toUpperCase() === 'BSCS');

  const totalGradesEncoded = mockAcademicGrades.length;

  const deficientStudents = mockStudents.filter(s => s.has_deficiencies || s.hasDeficiencies);
  const deficientStudentsCount = deficientStudents.length;

  // Staff Operational Logs (Real-time stream)
  const staffOperationalLogs = [
    {
      id: 'op-1',
      action: 'Grade record encoded & verified',
      subject: 'IT 201 - Database Management Systems',
      student: 'Official Student Record Encoded',
      staff: user?.full_name || 'Registrar Staff',
      time: 'Today • 10:45 AM',
      badgeBg: '#EFF6FF',
      badgeColor: '#1D4ED8',
      icon: Plus
    },
    {
      id: 'op-2',
      action: 'Prerequisite check & advising load evaluated',
      subject: 'CS 201 - Data Structures & Algorithms',
      student: 'Automated Recommendation Generated',
      staff: 'Recommendation Engine',
      time: 'Today • 09:30 AM',
      badgeBg: '#F5F3FF',
      badgeColor: '#7C3AED',
      icon: Sparkles
    },
    {
      id: 'op-3',
      action: 'Grade sheet batch verified',
      subject: 'BSIT 1st Year Section A (2024–2025 1st Sem)',
      student: 'Batch Grade Validation Complete',
      staff: user?.full_name || 'Registrar Staff',
      time: 'Yesterday • 03:15 PM',
      badgeBg: '#ECFDF5',
      badgeColor: '#059669',
      icon: CheckCircle2
    },
    {
      id: 'op-4',
      action: 'Departmental grade sheet imported',
      subject: 'Class Grade Sheet Excel Upload',
      student: 'Database Records Synchronized',
      staff: user?.full_name || 'Registrar Staff',
      time: 'Yesterday • 01:20 PM',
      badgeBg: '#FEF3C7',
      badgeColor: '#D97706',
      icon: Upload
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>

      {/* 1. STAFF OPERATIONAL HERO WELCOME BANNER */}
      <div style={{
        background: 'linear-gradient(135deg, #1E3A8A 0%, #2563EB 55%, #1D4ED8 100%)',
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
          background: 'radial-gradient(circle, rgba(147, 197, 253, 0.25) 0%, rgba(37, 99, 235, 0) 70%)',
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
                Garcia College of Technology • Registrar Operations Desk
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
              Good day, {user?.full_name || 'Registrar Staff'}
            </h1>

            <p style={{
              fontSize: '0.92rem',
              color: '#DBEAFE',
              margin: '0 0 1.25rem 0',
              lineHeight: 1.5,
              maxWidth: '680px'
            }}>
              Welcome to the daily academic operations desk. Encode official grade sheets, review prerequisite-validated course recommendations, inspect student transcripts, and guide enrolled students.
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
                Records Database Online
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
                <Sparkles size={13} color="#FBBF24" />
                Recommendation Advising Engine Active
              </div>
            </div>
          </div>

          {/* Quick Action CTAs */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', alignSelf: 'center', minWidth: '220px' }}>
            <button
              onClick={() => onTabChange?.('recommendations')}
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
                <Sparkles size={16} color="#7C3AED" />
                <span>Review Recommendations</span>
              </div>
              <ArrowRight size={14} color="#7C3AED" />
            </button>

            <button
              onClick={() => onTabChange?.('academic_records')}
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
                <Plus size={16} color="#93C5FD" />
                <span>Encode Grade Sheet</span>
              </div>
              <ArrowRight size={14} color="#DBEAFE" />
            </button>

            <button
              onClick={() => onTabChange?.('students')}
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
                <Search size={14} />
                <span>Student Directory</span>
              </div>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* 2. 4 OPERATIONAL KPI CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem' }}>

        {/* Card 1: Curriculum Offerings */}
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
              <BookOpen size={20} color="#7C3AED" />
            </div>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#0F172A', lineHeight: 1, marginBottom: '0.45rem' }}>
            {curriculumSubjects.length}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.76rem', color: '#7C3AED', fontWeight: 700 }}>
            <span>4-Year Matrices Active</span>
            <span>•</span>
            <span style={{ color: '#64748B', fontWeight: 500 }}>Prerequisites mapped</span>
          </div>
          <div style={{ marginTop: '0.85rem', paddingTop: '0.75rem', borderTop: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.76rem' }}>
            <span style={{ color: '#7C3AED', fontWeight: 700 }}>View Curriculum Matrices</span>
            <ChevronRight size={14} color="#7C3AED" />
          </div>
        </div>

        {/* Card 2: Students Under Records */}
        <div
          onClick={() => onTabChange?.('students')}
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
              Enrolled Directory
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
          </div>
          <div style={{ marginTop: '0.85rem', paddingTop: '0.75rem', borderTop: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.76rem' }}>
            <span style={{ color: '#64748B' }}>Search Student Profiles</span>
            <ChevronRight size={14} color="#2563EB" />
          </div>
        </div>

        {/* Card 3: Grades Encoded in Database */}
        <div
          onClick={() => onTabChange?.('academic_records')}
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
              Grades Encoded
            </span>
            <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(16,185,129,0.12)' }}>
              <FileCheck size={20} color="#059669" />
            </div>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#0F172A', lineHeight: 1, marginBottom: '0.45rem' }}>
            {totalGradesEncoded}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.76rem', color: '#059669', fontWeight: 700 }}>
            <span>Official Academic Records Encoded</span>
          </div>
          <div style={{ marginTop: '0.85rem', paddingTop: '0.75rem', borderTop: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.76rem' }}>
            <span style={{ color: '#64748B' }}>View Grade Sheets</span>
            <ChevronRight size={14} color="#059669" />
          </div>
        </div>

        {/* Card 4: Academic Backlogs & Irregulars */}
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
          <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: 'linear-gradient(to bottom, #F59E0B, #D97706)' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.85rem' }}>
            <span style={{ fontSize: '0.78rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
              Academic Deficiencies
            </span>
            <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(245,158,11,0.15)' }}>
              <AlertTriangle size={20} color="#D97706" />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.45rem' }}>
            <span style={{ fontSize: '2rem', fontWeight: 800, color: deficientStudentsCount > 0 ? '#D97706' : '#059669', lineHeight: 1 }}>
              {deficientStudentsCount}
            </span>
            <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>
              Students with Backlogs
            </span>
          </div>
          <div style={{ fontSize: '0.76rem', color: '#64748B', fontWeight: 600 }}>
            {totalStudents > 0 ? Math.round((deficientStudentsCount / totalStudents) * 100) : 0}% of student body tagged
          </div>
          <div style={{ marginTop: '0.85rem', paddingTop: '0.75rem', borderTop: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.76rem' }}>
            <span style={{ color: '#D97706', fontWeight: 700 }}>Inspect Deficiencies</span>
            <ChevronRight size={14} color="#D97706" />
          </div>
        </div>

      </div>

      {/* 3. FOUR LARGE WORKFLOW ACTION CARDS */}
      <div>
        <div style={{ marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0F172A', margin: 0, letterSpacing: '-0.01em' }}>
            Daily Operations Workflow Hub
          </h3>
          <p style={{ fontSize: '0.78rem', color: '#64748B', margin: '0.15rem 0 0 0' }}>
            Fast access tools for grade entry, batch Excel uploads, student search, and recommendation evaluation
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>

          {/* Action 1: Manual Grade Encoding */}
          <div
            onClick={() => onTabChange?.('academic_records')}
            className="glass-card"
            style={{
              padding: '1.5rem',
              cursor: 'pointer',
              border: '1px solid #E2E8F0',
              borderRadius: '16px',
              transition: 'all 0.2s ease',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = '#2563EB';
              e.currentTarget.style.transform = 'translateY(-3px)';
              e.currentTarget.style.boxShadow = '0 10px 25px -3px rgba(37,99,235,0.12)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = '#E2E8F0';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'var(--shadow-card)';
            }}
          >
            <div>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
                <Plus size={24} color="#2563EB" />
              </div>
              <h4 style={{ margin: '0 0 0.35rem 0', fontSize: '1rem', fontWeight: 800, color: '#0F172A' }}>
                Manual Grade Encoding
              </h4>
              <p style={{ fontSize: '0.8rem', color: '#64748B', margin: 0, lineHeight: 1.45 }}>
                Encode individual student grades with live student ID autocomplete, term selection, and instant 3.00 passing validation.
              </p>
            </div>
            <div style={{ marginTop: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#2563EB', fontWeight: 700, fontSize: '0.82rem' }}>
              <span>Encode Single Record</span>
              <ArrowRight size={14} />
            </div>
          </div>

          {/* Action 2: Batch CSV / OCR Scanner */}
          <div
            onClick={() => onTabChange?.('academic_records')}
            className="glass-card"
            style={{
              padding: '1.5rem',
              cursor: 'pointer',
              border: '1px solid #E2E8F0',
              borderRadius: '16px',
              transition: 'all 0.2s ease',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = '#7C3AED';
              e.currentTarget.style.transform = 'translateY(-3px)';
              e.currentTarget.style.boxShadow = '0 10px 25px -3px rgba(124,58,237,0.12)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = '#E2E8F0';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'var(--shadow-card)';
            }}
          >
            <div>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#F5F3FF', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
                <Upload size={24} color="#7C3AED" />
              </div>
              <h4 style={{ margin: '0 0 0.35rem 0', fontSize: '1rem', fontWeight: 800, color: '#0F172A' }}>
                Batch Excel / OCR Scanner
              </h4>
              <p style={{ fontSize: '0.8rem', color: '#64748B', margin: 0, lineHeight: 1.45 }}>
                Import official departmental grade sheets in bulk via CSV spreadsheet or camera optical character scan.
              </p>
            </div>
            <div style={{ marginTop: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#7C3AED', fontWeight: 700, fontSize: '0.82rem' }}>
              <span>Upload Class Sheet</span>
              <ArrowRight size={14} />
            </div>
          </div>

          {/* Action 3: Student Academic Directory */}
          <div
            onClick={() => onTabChange?.('students')}
            className="glass-card"
            style={{
              padding: '1.5rem',
              cursor: 'pointer',
              border: '1px solid #E2E8F0',
              borderRadius: '16px',
              transition: 'all 0.2s ease',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = '#059669';
              e.currentTarget.style.transform = 'translateY(-3px)';
              e.currentTarget.style.boxShadow = '0 10px 25px -3px rgba(5,150,105,0.12)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = '#E2E8F0';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'var(--shadow-card)';
            }}
          >
            <div>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
                <Search size={24} color="#059669" />
              </div>
              <h4 style={{ margin: '0 0 0.35rem 0', fontSize: '1rem', fontWeight: 800, color: '#0F172A' }}>
                Student Directory & Transcripts
              </h4>
              <p style={{ fontSize: '0.8rem', color: '#64748B', margin: 0, lineHeight: 1.45 }}>
                Search student records by ID or name, inspect term grades, check section schedules, and verify standing.
              </p>
            </div>
            <div style={{ marginTop: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#059669', fontWeight: 700, fontSize: '0.82rem' }}>
              <span>Search Students</span>
              <ArrowRight size={14} />
            </div>
          </div>

          {/* Action 4: Recommendation Advising Engine */}
          <div
            onClick={() => onTabChange?.('recommendations')}
            className="glass-card"
            style={{
              padding: '1.5rem',
              cursor: 'pointer',
              border: '1px solid #E2E8F0',
              borderRadius: '16px',
              transition: 'all 0.2s ease',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = '#7C3AED';
              e.currentTarget.style.transform = 'translateY(-3px)';
              e.currentTarget.style.boxShadow = '0 10px 25px -3px rgba(124,58,237,0.12)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = '#E2E8F0';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'var(--shadow-card)';
            }}
          >
            <div>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#F5F3FF', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
                <Sparkles size={24} color="#7C3AED" />
              </div>
              <h4 style={{ margin: '0 0 0.35rem 0', fontSize: '1rem', fontWeight: 800, color: '#0F172A' }}>
                Recommendation Advising Engine
              </h4>
              <p style={{ fontSize: '0.8rem', color: '#64748B', margin: 0, lineHeight: 1.45 }}>
                Automated prerequisite validation and personalized course load advising per student.
              </p>
            </div>
            <div style={{ marginTop: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#7C3AED', fontWeight: 700, fontSize: '0.82rem' }}>
              <span>Open Advising Engine</span>
              <ArrowRight size={14} />
            </div>
          </div>

        </div>
      </div>

      {/* 4. SPLIT ROW: STAFF ACTIVITY FEED + OPERATIONAL CHECKLIST */}
      <div style={{ display: 'grid', gridTemplateColumns: '7fr 5fr', gap: '1.5rem', alignItems: 'stretch' }}>

        {/* Left: Staff Operations Activity Log */}
        <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Activity size={18} color="#2563EB" />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                Staff Operations Stream
              </h3>
            </div>
            <span style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 600 }}>
              Today's Operations
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', flex: 1 }}>
            {staffOperationalLogs.map(log => {
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
                    <IconComponent size={16} color={log.badgeColor} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0F172A' }}>
                      {log.action}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: '#64748B', marginTop: '0.1rem', lineHeight: 1.35 }}>
                      {log.subject}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: '#94A3B8', marginTop: '0.15rem', fontWeight: 500 }}>
                      {log.staff} • {log.time}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Operational Checklist & Institutional Verification */}
        <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ShieldCheck size={18} color="#15803D" />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                  Registrar Daily Operations Desk
                </h3>
              </div>
              <span style={{ fontSize: '0.7rem', background: '#DCFCE7', color: '#15803D', padding: '2px 8px', borderRadius: '6px', fontWeight: 800 }}>
                Standard Operational Mode
              </span>
            </div>

            <div style={{
              background: '#F8FAFC',
              border: '1px solid #E2E8F0',
              borderRadius: '12px',
              padding: '1rem',
              marginBottom: '1rem'
            }}>
              <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#0F172A', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                Daily Operational Checklist
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', fontSize: '0.78rem', color: '#475569' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <Check size={14} color="#15803D" />
                  <span>Verify student course prerequisite compliance</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <Check size={14} color="#15803D" />
                  <span>Audit encoded class grade sheets for current term</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <Check size={14} color="#15803D" />
                  <span>Generate prerequisite-evaluated recommendations per student</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <Check size={14} color="#15803D" />
                  <span>Review student deficiencies and curriculum progression</span>
                </div>
              </div>
            </div>
          </div>

          <div style={{
            background: '#F0F9FF',
            border: '1px solid #BAE6FD',
            borderRadius: '10px',
            padding: '0.75rem 0.95rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.76rem'
          }}>
            <span style={{ color: '#0369A1', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
              <ShieldCheck size={14} color="#0284C7" />
              Institutional database synchronized and verified
            </span>
            <Check size={14} color="#0284C7" />
          </div>
        </div>

      </div>

    </div>
  );
};
