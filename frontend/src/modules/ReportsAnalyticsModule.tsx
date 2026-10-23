import React, { useState, useMemo } from 'react';
import {
  FileSpreadsheet,
  BarChart3,
  Award,
  GraduationCap,
  Users,
  Printer,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Search,
  ShieldAlert,
  Sparkles,
  Layers
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useRegistrarData } from './RegistrarDataContext';
import { normalizeSubjCode, sortGradeAttemptsNewestFirst } from '../utils/curriculumData';

type AnalyticsTab = 'programs' | 'bottlenecks' | 'roster' | 'grades';

export const ReportsAnalyticsModule: React.FC = () => {
  const {
    mockStudents,
    mockAcademicGrades,
    curriculumSubjects,
    studentRecommendations,
    PROGRAM_CATALOG,
    activeAcademicYear,
    selectedAcademicYear,
    showToast
  } = useRegistrarData();

  // Active view tab
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('programs');

  // Filters
  const [selectedProgramFilter, setSelectedProgramFilter] = useState<string>('all');
  const [selectedYearFilter, setSelectedYearFilter] = useState<string>('all');
  const [selectedStandingFilter, setSelectedStandingFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Effective Academic Year
  const effectiveAy = selectedAcademicYear !== 'all' ? selectedAcademicYear : activeAcademicYear;

  // =========================================================================
  // 1. COMPUTE PER-STUDENT ACADEMIC STANDING & METRICS
  // =========================================================================
  const studentEvaluations = useMemo(() => {
    return mockStudents.map(student => {
      // Find grades belonging to this student
      const stGrades = mockAcademicGrades.filter(
        g => g.studentId?.toLowerCase() === student.student_id?.toLowerCase() ||
             g.studentId?.toLowerCase() === student.id?.toLowerCase()
      );

      // Group attempts by normalized subject code
      const attemptsByCode = new Map<string, typeof stGrades>();
      stGrades.forEach(g => {
        const norm = normalizeSubjCode(g.code || g.title || '');
        if (!norm) return;
        if (!attemptsByCode.has(norm)) attemptsByCode.set(norm, []);
        attemptsByCode.get(norm)!.push(g);
      });

      // Track unpassed deficiencies & GWA
      const unpassedDeficiencies: Array<{ code: string; title: string; units: number; grade: string | number }> = [];
      let totalWeighted = 0;
      let totalGradedUnits = 0;
      let totalPassedUnits = 0;

      attemptsByCode.forEach((attempts, norm) => {
        const sorted = sortGradeAttemptsNewestFirst(attempts);
        const passedAttempt = sorted.find(a => {
          const isDrop = a.status === 'dropped' || a.isDropped || String(a.rawGrade).toUpperCase() === 'DRP' || a.rawGrade === '9';
          const num = Number(a.grade);
          return !isDrop && !isNaN(num) && num > 0 && num <= 3.0;
        });

        if (passedAttempt) {
          const u = Number(passedAttempt.units || 3);
          totalPassedUnits += u;
          const gNum = Number(passedAttempt.grade);
          if (!isNaN(gNum) && gNum >= 1.0 && gNum <= 3.0) {
            totalWeighted += gNum * u;
            totalGradedUnits += u;
          }
        } else {
          // Check if there is an actual failed or dropped attempt
          const hasFailOrDrop = sorted.some(a => {
            const isDrop = a.status === 'dropped' || a.isDropped || String(a.rawGrade).toUpperCase() === 'DRP' || a.rawGrade === '9';
            const num = Number(a.grade);
            const isFail = a.status === 'failed' || a.rawGrade === '5' || a.rawGrade === '5.0' || a.grade === 5 || (!isNaN(num) && num > 3.0);
            return isDrop || isFail;
          });

          if (hasFailOrDrop) {
            // Never passed in any attempt and has recorded failure/drop -> active deficiency
            const latest = sorted[0];
            const curDef = curriculumSubjects.find(cs => normalizeSubjCode(cs.code) === norm);
            unpassedDeficiencies.push({
              code: curDef?.code || latest.code || norm.toUpperCase(),
              title: curDef?.title || latest.title || 'Course Subject',
              units: Number(curDef?.units || latest.units || 3),
              grade: latest.rawGrade || latest.grade || '5.0'
            });
          }
        }
      });

      const cumulativeGwa = totalGradedUnits > 0 ? Number((totalWeighted / totalGradedUnits).toFixed(2)) : null;
      const isRegular = unpassedDeficiencies.length === 0;
      const isDeansList = isRegular && cumulativeGwa !== null && cumulativeGwa <= 1.75 && cumulativeGwa >= 1.0;

      // Check recommendation record
      const recRecord = studentRecommendations.find(
        r => r.studentId === student.student_id || r.studentId === student.id
      );
      const totalRecSubjects = recRecord?.subjects.length || 0;
      const approvedRecSubjects = recRecord?.subjects.filter(s => s.isApproved).length || 0;
      const totalRecUnits = recRecord?.subjects.reduce((sum, s) => sum + (s.totalUnits || 0), 0) || 0;

      return {
        ...student,
        gradesCount: stGrades.length,
        cumulativeGwa,
        isRegular,
        isDeansList,
        unpassedDeficiencies,
        deficiencyCount: unpassedDeficiencies.length,
        totalPassedUnits,
        totalRecSubjects,
        approvedRecSubjects,
        pendingRecSubjects: totalRecSubjects - approvedRecSubjects,
        totalRecUnits,
        recRecord
      };
    });
  }, [mockStudents, mockAcademicGrades, curriculumSubjects, studentRecommendations]);

  // =========================================================================
  // 2. FILTERED STUDENTS
  // =========================================================================
  const filteredStudents = useMemo(() => {
    return studentEvaluations.filter(st => {
      // Program filter
      if (selectedProgramFilter !== 'all' && st.program !== selectedProgramFilter) return false;
      // Year level filter
      if (selectedYearFilter !== 'all' && String(st.year) !== selectedYearFilter) return false;
      // Standing filter
      if (selectedStandingFilter === 'regular' && !st.isRegular) return false;
      if (selectedStandingFilter === 'irregular' && st.isRegular) return false;
      if (selectedStandingFilter === 'deans_list' && !st.isDeansList) return false;
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = st.name.toLowerCase().includes(q);
        const matchId = String(st.student_id || '').toLowerCase().includes(q);
        const matchProg = String(st.program || '').toLowerCase().includes(q);
        const matchDef = st.unpassedDeficiencies.some(d => d.code.toLowerCase().includes(q));
        if (!matchName && !matchId && !matchProg && !matchDef) return false;
      }
      return true;
    });
  }, [studentEvaluations, selectedProgramFilter, selectedYearFilter, selectedStandingFilter, searchQuery]);

  // =========================================================================
  // 3. EXECUTIVE KPI AGGREGATES
  // =========================================================================
  const kpiStats = useMemo(() => {
    const totalStudents = studentEvaluations.length;
    const regularCount = studentEvaluations.filter(s => s.isRegular).length;
    const irregularCount = totalStudents - regularCount;
    const deansListCount = studentEvaluations.filter(s => s.isDeansList).length;

    // Passing rate across all valid academic grade records
    const validGrades = mockAcademicGrades.filter(g => typeof g.grade === 'number' && g.status !== 'pending');
    const passedGrades = validGrades.filter(g => g.status === 'passed' || Number(g.grade) <= 3.0);
    const overallPassRate = validGrades.length > 0
      ? ((passedGrades.length / validGrades.length) * 100).toFixed(1)
      : '100.0';

    // Total backlog units needing retake
    const totalBacklogUnits = studentEvaluations.reduce(
      (sum, s) => sum + s.unpassedDeficiencies.reduce((dSum, d) => dSum + d.units, 0),
      0
    );

    // Subject recommendations approval status
    let totalRecommendedSubjects = 0;
    let totalApprovedSubjects = 0;
    studentEvaluations.forEach(s => {
      totalRecommendedSubjects += s.totalRecSubjects;
      totalApprovedSubjects += s.approvedRecSubjects;
    });
    const approvalRate = totalRecommendedSubjects > 0
      ? Math.round((totalApprovedSubjects / totalRecommendedSubjects) * 100)
      : 0;

    return {
      totalStudents,
      regularCount,
      irregularCount,
      irregularRate: totalStudents > 0 ? ((irregularCount / totalStudents) * 100).toFixed(1) : '0.0',
      deansListCount,
      overallPassRate,
      totalBacklogUnits,
      totalRecommendedSubjects,
      totalApprovedSubjects,
      approvalRate
    };
  }, [studentEvaluations, mockAcademicGrades]);

  // =========================================================================
  // 4. PREREQUISITE BOTTLENECK & AT-RISK COURSES ANALYSIS
  // =========================================================================
  const bottleneckAnalysis = useMemo(() => {
    // Map of normalized subject code -> failure analytics
    const subjMap = new Map<string, {
      code: string;
      title: string;
      program: string;
      units: number;
      yearLevel: number;
      semester: number;
      failingStudentCount: number;
      failingStudentIds: string[];
      blockedCourses: string[];
    }>();

    // Map which courses list this subject as prerequisite
    const downstreamMap = new Map<string, string[]>();
    curriculumSubjects.forEach(cs => {
      if (cs.prerequisites && cs.prerequisites !== 'None') {
        const prereqCodes = cs.prerequisites.split(/[,&;]+/).map(p => normalizeSubjCode(p.trim())).filter(Boolean);
        prereqCodes.forEach(pCode => {
          if (!downstreamMap.has(pCode)) downstreamMap.set(pCode, []);
          if (!downstreamMap.get(pCode)!.includes(cs.code)) {
            downstreamMap.get(pCode)!.push(cs.code);
          }
        });
      }
    });

    // Count deficiencies per subject
    studentEvaluations.forEach(st => {
      st.unpassedDeficiencies.forEach(def => {
        const norm = normalizeSubjCode(def.code);
        if (!subjMap.has(norm)) {
          const matchCatalog = curriculumSubjects.find(cs => normalizeSubjCode(cs.code) === norm);
          subjMap.set(norm, {
            code: matchCatalog?.code || def.code,
            title: matchCatalog?.title || def.title,
            program: matchCatalog?.program || st.program || 'BSIT',
            units: matchCatalog?.units || def.units || 3,
            yearLevel: matchCatalog?.year_level || (matchCatalog as any)?.yearLevel || st.year || 1,
            semester: Number(matchCatalog?.semester || 1),
            failingStudentCount: 0,
            failingStudentIds: [],
            blockedCourses: downstreamMap.get(norm) || []
          });
        }
        const item = subjMap.get(norm)!;
        item.failingStudentCount++;
        item.failingStudentIds.push(st.student_id);
      });
    });

    // Convert to sorted array
    return Array.from(subjMap.values()).sort((a, b) => {
      // Sort by failing students count descending, then blocked courses count
      if (b.failingStudentCount !== a.failingStudentCount) {
        return b.failingStudentCount - a.failingStudentCount;
      }
      return b.blockedCourses.length - a.blockedCourses.length;
    });
  }, [studentEvaluations, curriculumSubjects]);

  // =========================================================================
  // 5. PROGRAM-LEVEL STATS
  // =========================================================================
  const programCohortStats = useMemo(() => {
    return PROGRAM_CATALOG.map(prog => {
      const progStudents = studentEvaluations.filter(s => s.program === prog.code);
      const studentIds = new Set(progStudents.map(s => s.student_id));

      const progGrades = mockAcademicGrades.filter(g => {
        if (studentIds.has(g.studentId)) return true;
        if (prog.code === 'BSIT' && (g.code.startsWith('IT') || g.code.startsWith('CC'))) return true;
        if (prog.code === 'BSCS' && (g.code.startsWith('CS') || g.code.startsWith('CC'))) return true;
        return false;
      });

      const valid = progGrades.filter(g => typeof g.grade === 'number');
      const passed = valid.filter(g => g.status === 'passed' || Number(g.grade) <= 3.0);
      const passRate = valid.length > 0 ? Math.round((passed.length / valid.length) * 100) : 100;

      const regularCount = progStudents.filter(s => s.isRegular).length;
      const irregularCount = progStudents.length - regularCount;

      const gwaList = progStudents.map(s => s.cumulativeGwa).filter((g): g is number => g !== null);
      const avgGwa = gwaList.length > 0
        ? (gwaList.reduce((sum, g) => sum + g, 0) / gwaList.length).toFixed(2)
        : 'N/A';

      return {
        code: prog.code,
        title: prog.name,
        department: prog.department,
        color: prog.color,
        bgColor: prog.bgColor,
        enrolledCount: progStudents.length,
        regularCount,
        irregularCount,
        passRate,
        avgGwa
      };
    });
  }, [PROGRAM_CATALOG, studentEvaluations, mockAcademicGrades]);

  // =========================================================================
  // 6. YEAR LEVEL COHORT STATS
  // =========================================================================
  const yearLevelStats = useMemo(() => {
    const years = [1, 2, 3, 4];
    return years.map(yr => {
      const yrStudents = studentEvaluations.filter(s => s.year === yr);
      const regularCount = yrStudents.filter(s => s.isRegular).length;
      const irregularCount = yrStudents.length - regularCount;
      const totalBacklogs = yrStudents.reduce((sum, s) => sum + s.deficiencyCount, 0);

      const yrGrades = mockAcademicGrades.filter(g => {
        const matchSt = studentEvaluations.find(s => s.student_id === g.studentId);
        return matchSt?.year === yr;
      });
      const valid = yrGrades.filter(g => typeof g.grade === 'number');
      const passed = valid.filter(g => g.status === 'passed' || Number(g.grade) <= 3.0);
      const passRate = valid.length > 0 ? Math.round((passed.length / valid.length) * 100) : 100;

      return {
        year: yr,
        label: yr === 1 ? '1st Year' : yr === 2 ? '2nd Year' : yr === 3 ? '3rd Year' : '4th Year',
        enrolledCount: yrStudents.length,
        regularCount,
        irregularCount,
        totalBacklogs,
        passRate
      };
    });
  }, [studentEvaluations, mockAcademicGrades]);

  // =========================================================================
  // 7. GRADE DISTRIBUTION
  // =========================================================================
  const gradeDistribution = useMemo(() => {
    let excellent = 0; // 1.00 - 1.75
    let good = 0;      // 2.00 - 2.50
    let passing = 0;   // 2.75 - 3.00
    let failing = 0;   // 5.00
    let dropped = 0;   // DRP / 9.0

    mockAcademicGrades.forEach(g => {
      if (g.status === 'dropped' || g.isDropped || String(g.rawGrade).toUpperCase() === 'DRP' || g.rawGrade === '9') {
        dropped++;
      } else {
        const num = Number(g.grade);
        if (!isNaN(num)) {
          if (num >= 1.0 && num <= 1.75) excellent++;
          else if (num > 1.75 && num <= 2.5) good++;
          else if (num > 2.5 && num <= 3.0) passing++;
          else if (num > 3.0) failing++;
        }
      }
    });

    const total = excellent + good + passing + failing + dropped;
    return {
      total,
      excellent: { count: excellent, pct: total > 0 ? Math.round((excellent / total) * 100) : 0 },
      good: { count: good, pct: total > 0 ? Math.round((good / total) * 100) : 0 },
      passing: { count: passing, pct: total > 0 ? Math.round((passing / total) * 100) : 0 },
      failing: { count: failing, pct: total > 0 ? Math.round((failing / total) * 100) : 0 },
      dropped: { count: dropped, pct: total > 0 ? Math.round((dropped / total) * 100) : 0 }
    };
  }, [mockAcademicGrades]);

  // =========================================================================
  // 8. MULTI-SHEET EXCEL EXPORT
  // =========================================================================
  const handleExportExcel = () => {
    try {
      const wb = XLSX.utils.book_new();

      // Sheet 1: Student Advising Summary
      const studentRows = filteredStudents.map(st => ({
        'Student ID': st.student_id,
        'Full Name': st.name,
        'Degree Program': st.program,
        'Year Level': `Year ${st.year}`,
        'Section': st.section || 'A',
        'Academic Standing': st.isRegular ? 'Regular Track' : 'Irregular (Deficient)',
        'Cumulative GWA': st.cumulativeGwa !== null ? st.cumulativeGwa.toFixed(2) : 'N/A',
        "Dean's List Eligible": st.isDeansList ? 'YES' : 'NO',
        'Active Deficiencies Count': st.deficiencyCount,
        'Backlog Subject Codes': st.unpassedDeficiencies.map(d => d.code).join(', ') || 'None',
        'Total Recommended Subjects': st.totalRecSubjects,
        'Approved Subjects': st.approvedRecSubjects,
        'Pending Review': st.pendingRecSubjects,
        'Recommended Units': st.totalRecUnits,
        'Evaluation Academic Year': effectiveAy
      }));
      const wsStudents = XLSX.utils.json_to_sheet(studentRows);
      XLSX.utils.book_append_sheet(wb, wsStudents, 'Student Advising Roster');

      // Sheet 2: Program Analytics
      const programRows = programCohortStats.map(p => ({
        'Program Code': p.code,
        'Program Title': p.title,
        'Department': p.department,
        'Total Enrolled': p.enrolledCount,
        'Regular Students': p.regularCount,
        'Irregular Students': p.irregularCount,
        'Overall Passing Rate (%)': `${p.passRate}%`,
        'Average Cumulative GWA': p.avgGwa
      }));
      const wsPrograms = XLSX.utils.json_to_sheet(programRows);
      XLSX.utils.book_append_sheet(wb, wsPrograms, 'Program Summary');

      // Sheet 3: Prerequisite Bottlenecks
      const bottleneckRows = bottleneckAnalysis.map(b => ({
        'Course Code': b.code,
        'Course Title': b.title,
        'Program': b.program,
        'Curriculum Year & Term': `Year ${b.yearLevel} • Sem ${b.semester}`,
        'Units': b.units,
        'Students with Backlog': b.failingStudentCount,
        'Downstream Blocked Courses': b.blockedCourses.join(', ') || 'None (Terminal Course)',
        'Risk Severity': b.failingStudentCount >= 3 ? 'CRITICAL' : b.failingStudentCount >= 2 ? 'MODERATE' : 'LOW'
      }));
      const wsBottlenecks = XLSX.utils.json_to_sheet(bottleneckRows);
      XLSX.utils.book_append_sheet(wb, wsBottlenecks, 'Bottleneck Risk Matrix');

      // Trigger download
      const filename = `GCT_Academic_Reports_Analytics_${effectiveAy}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(wb, filename);

      showToast('Comprehensive multi-sheet Excel report downloaded!', 'success');
    } catch (err) {
      console.error(err);
      showToast('Failed to export report to Excel.', 'error');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="reports-analytics-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* ===================================================================== */}
      {/* PRINT-ONLY OFFICIAL INSTITUTIONAL HEADER                              */}
      {/* ===================================================================== */}
      <div className="print-only" style={{ display: 'none', borderBottom: '2px solid #1E3A8A', paddingBottom: '0.75rem', marginBottom: '1.5rem' }}>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1E3A8A', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Garcia College of Technology
          </h2>
          <p style={{ fontSize: '0.85rem', color: '#475569', margin: '0.15rem 0 0 0', fontWeight: 600 }}>
            Office of the College Registrar • Academic Evaluation & Advising Unit
          </p>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0F172A', marginTop: '0.5rem', marginBottom: 0 }}>
            Official Academic Reports & Subject Recommendation Analytics (A.Y. {effectiveAy})
          </h3>
          <p style={{ fontSize: '0.72rem', color: '#64748B', margin: '0.2rem 0 0 0' }}>
            Generated on: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 1. TOP HEADER & ACTION CONTROLS                                       */}
      {/* ===================================================================== */}
      <div
        className="glass-card no-print"
        style={{
          background: '#FFFFFF',
          borderRadius: '12px',
          border: '1px solid #E2E8F0',
          padding: '1.1rem 1.4rem',
          boxShadow: '0 1px 3px rgba(15, 23, 42, 0.05)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFFFFF'
              }}
            >
              <BarChart3 size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.18rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                Academic Reports & Recommendation Analytics
              </h3>
              <p style={{ fontSize: '0.78rem', color: '#64748B', margin: '0.15rem 0 0 0' }}>
                Cohort passing rates, bottleneck prerequisite audits, and subject advising status for <strong style={{ color: '#1D4ED8' }}>A.Y. {effectiveAy}</strong>.
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleExportExcel}
            className="btn btn-primary btn-sm"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontWeight: 700,
              padding: '0.5rem 0.9rem',
              background: 'linear-gradient(135deg, #16A34A 0%, #15803D 100%)',
              border: 'none',
              borderRadius: '7px',
              color: '#FFFFFF',
              fontSize: '0.8rem',
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(22, 163, 74, 0.2)'
            }}
          >
            <FileSpreadsheet size={15} /> Export Complete Excel (.xlsx)
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="btn btn-secondary btn-sm"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontWeight: 600,
              padding: '0.5rem 0.85rem',
              background: '#FFFFFF',
              border: '1px solid #CBD5E1',
              borderRadius: '7px',
              color: '#334155',
              fontSize: '0.8rem',
              cursor: 'pointer'
            }}
          >
            <Printer size={15} /> Print / Save PDF
          </button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 2. EXECUTIVE KPI CARDS (6 METRICS)                                    */}
      {/* ===================================================================== */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
          gap: '0.85rem'
        }}
      >
        {/* Total Students */}
        <div
          style={{
            background: '#FFFFFF',
            borderRadius: '10px',
            border: '1px solid #E2E8F0',
            padding: '1rem',
            boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600 }}>Total Evaluated</span>
            <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users size={15} color="#2563EB" />
            </div>
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0F172A', lineHeight: 1.1 }}>
            {kpiStats.totalStudents} <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#64748B' }}>Students</span>
          </div>
          <div style={{ fontSize: '0.7rem', color: '#16A34A', fontWeight: 700, marginTop: '0.35rem' }}>
            ✓ {kpiStats.regularCount} Regular Track ({kpiStats.totalStudents > 0 ? Math.round((kpiStats.regularCount / kpiStats.totalStudents) * 100) : 0}%)
          </div>
        </div>

        {/* Passing Rate */}
        <div
          style={{
            background: '#FFFFFF',
            borderRadius: '10px',
            border: '1px solid #E2E8F0',
            padding: '1rem',
            boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600 }}>Institutional Pass Rate</span>
            <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Award size={15} color="#059669" />
            </div>
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0F172A', lineHeight: 1.1 }}>
            {kpiStats.overallPassRate}%
          </div>
          <div style={{ fontSize: '0.7rem', color: Number(kpiStats.overallPassRate) >= 75 ? '#059669' : '#DC2626', fontWeight: 700, marginTop: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
            {Number(kpiStats.overallPassRate) >= 75 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            Based on all graded attempts
          </div>
        </div>

        {/* Irregular / Backlog Students */}
        <div
          style={{
            background: '#FFFFFF',
            borderRadius: '10px',
            border: '1px solid #E2E8F0',
            padding: '1rem',
            boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600 }}>With Deficiencies</span>
            <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AlertTriangle size={15} color="#D97706" />
            </div>
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#D97706', lineHeight: 1.1 }}>
            {kpiStats.irregularCount} <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#64748B' }}>Students</span>
          </div>
          <div style={{ fontSize: '0.7rem', color: '#92400E', fontWeight: 600, marginTop: '0.35rem' }}>
            ⚠️ {kpiStats.totalBacklogUnits} backlog units for retake
          </div>
        </div>

        {/* Prerequisite Bottlenecks */}
        <div
          style={{
            background: '#FFFFFF',
            borderRadius: '10px',
            border: '1px solid #E2E8F0',
            padding: '1rem',
            boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600 }}>Bottleneck Courses</span>
            <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShieldAlert size={15} color="#DC2626" />
            </div>
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#DC2626', lineHeight: 1.1 }}>
            {bottleneckAnalysis.length} <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#64748B' }}>Subjects</span>
          </div>
          <div style={{ fontSize: '0.7rem', color: '#B91C1C', fontWeight: 600, marginTop: '0.35rem' }}>
            ⛔ Blocking student progression
          </div>
        </div>

        {/* Subject Approvals */}
        <div
          style={{
            background: '#FFFFFF',
            borderRadius: '10px',
            border: '1px solid #E2E8F0',
            padding: '1rem',
            boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600 }}>Advising Approval Rate</span>
            <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle2 size={15} color="#1D4ED8" />
            </div>
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#1D4ED8', lineHeight: 1.1 }}>
            {kpiStats.approvalRate}%
          </div>
          <div style={{ fontSize: '0.7rem', color: '#64748B', fontWeight: 600, marginTop: '0.35rem' }}>
            {kpiStats.totalApprovedSubjects} of {kpiStats.totalRecommendedSubjects} subjects approved
          </div>
        </div>

        {/* Dean's List */}
        <div
          style={{
            background: '#FFFFFF',
            borderRadius: '10px',
            border: '1px solid #E2E8F0',
            padding: '1rem',
            boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600 }}>Dean's List Eligible</span>
            <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#F5F3FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Sparkles size={15} color="#7C3AED" />
            </div>
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#7C3AED', lineHeight: 1.1 }}>
            {kpiStats.deansListCount} <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#64748B' }}>Students</span>
          </div>
          <div style={{ fontSize: '0.7rem', color: '#6D28D9', fontWeight: 700, marginTop: '0.35rem' }}>
            🏆 GWA ≤ 1.75 • Zero deficiencies
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 3. MULTI-TAB NAVIGATION                                               */}
      {/* ===================================================================== */}
      <div
        className="no-print"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          borderBottom: '1px solid #E2E8F0',
          paddingBottom: '0.2rem',
          overflowX: 'auto'
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('programs')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.55rem 0.95rem',
            borderRadius: '8px',
            border: 'none',
            background: activeTab === 'programs' ? '#EFF6FF' : 'transparent',
            color: activeTab === 'programs' ? '#1D4ED8' : '#64748B',
            fontWeight: activeTab === 'programs' ? 700 : 600,
            fontSize: '0.82rem',
            cursor: 'pointer',
            borderBottom: activeTab === 'programs' ? '2px solid #2563EB' : '2px solid transparent',
            transition: 'all 0.15s ease'
          }}
        >
          <BarChart3 size={15} /> Program & Cohort Overview
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('bottlenecks')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.55rem 0.95rem',
            borderRadius: '8px',
            border: 'none',
            background: activeTab === 'bottlenecks' ? '#EFF6FF' : 'transparent',
            color: activeTab === 'bottlenecks' ? '#1D4ED8' : '#64748B',
            fontWeight: activeTab === 'bottlenecks' ? 700 : 600,
            fontSize: '0.82rem',
            cursor: 'pointer',
            borderBottom: activeTab === 'bottlenecks' ? '2px solid #2563EB' : '2px solid transparent',
            transition: 'all 0.15s ease'
          }}
        >
          <ShieldAlert size={15} color={activeTab === 'bottlenecks' ? '#1D4ED8' : '#DC2626'} />
          Prerequisite Bottlenecks
          <span
            style={{
              fontSize: '0.66rem',
              fontWeight: 800,
              padding: '1px 6px',
              borderRadius: '10px',
              background: '#FEE2E2',
              color: '#B91C1C'
            }}
          >
            {bottleneckAnalysis.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('roster')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.55rem 0.95rem',
            borderRadius: '8px',
            border: 'none',
            background: activeTab === 'roster' ? '#EFF6FF' : 'transparent',
            color: activeTab === 'roster' ? '#1D4ED8' : '#64748B',
            fontWeight: activeTab === 'roster' ? 700 : 600,
            fontSize: '0.82rem',
            cursor: 'pointer',
            borderBottom: activeTab === 'roster' ? '2px solid #2563EB' : '2px solid transparent',
            transition: 'all 0.15s ease'
          }}
        >
          <GraduationCap size={15} /> Student Advising Roster
          <span
            style={{
              fontSize: '0.66rem',
              fontWeight: 800,
              padding: '1px 6px',
              borderRadius: '10px',
              background: '#EFF6FF',
              color: '#1D4ED8'
            }}
          >
            {filteredStudents.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('grades')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.55rem 0.95rem',
            borderRadius: '8px',
            border: 'none',
            background: activeTab === 'grades' ? '#EFF6FF' : 'transparent',
            color: activeTab === 'grades' ? '#1D4ED8' : '#64748B',
            fontWeight: activeTab === 'grades' ? 700 : 600,
            fontSize: '0.82rem',
            cursor: 'pointer',
            borderBottom: activeTab === 'grades' ? '2px solid #2563EB' : '2px solid transparent',
            transition: 'all 0.15s ease'
          }}
        >
          <Layers size={15} /> Grade Distribution & Units
        </button>
      </div>

      {/* ===================================================================== */}
      {/* 4. TAB CONTENT: PROGRAM & COHORT OVERVIEW                             */}
      {/* ===================================================================== */}
      {activeTab === 'programs' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Degree Programs Table */}
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: '10px',
              border: '1px solid #E2E8F0',
              padding: '1.25rem',
              boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <h4 style={{ fontSize: '0.96rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                  Degree Programs Performance Matrix
                </h4>
                <p style={{ fontSize: '0.74rem', color: '#64748B', margin: '0.15rem 0 0 0' }}>
                  Aggregated student standing, passing rates, and cumulative GWA across active degree offerings.
                </p>
              </div>
              <span style={{ fontSize: '0.74rem', color: '#1D4ED8', fontWeight: 700, background: '#EFF6FF', padding: '3px 8px', borderRadius: '5px' }}>
                {programCohortStats.length} Programs Monitored
              </span>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                    <th style={{ padding: '0.7rem 0.85rem', fontWeight: 700, color: '#475569' }}>PROGRAM</th>
                    <th style={{ padding: '0.7rem 0.85rem', fontWeight: 700, color: '#475569' }}>DEGREE TITLE</th>
                    <th style={{ padding: '0.7rem 0.85rem', fontWeight: 700, color: '#475569', textAlign: 'center' }}>ENROLLED</th>
                    <th style={{ padding: '0.7rem 0.85rem', fontWeight: 700, color: '#475569', textAlign: 'center' }}>REGULAR / IRREGULAR</th>
                    <th style={{ padding: '0.7rem 0.85rem', fontWeight: 700, color: '#475569', textAlign: 'center' }}>AVG GWA</th>
                    <th style={{ padding: '0.7rem 0.85rem', fontWeight: 700, color: '#475569', textAlign: 'center' }}>PASSING RATE</th>
                  </tr>
                </thead>
                <tbody>
                  {programCohortStats.map(p => (
                    <tr key={p.code} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '0.8rem 0.85rem', fontWeight: 800, color: '#1D4ED8' }}>
                        {p.code}
                      </td>
                      <td style={{ padding: '0.8rem 0.85rem' }}>
                        <div style={{ fontWeight: 600, color: '#0F172A' }}>{p.title}</div>
                        <div style={{ fontSize: '0.7rem', color: '#64748B' }}>{p.department}</div>
                      </td>
                      <td style={{ padding: '0.8rem 0.85rem', textAlign: 'center', fontWeight: 700, color: '#0F172A' }}>
                        {p.enrolledCount}
                      </td>
                      <td style={{ padding: '0.8rem 0.85rem', textAlign: 'center' }}>
                        <span style={{ color: '#16A34A', fontWeight: 700 }}>{p.regularCount} Reg</span>
                        <span style={{ color: '#94A3B8', margin: '0 4px' }}>/</span>
                        <span style={{ color: p.irregularCount > 0 ? '#D97706' : '#64748B', fontWeight: 700 }}>{p.irregularCount} Irreg</span>
                      </td>
                      <td style={{ padding: '0.8rem 0.85rem', textAlign: 'center', fontWeight: 700, color: '#334155' }}>
                        {p.avgGwa}
                      </td>
                      <td style={{ padding: '0.8rem 0.85rem', textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
                          <div style={{ width: '90px', height: '6px', background: '#E2E8F0', borderRadius: '3px', overflow: 'hidden' }}>
                            <div
                              style={{
                                width: `${p.passRate}%`,
                                height: '100%',
                                background: p.passRate >= 80 ? '#16A34A' : p.passRate >= 70 ? '#2563EB' : '#DC2626',
                                borderRadius: '3px'
                              }}
                            />
                          </div>
                          <span style={{ fontSize: '0.8rem', fontWeight: 700, minWidth: '32px', textAlign: 'right' }}>
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

          {/* Year Level Cohort Breakdown */}
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: '10px',
              border: '1px solid #E2E8F0',
              padding: '1.25rem',
              boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)'
            }}
          >
            <h4 style={{ fontSize: '0.96rem', fontWeight: 800, color: '#0F172A', margin: 0, marginBottom: '0.2rem' }}>
              Year-Level Progression & Cohort Attrition
            </h4>
            <p style={{ fontSize: '0.74rem', color: '#64748B', margin: '0 0 1rem 0' }}>
              Comparison of active students, accumulated backlogs, and pass percentages across curriculum levels.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0.85rem' }}>
              {yearLevelStats.map(y => (
                <div
                  key={y.year}
                  style={{
                    background: '#F8FAFC',
                    borderRadius: '8px',
                    border: '1px solid #E2E8F0',
                    padding: '0.95rem'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#1E293B' }}>
                      🎓 {y.label}
                    </span>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#2563EB', background: '#EFF6FF', padding: '2px 6px', borderRadius: '4px' }}>
                      {y.enrolledCount} Students
                    </span>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#475569', marginBottom: '0.4rem' }}>
                    <strong>Regular:</strong> {y.regularCount} • <strong>Irregular:</strong> {y.irregularCount}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: y.totalBacklogs > 0 ? '#D97706' : '#16A34A', fontWeight: 600, marginBottom: '0.6rem' }}>
                    {y.totalBacklogs > 0 ? `⚠️ ${y.totalBacklogs} Active Retake Backlogs` : '✓ Zero Backlogs in Cohort'}
                  </div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#64748B', marginBottom: '0.2rem' }}>
                      <span>Passing Rate</span>
                      <strong style={{ color: '#0F172A' }}>{y.passRate}%</strong>
                    </div>
                    <div style={{ width: '100%', height: '5px', background: '#E2E8F0', borderRadius: '3px', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${y.passRate}%`,
                          height: '100%',
                          background: y.passRate >= 75 ? '#16A34A' : '#DC2626',
                          borderRadius: '3px'
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 5. TAB CONTENT: PREREQUISITE BOTTLENECKS                              */}
      {/* ===================================================================== */}
      {activeTab === 'bottlenecks' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: '10px',
              border: '1px solid #E2E8F0',
              padding: '1.25rem',
              boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <h4 style={{ fontSize: '0.96rem', fontWeight: 800, color: '#0F172A', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <ShieldAlert size={18} color="#DC2626" />
                  Prerequisite Bottleneck Courses & Risk Matrix
                </h4>
                <p style={{ fontSize: '0.74rem', color: '#64748B', margin: '0.15rem 0 0 0' }}>
                  Identifies foundational courses with high student failure rates that block progression to subsequent semester tracks.
                </p>
              </div>

              <div style={{ fontSize: '0.72rem', color: '#92400E', background: '#FEF3C7', padding: '4px 8px', borderRadius: '5px', fontWeight: 700 }}>
                ⚠️ High Priority for Summer / Remedial Sections
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                    <th style={{ padding: '0.7rem 0.85rem', fontWeight: 700, color: '#475569' }}>COURSE</th>
                    <th style={{ padding: '0.7rem 0.85rem', fontWeight: 700, color: '#475569' }}>TITLE</th>
                    <th style={{ padding: '0.7rem 0.85rem', fontWeight: 700, color: '#475569', textAlign: 'center' }}>PROGRAM & TERM</th>
                    <th style={{ padding: '0.7rem 0.85rem', fontWeight: 700, color: '#475569', textAlign: 'center' }}>AFFECTED STUDENTS</th>
                    <th style={{ padding: '0.7rem 0.85rem', fontWeight: 700, color: '#475569' }}>DOWNSTREAM BLOCKED COURSES</th>
                    <th style={{ padding: '0.7rem 0.85rem', fontWeight: 700, color: '#475569', textAlign: 'center' }}>RISK LEVEL</th>
                  </tr>
                </thead>
                <tbody>
                  {bottleneckAnalysis.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '2.5rem', color: '#64748B' }}>
                        ✓ No critical bottleneck courses detected. All student prerequisites are cleared.
                      </td>
                    </tr>
                  ) : (
                    bottleneckAnalysis.map(b => {
                      const isCritical = b.failingStudentCount >= 3;
                      const isModerate = b.failingStudentCount === 2;
                      return (
                        <tr key={b.code} style={{ borderBottom: '1px solid #F1F5F9' }}>
                          <td style={{ padding: '0.8rem 0.85rem', fontWeight: 800, color: '#DC2626' }}>
                            {b.code}
                          </td>
                          <td style={{ padding: '0.8rem 0.85rem', fontWeight: 600, color: '#0F172A' }}>
                            {b.title}
                          </td>
                          <td style={{ padding: '0.8rem 0.85rem', textAlign: 'center', color: '#64748B', fontSize: '0.75rem' }}>
                            <span style={{ fontWeight: 700, color: '#1D4ED8' }}>{b.program}</span> • Year {b.yearLevel} Sem {b.semester}
                          </td>
                          <td style={{ padding: '0.8rem 0.85rem', textAlign: 'center' }}>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.25rem',
                                padding: '2px 8px',
                                borderRadius: '5px',
                                background: isCritical ? '#FEE2E2' : '#FEF3C7',
                                color: isCritical ? '#B91C1C' : '#B45309',
                                fontWeight: 800,
                                fontSize: '0.75rem'
                              }}
                            >
                              {b.failingStudentCount} student{b.failingStudentCount === 1 ? '' : 's'}
                            </span>
                          </td>
                          <td style={{ padding: '0.8rem 0.85rem' }}>
                            {b.blockedCourses.length > 0 ? (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                                {b.blockedCourses.map(bc => (
                                  <span
                                    key={bc}
                                    style={{
                                      fontSize: '0.68rem',
                                      fontWeight: 700,
                                      padding: '1px 6px',
                                      borderRadius: '4px',
                                      background: '#EFF6FF',
                                      color: '#1D4ED8',
                                      border: '1px solid #BFDBFE'
                                    }}
                                  >
                                    ⛔ {bc}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span style={{ fontSize: '0.72rem', color: '#94A3B8', fontStyle: 'italic' }}>
                                None (Terminal Subject)
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '0.8rem 0.85rem', textAlign: 'center' }}>
                            <span
                              style={{
                                fontSize: '0.68rem',
                                fontWeight: 800,
                                padding: '2px 8px',
                                borderRadius: '4px',
                                textTransform: 'uppercase',
                                letterSpacing: '0.3px',
                                background: isCritical ? '#DC2626' : isModerate ? '#F59E0B' : '#10B981',
                                color: '#FFFFFF'
                              }}
                            >
                              {isCritical ? 'CRITICAL' : isModerate ? 'MODERATE' : 'LOW'}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 6. TAB CONTENT: STUDENT ADVISING ROSTER                               */}
      {/* ===================================================================== */}
      {activeTab === 'roster' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Roster Filter Bar */}
          <div
            className="no-print"
            style={{
              background: '#FFFFFF',
              borderRadius: '10px',
              border: '1px solid #E2E8F0',
              padding: '0.85rem 1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              flexWrap: 'wrap',
              boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)'
            }}
          >
            {/* Search Input */}
            <div style={{ position: 'relative', flex: '1 1 200px' }}>
              <Search size={14} color="#94A3B8" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search student name, ID, or course backlog..."
                style={{
                  width: '100%',
                  padding: '0.45rem 0.75rem 0.45rem 2rem',
                  borderRadius: '6px',
                  border: '1px solid #CBD5E1',
                  fontSize: '0.78rem',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Program Filter */}
            <select
              value={selectedProgramFilter}
              onChange={e => setSelectedProgramFilter(e.target.value)}
              style={{
                padding: '0.45rem 0.7rem',
                borderRadius: '6px',
                border: '1px solid #CBD5E1',
                fontSize: '0.78rem',
                outline: 'none',
                background: '#FFFFFF',
                color: '#334155'
              }}
            >
              <option value="all">All Degree Programs</option>
              {PROGRAM_CATALOG.map(p => (
                <option key={p.code} value={p.code}>{p.code} ({p.name})</option>
              ))}
            </select>

            {/* Year Level Filter */}
            <select
              value={selectedYearFilter}
              onChange={e => setSelectedYearFilter(e.target.value)}
              style={{
                padding: '0.45rem 0.7rem',
                borderRadius: '6px',
                border: '1px solid #CBD5E1',
                fontSize: '0.78rem',
                outline: 'none',
                background: '#FFFFFF',
                color: '#334155'
              }}
            >
              <option value="all">All Year Levels</option>
              <option value="1">1st Year</option>
              <option value="2">2nd Year</option>
              <option value="3">3rd Year</option>
              <option value="4">4th Year</option>
            </select>

            {/* Standing Filter */}
            <select
              value={selectedStandingFilter}
              onChange={e => setSelectedStandingFilter(e.target.value)}
              style={{
                padding: '0.45rem 0.7rem',
                borderRadius: '6px',
                border: '1px solid #CBD5E1',
                fontSize: '0.78rem',
                outline: 'none',
                background: '#FFFFFF',
                color: '#334155'
              }}
            >
              <option value="all">All Standings</option>
              <option value="regular">✓ Regular Track Only</option>
              <option value="irregular">⚠️ Irregular / Deficient Only</option>
              <option value="deans_list">🏆 Dean's List Candidates</option>
            </select>

            {(searchQuery || selectedProgramFilter !== 'all' || selectedYearFilter !== 'all' || selectedStandingFilter !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedProgramFilter('all');
                  setSelectedYearFilter('all');
                  setSelectedStandingFilter('all');
                }}
                style={{
                  padding: '0.45rem 0.7rem',
                  borderRadius: '6px',
                  border: '1px solid #E2E8F0',
                  background: '#F1F5F9',
                  color: '#475569',
                  fontSize: '0.74rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Clear Filters
              </button>
            )}
          </div>

          {/* Roster Table */}
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: '10px',
              border: '1px solid #E2E8F0',
              padding: '1.25rem',
              boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <h4 style={{ fontSize: '0.96rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                Student Recommendation & Standing Roster
              </h4>
              <span style={{ fontSize: '0.76rem', color: '#64748B', fontWeight: 600 }}>
                Showing <strong>{filteredStudents.length}</strong> of {studentEvaluations.length} students
              </span>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                    <th style={{ padding: '0.7rem 0.85rem', fontWeight: 700, color: '#475569' }}>STUDENT ID</th>
                    <th style={{ padding: '0.7rem 0.85rem', fontWeight: 700, color: '#475569' }}>NAME</th>
                    <th style={{ padding: '0.7rem 0.85rem', fontWeight: 700, color: '#475569', textAlign: 'center' }}>PROGRAM</th>
                    <th style={{ padding: '0.7rem 0.85rem', fontWeight: 700, color: '#475569', textAlign: 'center' }}>GWA</th>
                    <th style={{ padding: '0.7rem 0.85rem', fontWeight: 700, color: '#475569', textAlign: 'center' }}>STANDING</th>
                    <th style={{ padding: '0.7rem 0.85rem', fontWeight: 700, color: '#475569' }}>ACTIVE DEFICIENCIES</th>
                    <th style={{ padding: '0.7rem 0.85rem', fontWeight: 700, color: '#475569', textAlign: 'center' }}>ADVISING APPROVAL</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '2.5rem', color: '#64748B' }}>
                        No students match the current filter selection.
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map(st => (
                      <tr key={st.student_id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '0.75rem 0.85rem', fontWeight: 700, color: '#1D4ED8', fontSize: '0.78rem' }}>
                          {st.student_id}
                        </td>
                        <td style={{ padding: '0.75rem 0.85rem' }}>
                          <div style={{ fontWeight: 700, color: '#0F172A' }}>{st.name}</div>
                          <div style={{ fontSize: '0.7rem', color: '#64748B' }}>
                            Year {st.year} • Sec {st.section || 'A'}
                          </div>
                        </td>
                        <td style={{ padding: '0.75rem 0.85rem', textAlign: 'center', fontWeight: 700, color: '#334155' }}>
                          {st.program}
                        </td>
                        <td style={{ padding: '0.75rem 0.85rem', textAlign: 'center' }}>
                          <div style={{ fontWeight: 800, color: '#0F172A' }}>
                            {st.cumulativeGwa !== null ? st.cumulativeGwa.toFixed(2) : '—'}
                          </div>
                          {st.isDeansList && (
                            <span style={{ fontSize: '0.62rem', fontWeight: 800, color: '#7C3AED', background: '#F5F3FF', padding: '1px 5px', borderRadius: '4px' }}>
                              🏆 Honor
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '0.75rem 0.85rem', textAlign: 'center' }}>
                          {st.isRegular ? (
                            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#15803D', background: '#DCFCE7', padding: '2px 8px', borderRadius: '5px' }}>
                              ✓ Regular
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#B45309', background: '#FEF3C7', padding: '2px 8px', borderRadius: '5px' }}>
                              ⚠️ Irregular ({st.deficiencyCount})
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '0.75rem 0.85rem' }}>
                          {st.unpassedDeficiencies.length > 0 ? (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                              {st.unpassedDeficiencies.map(d => (
                                <span
                                  key={d.code}
                                  style={{
                                    fontSize: '0.68rem',
                                    fontWeight: 700,
                                    padding: '1px 6px',
                                    borderRadius: '4px',
                                    background: '#FEE2E2',
                                    color: '#B91C1C',
                                    border: '1px solid #FECACA'
                                  }}
                                  title={`${d.code}: ${d.title} (Grade: ${d.grade})`}
                                >
                                  {d.code} ({d.grade})
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span style={{ fontSize: '0.72rem', color: '#16A34A', fontWeight: 600 }}>
                              ✓ None (All Cleared)
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '0.75rem 0.85rem', textAlign: 'center' }}>
                          {st.totalRecSubjects > 0 ? (
                            <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
                              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: st.pendingRecSubjects === 0 ? '#15803D' : '#1D4ED8' }}>
                                {st.approvedRecSubjects} / {st.totalRecSubjects} Approved
                              </span>
                              <div style={{ width: '60px', height: '4px', background: '#E2E8F0', borderRadius: '2px', marginTop: '3px', overflow: 'hidden' }}>
                                <div
                                  style={{
                                    width: `${Math.round((st.approvedRecSubjects / st.totalRecSubjects) * 100)}%`,
                                    height: '100%',
                                    background: st.pendingRecSubjects === 0 ? '#16A34A' : '#2563EB'
                                  }}
                                />
                              </div>
                            </div>
                          ) : (
                            <span style={{ fontSize: '0.72rem', color: '#94A3B8' }}>
                              Pending Assessment
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 7. TAB CONTENT: GRADE DISTRIBUTION & UNITS MATRIX                     */}
      {/* ===================================================================== */}
      {activeTab === 'grades' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: '10px',
              border: '1px solid #E2E8F0',
              padding: '1.25rem',
              boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)'
            }}
          >
            <h4 style={{ fontSize: '0.96rem', fontWeight: 800, color: '#0F172A', margin: 0, marginBottom: '0.2rem' }}>
              Grade Scale Distribution Breakdown
            </h4>
            <p style={{ fontSize: '0.74rem', color: '#64748B', margin: '0 0 1rem 0' }}>
              Statistical breakdown of all recorded academic attempts across the institution ({gradeDistribution.total} total grades).
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {/* Excellent */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '0.25rem' }}>
                  <span style={{ fontWeight: 700, color: '#15803D' }}>
                    ⭐ Excellent (1.00 – 1.75)
                  </span>
                  <span style={{ color: '#475569', fontWeight: 700 }}>
                    {gradeDistribution.excellent.count} grades ({gradeDistribution.excellent.pct}%)
                  </span>
                </div>
                <div style={{ width: '100%', height: '8px', background: '#E2E8F0', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${gradeDistribution.excellent.pct}%`, height: '100%', background: '#16A34A', borderRadius: '4px' }} />
                </div>
              </div>

              {/* Good */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '0.25rem' }}>
                  <span style={{ fontWeight: 700, color: '#2563EB' }}>
                    📘 Good (2.00 – 2.50)
                  </span>
                  <span style={{ color: '#475569', fontWeight: 700 }}>
                    {gradeDistribution.good.count} grades ({gradeDistribution.good.pct}%)
                  </span>
                </div>
                <div style={{ width: '100%', height: '8px', background: '#E2E8F0', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${gradeDistribution.good.pct}%`, height: '100%', background: '#2563EB', borderRadius: '4px' }} />
                </div>
              </div>

              {/* Passing */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '0.25rem' }}>
                  <span style={{ fontWeight: 700, color: '#D97706' }}>
                    📙 Passing (2.75 – 3.00)
                  </span>
                  <span style={{ color: '#475569', fontWeight: 700 }}>
                    {gradeDistribution.passing.count} grades ({gradeDistribution.passing.pct}%)
                  </span>
                </div>
                <div style={{ width: '100%', height: '8px', background: '#E2E8F0', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${gradeDistribution.passing.pct}%`, height: '100%', background: '#D97706', borderRadius: '4px' }} />
                </div>
              </div>

              {/* Failed */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '0.25rem' }}>
                  <span style={{ fontWeight: 700, color: '#DC2626' }}>
                    ❌ Failed (5.00)
                  </span>
                  <span style={{ color: '#475569', fontWeight: 700 }}>
                    {gradeDistribution.failing.count} grades ({gradeDistribution.failing.pct}%)
                  </span>
                </div>
                <div style={{ width: '100%', height: '8px', background: '#E2E8F0', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${gradeDistribution.failing.pct}%`, height: '100%', background: '#DC2626', borderRadius: '4px' }} />
                </div>
              </div>

              {/* Dropped */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '0.25rem' }}>
                  <span style={{ fontWeight: 700, color: '#64748B' }}>
                    ⚠️ Dropped (DRP / 9.0)
                  </span>
                  <span style={{ color: '#475569', fontWeight: 700 }}>
                    {gradeDistribution.dropped.count} grades ({gradeDistribution.dropped.pct}%)
                  </span>
                </div>
                <div style={{ width: '100%', height: '8px', background: '#E2E8F0', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${gradeDistribution.dropped.pct}%`, height: '100%', background: '#94A3B8', borderRadius: '4px' }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 8. PRINT-ONLY SIGNATORY FOOTER                                        */}
      {/* ===================================================================== */}
      <div className="print-only" style={{ display: 'none', marginTop: '3rem', paddingTop: '1rem', borderTop: '1px solid #CBD5E1' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', textAlign: 'center' }}>
          <div>
            <div style={{ borderBottom: '1px solid #0F172A', width: '220px', height: '35px' }}></div>
            <p style={{ fontSize: '0.78rem', fontWeight: 700, margin: '0.3rem 0 0 0' }}>Prepared By</p>
            <p style={{ fontSize: '0.7rem', color: '#64748B', margin: 0 }}>Registrar Evaluator / Staff</p>
          </div>
          <div>
            <div style={{ borderBottom: '1px solid #0F172A', width: '220px', height: '35px' }}></div>
            <p style={{ fontSize: '0.78rem', fontWeight: 700, margin: '0.3rem 0 0 0' }}>Attested & Approved By</p>
            <p style={{ fontSize: '0.7rem', color: '#64748B', margin: 0 }}>College Registrar / Department Chair</p>
          </div>
        </div>
      </div>
    </div>
  );
};
