import React, { useState } from 'react';
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  School,
  BookOpen,
  Sun
} from 'lucide-react';
import { useRegistrarData } from './RegistrarDataContext';
import type { CurriculumSubject } from './types';

export const CurriculumModule: React.FC = () => {
  const {
    curriculumSubjects,
    setCurriculumSubjects,
    PROGRAM_CATALOG,
    showToast
  } = useRegistrarData();

  const [curriculumSearch, setCurriculumSearch] = useState('');
  const [curriculumProgramFilter, setCurriculumProgramFilter] = useState('ALL');

  // Add / Edit Subject Modal State
  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [subjectModalMode, setSubjectModalMode] = useState<'add' | 'edit'>('add');
  const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null);
  const [subjFormCode, setSubjFormCode] = useState('');
  const [subjFormTitle, setSubjFormTitle] = useState('');
  const [subjFormLecUnits, setSubjFormLecUnits] = useState('2');
  const [subjFormLabUnits, setSubjFormLabUnits] = useState('1');
  const [subjFormProgram, setSubjFormProgram] = useState('BSIT');
  const [subjFormYear, setSubjFormYear] = useState('1');
  const [subjFormSem, setSubjFormSem] = useState('1');
  const [subjFormPrereq, setSubjFormPrereq] = useState('None');

  const handleOpenAddSubjectModal = () => {
    setSubjectModalMode('add');
    setEditingSubjectId(null);
    setSubjFormCode('');
    setSubjFormTitle('');
    setSubjFormLecUnits('2');
    setSubjFormLabUnits('1');
    setSubjFormProgram('BSIT');
    setSubjFormYear('1');
    setSubjFormSem('1');
    setSubjFormPrereq('None');
    setShowSubjectModal(true);
  };

  const handleOpenEditSubjectModal = (s: CurriculumSubject) => {
    setSubjectModalMode('edit');
    setEditingSubjectId(s.id);
    setSubjFormCode(s.code);
    setSubjFormTitle(s.title);
    setSubjFormLecUnits(String(s.lecUnits ?? 2));
    setSubjFormLabUnits(String(s.labUnits ?? 1));
    setSubjFormProgram(s.program);
    setSubjFormYear(String(s.year_level));
    setSubjFormSem(String(s.semester));
    setSubjFormPrereq(s.prerequisites || 'None');
    setShowSubjectModal(true);
  };

  const handleSaveSubject = (e: React.FormEvent) => {
    e.preventDefault();
    const totalUnits = Number(subjFormLecUnits) + Number(subjFormLabUnits);
    if (subjectModalMode === 'add') {
      const newSubj: CurriculumSubject = {
        id: 'sub-' + Date.now(),
        code: subjFormCode.trim().toUpperCase(),
        title: subjFormTitle.trim(),
        lecUnits: Number(subjFormLecUnits),
        labUnits: Number(subjFormLabUnits),
        units: totalUnits,
        program: subjFormProgram,
        year_level: Number(subjFormYear),
        semester: Number(subjFormSem),
        prerequisites: subjFormPrereq.trim() || 'None'
      };
      setCurriculumSubjects(prev => [...prev, newSubj]);
      showToast(`Subject ${newSubj.code} added to curriculum catalog!`, 'success');
    } else {
      setCurriculumSubjects(prev => prev.map(s => {
        if (s.id === editingSubjectId) {
          return {
            ...s,
            code: subjFormCode.trim().toUpperCase(),
            title: subjFormTitle.trim(),
            lecUnits: Number(subjFormLecUnits),
            labUnits: Number(subjFormLabUnits),
            units: totalUnits,
            program: subjFormProgram,
            year_level: Number(subjFormYear),
            semester: Number(subjFormSem),
            prerequisites: subjFormPrereq.trim() || 'None'
          };
        }
        return s;
      }));
      showToast(`Subject ${subjFormCode.trim().toUpperCase()} updated successfully!`, 'success');
    }
    setShowSubjectModal(false);
  };

  const searchLower = curriculumSearch.toLowerCase().trim();

  const filteredCatalogSubjects = curriculumSubjects.filter(s => {
    const matchesSearch = !searchLower || s.code.toLowerCase().includes(searchLower) || s.title.toLowerCase().includes(searchLower);
    const matchesProg = curriculumProgramFilter === 'ALL' || s.program === curriculumProgramFilter;
    return matchesSearch && matchesProg;
  });

  const isAllPrograms = curriculumProgramFilter === 'ALL';
  const selectedProgObj = PROGRAM_CATALOG.find((p: any) => p.code === curriculumProgramFilter) || PROGRAM_CATALOG[0];
  const programSubjects = curriculumSubjects.filter(s => s.program === curriculumProgramFilter);
  const programTotalCredits = programSubjects.reduce((acc, curr) => acc + (curr.units || 0), 0);

  return (
    <div>
      {/* Header & Filter Controls Bar */}
      <div className="glass-card" style={{ padding: '1.25rem 1.5rem', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.85rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', flex: 1 }}>
            {/* Search */}
            <div style={{ position: 'relative', width: '260px' }}>
              <input
                type="text"
                placeholder="Search code or title..."
                value={curriculumSearch}
                onChange={e => setCurriculumSearch(e.target.value)}
                className="form-input"
                style={{ paddingLeft: '2.2rem', fontSize: '0.85rem', height: '38px' }}
              />
              <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }} />
            </div>

            {/* Program Filter Dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <select
                value={curriculumProgramFilter}
                onChange={e => setCurriculumProgramFilter(e.target.value)}
                className="form-select"
                style={{ width: '180px', fontSize: '0.88rem', height: '38px', fontWeight: 700 }}
              >
                <option value="ALL">All Programs</option>
                <option value="BSIT">BSIT</option>
                <option value="BSCS">BSCS</option>
              </select>
            </div>
          </div>

          {/* Right side: Add Button on 'ALL' OR Program Metadata when a specific program is selected */}
          {isAllPrograms ? (
            <div>
              <button
                onClick={handleOpenAddSubjectModal}
                className="btn btn-primary"
                style={{
                  height: '38px',
                  padding: '0 1rem',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem'
                }}
              >
                <Plus size={16} /> Add Subject to Catalog
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Department:</span>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)' }}>
                {selectedProgObj.department}
              </span>
              <span style={{ fontWeight: 800, color: 'var(--primary)', background: '#EFF6FF', padding: '3px 10px', borderRadius: '6px', fontSize: '0.8rem', border: '1px solid #BFDBFE' }}>
                Total Credits: {programTotalCredits} Units
              </span>
            </div>
          )}
        </div>
      </div>

      {/* VIEW MODE 1: ALL PROGRAMS — SUBJECT CATALOG TABLE WITH ACTIONS */}
      {isAllPrograms && (
        <div className="glass-card" style={{ padding: '1.35rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                Curriculum Subject Catalog ({filteredCatalogSubjects.length})
              </h3>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Institutional course offerings, credit allocations & prerequisite configurations
              </span>
            </div>
          </div>

          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Subject Code</th>
                  <th>Descriptive Title</th>
                  <th>Lec/Lab Units</th>
                  <th>Total Units</th>
                  <th>Program</th>
                  <th>Year & Term</th>
                  <th>Prerequisites</th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCatalogSubjects.map(s => {
                  const semText = s.semester === 1 ? '1st Sem' : s.semester === 2 ? '2nd Sem' : 'Summer';
                  const yearText = s.year_level === 1 ? '1st Year' : s.year_level === 2 ? '2nd Year' : s.year_level === 3 ? '3rd Year' : '4th Year';

                  return (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 800, color: 'var(--primary)' }}>{s.code}</td>
                      <td style={{ fontWeight: 700, color: 'var(--text-main)' }}>{s.title}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        {s.lecUnits ?? s.units} Lec / {s.labUnits ?? 0} Lab
                      </td>
                      <td>
                        <span style={{ fontWeight: 800, color: 'var(--primary)', background: '#EFF6FF', padding: '3px 8px', borderRadius: '6px', fontSize: '0.8rem', border: '1px solid #BFDBFE' }}>
                          {s.units} Units
                        </span>
                      </td>
                      <td><span className={`badge badge-${s.program}`}>{s.program}</span></td>
                      <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                        {yearText}, {semText}
                      </td>
                      <td>
                        {s.prerequisites && s.prerequisites !== 'None' ? (
                          <span style={{ fontWeight: 700, color: 'var(--text-main)', background: 'var(--bg-main)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.8rem' }}>
                            {s.prerequisites}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>None</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                          <button
                            onClick={() => handleOpenEditSubjectModal(s)}
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
                            title="Edit subject"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            onClick={() => {
                              setCurriculumSubjects(prev => prev.filter(item => item.id !== s.id));
                              showToast(`Subject ${s.code} deleted from catalog`, 'info');
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
                            title="Delete subject"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredCatalogSubjects.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                      No subjects found matching your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW MODE 2: SPECIFIC PROGRAM — 4-YEAR CURRICULUM MATRIX (READ-ONLY) */}
      {!isAllPrograms && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {[1, 2, 3, 4].map(year => {
            const yearSubjects = programSubjects.filter(s => {
              const matchesYear = s.year_level === year;
              const matchesSearch = !searchLower || s.code.toLowerCase().includes(searchLower) || s.title.toLowerCase().includes(searchLower);
              return matchesYear && matchesSearch;
            });

            const sem1Subjects = yearSubjects.filter(s => s.semester === 1);
            const sem2Subjects = yearSubjects.filter(s => s.semester === 2);

            const sem1Units = sem1Subjects.reduce((acc, curr) => acc + (curr.units || 0), 0);
            const sem2Units = sem2Subjects.reduce((acc, curr) => acc + (curr.units || 0), 0);
            const yearTotalUnits = sem1Units + sem2Units;
            const yearName = year === 1 ? '1st Year' : year === 2 ? '2nd Year' : year === 3 ? '3rd Year' : '4th Year';

            // Summer subjects (Mid-Year) — to be rendered as an independent container below 3rd Year, before 4th Year
            const summerSubjects = programSubjects.filter(s => {
              const isSummer = s.semester === 3 || s.semester === 0 || String(s.semester).toLowerCase().includes('summer');
              const matchesSearch = !searchLower || s.code.toLowerCase().includes(searchLower) || s.title.toLowerCase().includes(searchLower);
              return isSummer && matchesSearch;
            });
            const hasSummerInProgram = programSubjects.some(s =>
              s.semester === 3 || s.semester === 0 || String(s.semester).toLowerCase().includes('summer')
            );
            const summerUnits = summerSubjects.reduce((acc, curr) => acc + (curr.units || 0), 0);

            return (
              <React.Fragment key={year}>
                <div className="glass-card" style={{ padding: '1.5rem' }}>
                  {/* Year Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <School size={20} color="var(--primary)" />
                      <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                        {yearName} Curriculum Matrix — {curriculumProgramFilter}
                      </h3>
                    </div>
                    <span style={{ fontWeight: 800, color: 'var(--primary)', background: '#EFF6FF', padding: '4px 10px', borderRadius: '6px', fontSize: '0.82rem', border: '1px solid #BFDBFE' }}>
                      Total Year Credits: {yearTotalUnits} Units
                    </span>
                  </div>

                  {/* Split Semester Columns (1st and 2nd Semester ONLY) */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
                    {/* 1st Semester Column */}
                    <div style={{ background: 'var(--bg-main)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                        <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                          1st Semester
                        </h4>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)', background: '#FFFFFF', padding: '2px 8px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                          {sem1Units} Units
                        </span>
                      </div>

                      <div className="table-container">
                        <table className="custom-table" style={{ background: '#FFFFFF', fontSize: '0.85rem' }}>
                          <thead>
                            <tr>
                              <th>Code</th>
                              <th>Title</th>
                              <th>Lec/Lab Units</th>
                              <th>Total Units</th>
                              <th>Prerequisites</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sem1Subjects.map(s => (
                              <tr key={s.id}>
                                <td style={{ fontWeight: 800, color: 'var(--primary)' }}>{s.code}</td>
                                <td style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.82rem' }}>{s.title}</td>
                                <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                  {s.lecUnits ?? s.units} Lec / {s.labUnits ?? 0} Lab
                                </td>
                                <td>
                                  <span style={{ fontWeight: 800, color: 'var(--primary)', background: '#EFF6FF', padding: '2px 6px', borderRadius: '4px', fontSize: '0.78rem', border: '1px solid #BFDBFE' }}>
                                    {s.units} Units
                                  </span>
                                </td>
                                <td style={{ fontSize: '0.78rem', color: s.prerequisites && s.prerequisites !== 'None' ? 'var(--text-main)' : 'var(--text-muted)' }}>
                                  {s.prerequisites && s.prerequisites !== 'None' ? (
                                    <span style={{ fontWeight: 700, color: 'var(--text-main)', background: 'var(--bg-main)', padding: '2px 5px', borderRadius: '4px' }}>
                                      {s.prerequisites}
                                    </span>
                                  ) : (
                                    'None'
                                  )}
                                </td>
                              </tr>
                            ))}
                            {sem1Subjects.length === 0 && (
                              <tr>
                                <td colSpan={5} style={{ textAlign: 'center', padding: '1.25rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                                  No subjects scheduled for 1st Semester.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* 2nd Semester Column */}
                    <div style={{ background: 'var(--bg-main)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                        <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                          2nd Semester
                        </h4>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)', background: '#FFFFFF', padding: '2px 8px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                          {sem2Units} Units
                        </span>
                      </div>

                      <div className="table-container">
                        <table className="custom-table" style={{ background: '#FFFFFF', fontSize: '0.85rem' }}>
                          <thead>
                            <tr>
                              <th>Code</th>
                              <th>Title</th>
                              <th>Lec/Lab Units</th>
                              <th>Total Units</th>
                              <th>Prerequisites</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sem2Subjects.map(s => (
                              <tr key={s.id}>
                                <td style={{ fontWeight: 800, color: 'var(--primary)' }}>{s.code}</td>
                                <td style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.82rem' }}>{s.title}</td>
                                <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                  {s.lecUnits ?? s.units} Lec / {s.labUnits ?? 0} Lab
                                </td>
                                <td>
                                  <span style={{ fontWeight: 800, color: 'var(--primary)', background: '#EFF6FF', padding: '2px 6px', borderRadius: '4px', fontSize: '0.78rem', border: '1px solid #BFDBFE' }}>
                                    {s.units} Units
                                  </span>
                                </td>
                                <td style={{ fontSize: '0.78rem', color: s.prerequisites && s.prerequisites !== 'None' ? 'var(--text-main)' : 'var(--text-muted)' }}>
                                  {s.prerequisites && s.prerequisites !== 'None' ? (
                                    <span style={{ fontWeight: 700, color: 'var(--text-main)', background: 'var(--bg-main)', padding: '2px 5px', borderRadius: '4px' }}>
                                      {s.prerequisites}
                                    </span>
                                  ) : (
                                    'None'
                                  )}
                                </td>
                              </tr>
                            ))}
                            {sem2Subjects.length === 0 && (
                              <tr>
                                <td colSpan={5} style={{ textAlign: 'center', padding: '1.25rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                                  No subjects scheduled for 2nd Semester.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                  </div>
                </div>

                {/* SUMMER TERM / MID-YEAR CONTAINER (SEPARATE CONTAINER BELOW 3RD YEAR, BEFORE 4TH YEAR) */}
                {year === 3 && hasSummerInProgram && (
                  <div key="summer-container" className="glass-card" style={{ padding: '1.5rem', borderLeft: '4px solid #D97706', background: 'linear-gradient(180deg, #FFFDF8 0%, #FFFFFF 100%)' }}>
                    {/* Summer Term Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-color)', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <div style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '8px',
                          background: '#FEF3C7',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          border: '1px solid #FDE68A'
                        }}>
                          <Sun size={18} color="#D97706" />
                        </div>
                        <div>
                          <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                            Summer Term (Mid-Year) Curriculum Matrix — {curriculumProgramFilter}
                            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#B45309', background: '#FEF3C7', padding: '2px 8px', borderRadius: '12px', border: '1px solid #FDE68A' }}>
                              Bridging Term (After 3rd Year · Before 4th Year)
                            </span>
                          </h3>
                        </div>
                      </div>
                      <span style={{ fontWeight: 800, color: '#B45309', background: '#FEF3C7', padding: '4px 10px', borderRadius: '6px', fontSize: '0.82rem', border: '1px solid #FDE68A' }}>
                        Total Summer Credits: {summerUnits} Units
                      </span>
                    </div>

                    {/* Summer Term Table */}
                    <div style={{ background: 'var(--bg-main)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                      <div className="table-container">
                        <table className="custom-table" style={{ background: '#FFFFFF', fontSize: '0.85rem' }}>
                          <thead>
                            <tr>
                              <th>Code</th>
                              <th>Title</th>
                              <th>Lec/Lab Units</th>
                              <th>Total Units</th>
                              <th>Prerequisites</th>
                            </tr>
                          </thead>
                          <tbody>
                            {summerSubjects.map(s => (
                              <tr key={s.id}>
                                <td style={{ fontWeight: 800, color: '#D97706' }}>{s.code}</td>
                                <td style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.82rem' }}>{s.title}</td>
                                <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                  {s.lecUnits ?? s.units} Lec / {s.labUnits ?? 0} Lab
                                </td>
                                <td>
                                  <span style={{ fontWeight: 800, color: '#D97706', background: '#FEF3C7', padding: '2px 6px', borderRadius: '4px', fontSize: '0.78rem', border: '1px solid #FDE68A' }}>
                                    {s.units} Units
                                  </span>
                                </td>
                                <td style={{ fontSize: '0.78rem', color: s.prerequisites && s.prerequisites !== 'None' ? 'var(--text-main)' : 'var(--text-muted)' }}>
                                  {s.prerequisites && s.prerequisites !== 'None' ? (
                                    <span style={{ fontWeight: 700, color: 'var(--text-main)', background: 'var(--bg-main)', padding: '2px 5px', borderRadius: '4px' }}>
                                      {s.prerequisites}
                                    </span>
                                  ) : (
                                    'None'
                                  )}
                                </td>
                              </tr>
                            ))}
                            {summerSubjects.length === 0 && (
                              <tr>
                                <td colSpan={5} style={{ textAlign: 'center', padding: '1.25rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                                  No subjects scheduled for Summer Term matching search filter.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      )}

      {/* ADD / EDIT CURRICULUM SUBJECT MODAL */}
      {showSubjectModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem'
        }}>
          <div className="glass-card" style={{
            width: '100%',
            maxWidth: '560px',
            background: '#FFFFFF',
            borderRadius: '16px',
            overflow: 'hidden',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
          }}>
            <div style={{
              padding: '1.25rem 1.5rem',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              background: 'var(--bg-main)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
                <BookOpen size={20} color="var(--primary)" />
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                  {subjectModalMode === 'add' ? 'Add Subject to Catalog' : 'Edit Curriculum Subject'}
                </h3>
              </div>
            </div>

            <form onSubmit={handleSaveSubject} style={{ padding: '1.5rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.75rem', marginBottom: '1rem' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Subject Code</label>
                  <input
                    type="text"
                    placeholder="e.g. IT 203"
                    value={subjFormCode}
                    onChange={e => setSubjFormCode(e.target.value)}
                    className="form-input"
                    required
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Descriptive Title</label>
                  <input
                    type="text"
                    placeholder="e.g. Web Systems 1"
                    value={subjFormTitle}
                    onChange={e => setSubjFormTitle(e.target.value)}
                    className="form-input"
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Lecture Units</label>
                  <input
                    type="number"
                    value={subjFormLecUnits}
                    onChange={e => setSubjFormLecUnits(e.target.value)}
                    className="form-input"
                    required
                    min="0"
                    max="6"
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Lab Units</label>
                  <input
                    type="number"
                    value={subjFormLabUnits}
                    onChange={e => setSubjFormLabUnits(e.target.value)}
                    className="form-input"
                    required
                    min="0"
                    max="6"
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Total Units</label>
                  <input
                    type="text"
                    value={`${Number(subjFormLecUnits || 0) + Number(subjFormLabUnits || 0)} Units`}
                    disabled
                    className="form-input"
                    style={{ background: '#F3F4F6', color: 'var(--primary)', fontWeight: 800 }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Program</label>
                  <select
                    value={subjFormProgram}
                    onChange={e => setSubjFormProgram(e.target.value)}
                    className="form-select"
                  >
                    <option value="BSIT">BSIT</option>
                    <option value="BSCS">BSCS</option>
                  </select>
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Year Level</label>
                  <select
                    value={subjFormYear}
                    onChange={e => setSubjFormYear(e.target.value)}
                    className="form-select"
                  >
                    <option value="1">1st Year</option>
                    <option value="2">2nd Year</option>
                    <option value="3">3rd Year</option>
                    <option value="4">4th Year</option>
                  </select>
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Semester</label>
                  <select
                    value={subjFormSem}
                    onChange={e => setSubjFormSem(e.target.value)}
                    className="form-select"
                  >
                    <option value="1">1st Semester</option>
                    <option value="2">2nd Semester</option>
                    <option value="3">Summer</option>
                  </select>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label className="form-label">Prerequisites (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. IT 102, MATH 101 or None"
                  value={subjFormPrereq}
                  onChange={e => setSubjFormPrereq(e.target.value)}
                  className="form-input"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
                <button
                  type="button"
                  onClick={() => setShowSubjectModal(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                >
                  {subjectModalMode === 'add' ? 'Add Subject' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
