import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  School,
  BookOpen,
  Sun,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  X,
  Database,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { useRegistrarData } from './RegistrarDataContext';
import { fetchApi } from '../config/api';
import { parseCurriculumFile, cleanPrerequisiteString, type ParsedCurriculumResult } from '../utils/curriculumParser';
import type { CurriculumSubject } from './types';

export const CurriculumModule: React.FC = () => {
  const {
    curriculumSubjects,
    setCurriculumSubjects,
    refreshSubjects,
    PROGRAM_CATALOG,
    showToast
  } = useRegistrarData();

  const [curriculumSearch, setCurriculumSearch] = useState('');
  const [curriculumProgramFilter, setCurriculumProgramFilter] = useState('ALL');

  // Pagination for All Programs Catalog (100 subjects per page to ensure fast, lag-free rendering)
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 100;
  const catalogContainerRef = useRef<HTMLDivElement>(null);

  // Reset pagination to Page 1 whenever search query or program filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [curriculumSearch, curriculumProgramFilter]);

  // Add / Edit Subject Modal State
  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [subjectModalMode, setSubjectModalMode] = useState<'add' | 'edit'>('add');
  const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null);
  const [isSavingSubject, setIsSavingSubject] = useState(false);

  const [subjFormCode, setSubjFormCode] = useState('');
  const [subjFormTitle, setSubjFormTitle] = useState('');
  const [subjFormLecUnits, setSubjFormLecUnits] = useState('2');
  const [subjFormLabUnits, setSubjFormLabUnits] = useState('1');
  const [subjFormUnits, setSubjFormUnits] = useState('3');
  const [subjFormProgram, setSubjFormProgram] = useState('BSIT');
  const [subjFormYear, setSubjFormYear] = useState('1');
  const [subjFormSem, setSubjFormSem] = useState('1');
  const [subjFormPrereq, setSubjFormPrereq] = useState('None');

  // Import Curriculum Modal State
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isParsingFile, setIsParsingFile] = useState(false);
  const [isCommittingImport, setIsCommittingImport] = useState(false);
  const [parsedResult, setParsedResult] = useState<ParsedCurriculumResult | null>(null);
  const [importPreviewFilter, setImportPreviewFilter] = useState('ALL');
  const [importPreviewSearch, setImportPreviewSearch] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Available programs computed dynamically from loaded subjects and PROGRAM_CATALOG
  const availablePrograms = useMemo(() => {
    const canonicalOrder = ['BSIT', 'BSCS', 'BSCE', 'BSEE', 'BSME', 'BSBA-FM', 'BSBA-HRM', 'BSBA-MM', 'BSBA-OM', 'BSHM', 'BSOA', 'BSA'];
    const set = new Set<string>();

    curriculumSubjects.forEach(s => {
      if (s.program && s.program.trim()) {
        set.add(s.program.trim().toUpperCase());
      }
    });

    if (set.size === 0) {
      PROGRAM_CATALOG.forEach(p => {
        if (p.code !== 'BSBA') set.add(p.code);
      });
    }

    // Sort according to institutional canonical order, then any additional programs
    return Array.from(set).sort((a, b) => {
      const idxA = canonicalOrder.indexOf(a);
      const idxB = canonicalOrder.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });
  }, [PROGRAM_CATALOG, curriculumSubjects]);

  const handleOpenAddSubjectModal = () => {
    setSubjectModalMode('add');
    setEditingSubjectId(null);
    setSubjFormCode('');
    setSubjFormTitle('');
    setSubjFormLecUnits('2');
    setSubjFormLabUnits('0');
    setSubjFormUnits('3');
    setSubjFormProgram(curriculumProgramFilter !== 'ALL' ? curriculumProgramFilter : 'BSIT');
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
    setSubjFormLabUnits(String(s.labUnits ?? 0));
    setSubjFormUnits(String(s.units ?? 3));
    setSubjFormProgram(s.program);
    setSubjFormYear(String(s.year_level));
    setSubjFormSem(String(s.semester));
    setSubjFormPrereq(cleanPrerequisiteString(s.prerequisites));
    setShowSubjectModal(true);
  };

  const handleSaveSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    const totalUnits = Number(subjFormUnits) || (Number(subjFormLecUnits) + Number(subjFormLabUnits)) || 3;
    const finalPrereq = cleanPrerequisiteString(subjFormPrereq);
    setIsSavingSubject(true);

    try {
      if (subjectModalMode === 'add') {
        const cleanCode = subjFormCode.trim().replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        const subjectId = `sub-${subjFormProgram.toLowerCase()}-${cleanCode}`;

        await fetchApi('/curriculum/subjects', {
          method: 'POST',
          body: JSON.stringify({
            id: subjectId,
            code: subjFormCode.trim().toUpperCase(),
            title: subjFormTitle.trim(),
            lec_units: Number(subjFormLecUnits),
            lab_units: Number(subjFormLabUnits),
            units: totalUnits,
            program: subjFormProgram,
            year_level: Number(subjFormYear),
            semester: Number(subjFormSem),
            prerequisites: finalPrereq
          })
        });

        showToast(`Subject ${subjFormCode.trim().toUpperCase()} added to Supabase curriculum catalog!`, 'success');
      } else if (editingSubjectId) {
        await fetchApi(`/curriculum/subjects/${editingSubjectId}`, {
          method: 'PUT',
          body: JSON.stringify({
            code: subjFormCode.trim().toUpperCase(),
            title: subjFormTitle.trim(),
            lec_units: Number(subjFormLecUnits),
            lab_units: Number(subjFormLabUnits),
            units: totalUnits,
            program: subjFormProgram,
            year_level: Number(subjFormYear),
            semester: Number(subjFormSem),
            prerequisites: finalPrereq
          })
        });

        showToast(`Subject ${subjFormCode.trim().toUpperCase()} updated in Supabase!`, 'success');
      }

      await refreshSubjects();
      setShowSubjectModal(false);
    } catch (err: any) {
      console.error('Save Subject Error:', err);
      showToast(err.message || 'Failed to save subject to database', 'error');
    } finally {
      setIsSavingSubject(false);
    }
  };

  const handleDeleteSubject = async (s: CurriculumSubject) => {
    if (!window.confirm(`Are you sure you want to delete ${s.code} (${s.title}) from the curriculum?`)) {
      return;
    }

    try {
      await fetchApi(`/curriculum/subjects/${s.id}`, { method: 'DELETE' });
      showToast(`Subject ${s.code} deleted from curriculum catalog`, 'info');
      await refreshSubjects();
    } catch (err: any) {
      console.error('Delete Subject Error:', err);
      // Fallback local deletion
      setCurriculumSubjects(prev => prev.filter(item => item.id !== s.id));
      showToast(`Subject ${s.code} removed from view`, 'info');
    }
  };

  // -------------------------------------------------------------
  // IMPORT CURRICULUM HANDLERS
  // -------------------------------------------------------------
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFile(file);
    setIsParsingFile(true);
    setParsedResult(null);

    try {
      const result = await parseCurriculumFile(file);
      setParsedResult(result);
      setImportPreviewFilter('ALL');
      setImportPreviewSearch('');
      showToast(`Parsed ${result.subjects.length} subjects across ${result.programs.length} degree programs!`, 'info');
    } catch (err: any) {
      console.error('Curriculum parsing error:', err);
      showToast('Failed to parse curriculum file: ' + (err.message || 'Invalid format'), 'error');
    } finally {
      setIsParsingFile(false);
    }
  };

  const handleCommitImport = async () => {
    if (!parsedResult || parsedResult.subjects.length === 0) return;
    if (!parsedResult.isValid) {
      showToast(`Cannot import: Missing required column(s): ${parsedResult.missingColumns.join(', ')}`, 'error');
      return;
    }
    setIsCommittingImport(true);

    try {
      const payload = {
        subjects: parsedResult.subjects.map(s => ({
          id: s.id,
          code: s.code,
          title: s.title,
          lec_units: s.lecUnits,
          lab_units: s.labUnits,
          units: s.units,
          program: s.program,
          year_level: s.year_level,
          semester: s.semester,
          prerequisites: s.prerequisites
        }))
      };

      const res = await fetchApi('/curriculum/import', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      showToast(
        res.message || `Successfully imported ${parsedResult.subjects.length} subjects into Supabase!`,
        'success'
      );

      await refreshSubjects();
      setShowImportModal(false);
      setImportFile(null);
      setParsedResult(null);
    } catch (err: any) {
      console.error('Commit import error:', err);
      showToast(err.message || 'Failed to sync curriculum with database', 'error');
    } finally {
      setIsCommittingImport(false);
    }
  };

  const searchLower = curriculumSearch.toLowerCase().trim();

  const filteredCatalogSubjects = curriculumSubjects.filter(s => {
    const matchesSearch = !searchLower || s.code.toLowerCase().includes(searchLower) || s.title.toLowerCase().includes(searchLower);
    const matchesProg = curriculumProgramFilter === 'ALL' || s.program === curriculumProgramFilter;
    return matchesSearch && matchesProg;
  });

  // Calculate 100-item page slice for lag-free All Programs rendering
  const totalPages = Math.max(1, Math.ceil(filteredCatalogSubjects.length / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const paginatedCatalogSubjects = useMemo(() => {
    const startIndex = (safeCurrentPage - 1) * pageSize;
    return filteredCatalogSubjects.slice(startIndex, startIndex + pageSize);
  }, [filteredCatalogSubjects, safeCurrentPage, pageSize]);

  const isAllPrograms = curriculumProgramFilter === 'ALL';
  const selectedProgObj = useMemo(() => {
    return PROGRAM_CATALOG.find((p: any) => p.code === curriculumProgramFilter) || {
      code: curriculumProgramFilter,
      name: curriculumProgramFilter,
      department: 'Garcia College of Technology',
      color: '#1D4ED8',
      bgColor: '#EFF6FF',
      description: 'Institutional Degree Program'
    };
  }, [PROGRAM_CATALOG, curriculumProgramFilter]);

  const programSubjects = curriculumSubjects.filter(s => s.program === curriculumProgramFilter);
  const programTotalCredits = programSubjects.reduce((acc, curr) => acc + (curr.units || 0), 0);

  // Filtered rows for import preview modal
  const previewSubjectsFiltered = useMemo(() => {
    if (!parsedResult) return [];
    let list = parsedResult.subjects;
    if (importPreviewFilter !== 'ALL') {
      list = list.filter(s => s.program === importPreviewFilter);
    }
    if (importPreviewSearch.trim()) {
      const q = importPreviewSearch.toLowerCase().trim();
      list = list.filter(s => s.code.toLowerCase().includes(q) || s.title.toLowerCase().includes(q));
    }
    return list;
  }, [parsedResult, importPreviewFilter, importPreviewSearch]);

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

            {/* Dynamic Program Filter Dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <select
                value={curriculumProgramFilter}
                onChange={e => setCurriculumProgramFilter(e.target.value)}
                className="form-select"
                style={{ minWidth: '160px', fontSize: '0.88rem', height: '38px', fontWeight: 700 }}
              >
                <option value="ALL">All Programs</option>
                {availablePrograms.map(p => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Action Buttons & Program Metadata */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            {!isAllPrograms && (
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

            <button
              onClick={() => {
                setShowImportModal(true);
                setImportFile(null);
                setParsedResult(null);
              }}
              className="btn btn-secondary"
              style={{
                height: '38px',
                padding: '0 1rem',
                fontSize: '0.85rem',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                background: '#EFF6FF',
                color: '#1D4ED8',
                borderColor: '#BFDBFE'
              }}
              title="Import institutional curriculum syllabus from Excel or CSV"
            >
              <Upload size={16} /> Import Curriculum (.xlsx / .csv)
            </button>

            {isAllPrograms ? (
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
            ) : (
              <button
                onClick={handleOpenAddSubjectModal}
                className="btn btn-primary"
                style={{
                  height: '38px',
                  padding: '0 0.85rem',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem'
                }}
              >
                <Plus size={15} /> Add to {curriculumProgramFilter}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* VIEW MODE 1: ALL PROGRAMS — SUBJECT CATALOG TABLE WITH ACTIONS */}
      {isAllPrograms && (
        <div ref={catalogContainerRef} className="glass-card" style={{ padding: '1.35rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Database size={18} color="var(--primary)" />
                Supabase Curriculum Subject Catalog ({filteredCatalogSubjects.length})
              </h3>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Institutional course offerings, credit allocations & prerequisite configurations live from database
              </span>
            </div>
            {filteredCatalogSubjects.length > 0 && (
              <span style={{
                fontSize: '0.78rem',
                fontWeight: 700,
                color: 'var(--primary)',
                background: '#EFF6FF',
                padding: '4px 10px',
                borderRadius: '8px',
                border: '1px solid #BFDBFE'
              }}>
                Showing {(safeCurrentPage - 1) * pageSize + 1}–{Math.min(safeCurrentPage * pageSize, filteredCatalogSubjects.length)} of {filteredCatalogSubjects.length} (Page {safeCurrentPage} of {totalPages})
              </span>
            )}
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
                {paginatedCatalogSubjects.map(s => {
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
                        {cleanPrerequisiteString(s.prerequisites) !== 'None' ? (
                          <span style={{ fontWeight: 700, color: 'var(--text-main)', background: 'var(--bg-main)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.8rem' }}>
                            {cleanPrerequisiteString(s.prerequisites)}
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
                            onClick={() => handleDeleteSubject(s)}
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
                    <td colSpan={8} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                      No subjects found matching your criteria. Click "Import Curriculum" to populate from Excel.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls for 100-item slices */}
          {filteredCatalogSubjects.length > pageSize && (
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingTop: '1rem',
              marginTop: '1rem',
              borderTop: '1px solid var(--border-color)',
              flexWrap: 'wrap',
              gap: '0.75rem'
            }}>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Showing <strong>{(safeCurrentPage - 1) * pageSize + 1}–{Math.min(safeCurrentPage * pageSize, filteredCatalogSubjects.length)}</strong> of <strong>{filteredCatalogSubjects.length}</strong> subjects • Page <strong>{safeCurrentPage}</strong> of <strong>{totalPages}</strong>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  disabled={safeCurrentPage === 1}
                  onClick={() => {
                    setCurrentPage(prev => Math.max(1, prev - 1));
                    catalogContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                  className="btn btn-secondary"
                  style={{
                    padding: '0.35rem 0.75rem',
                    fontSize: '0.8rem',
                    opacity: safeCurrentPage === 1 ? 0.5 : 1,
                    cursor: safeCurrentPage === 1 ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem'
                  }}
                >
                  <ChevronLeft size={14} />
                  <span>Previous</span>
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - safeCurrentPage) <= 2)
                  .map((p, idx, arr) => {
                    const prevP = arr[idx - 1];
                    const showEllipsis = prevP && p - prevP > 1;
                    return (
                      <React.Fragment key={p}>
                        {showEllipsis && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', padding: '0 0.2rem' }}>...</span>}
                        <button
                          type="button"
                          onClick={() => {
                            setCurrentPage(p);
                            catalogContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                          }}
                          style={{
                            minWidth: '32px',
                            height: '32px',
                            padding: '0 0.5rem',
                            fontSize: '0.8rem',
                            borderRadius: '6px',
                            border: p === safeCurrentPage ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                            background: p === safeCurrentPage ? 'var(--primary)' : '#FFFFFF',
                            color: p === safeCurrentPage ? '#FFFFFF' : 'var(--text-main)',
                            fontWeight: p === safeCurrentPage ? 800 : 600,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          {p}
                        </button>
                      </React.Fragment>
                    );
                  })}

                <button
                  type="button"
                  disabled={safeCurrentPage >= totalPages}
                  onClick={() => {
                    setCurrentPage(prev => Math.min(totalPages, prev + 1));
                    catalogContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                  className="btn btn-secondary"
                  style={{
                    padding: '0.35rem 0.75rem',
                    fontSize: '0.8rem',
                    opacity: safeCurrentPage >= totalPages ? 0.5 : 1,
                    cursor: safeCurrentPage >= totalPages ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem'
                  }}
                >
                  <span>Next</span>
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
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

            // Summer subjects (Mid-Year)
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

                  {/* Stacked Semester Containers (1st Semester on top, 2nd Semester below) */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    {/* 1st Semester Container */}
                    <div style={{ background: '#F8FAFC', padding: '1.25rem', borderRadius: '14px', border: '1px solid var(--border-color)' }}>
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
                              <th style={{ textAlign: 'center', width: '75px' }}>Actions</th>
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
                                <td style={{ fontSize: '0.78rem', color: cleanPrerequisiteString(s.prerequisites) !== 'None' ? 'var(--text-main)' : 'var(--text-muted)' }}>
                                  {cleanPrerequisiteString(s.prerequisites) !== 'None' ? (
                                    <span style={{ fontWeight: 700, color: 'var(--text-main)', background: 'var(--bg-main)', padding: '2px 5px', borderRadius: '4px' }}>
                                      {cleanPrerequisiteString(s.prerequisites)}
                                    </span>
                                  ) : (
                                    'None'
                                  )}
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}>
                                    <button
                                      type="button"
                                      onClick={() => handleOpenEditSubjectModal(s)}
                                      style={{
                                        background: 'var(--bg-main)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '6px',
                                        padding: '0.3rem 0.5rem',
                                        color: 'var(--primary)',
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                      }}
                                      title={`Edit ${s.code}`}
                                    >
                                      <Pencil size={13} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteSubject(s)}
                                      style={{
                                        background: '#FEF2F2',
                                        border: '1px solid #FCA5A5',
                                        borderRadius: '6px',
                                        padding: '0.3rem 0.5rem',
                                        color: '#DC2626',
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                      }}
                                      title={`Delete ${s.code}`}
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                            {sem1Subjects.length === 0 && (
                              <tr>
                                <td colSpan={6} style={{ textAlign: 'center', padding: '1.25rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                                  No subjects scheduled for 1st Semester.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* 2nd Semester Container */}
                    <div style={{ background: '#F8FAFC', padding: '1.25rem', borderRadius: '14px', border: '1px solid var(--border-color)' }}>
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
                              <th style={{ textAlign: 'center', width: '75px' }}>Actions</th>
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
                                <td style={{ fontSize: '0.78rem', color: cleanPrerequisiteString(s.prerequisites) !== 'None' ? 'var(--text-main)' : 'var(--text-muted)' }}>
                                  {cleanPrerequisiteString(s.prerequisites) !== 'None' ? (
                                    <span style={{ fontWeight: 700, color: 'var(--text-main)', background: 'var(--bg-main)', padding: '2px 5px', borderRadius: '4px' }}>
                                      {cleanPrerequisiteString(s.prerequisites)}
                                    </span>
                                  ) : (
                                    'None'
                                  )}
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}>
                                    <button
                                      type="button"
                                      onClick={() => handleOpenEditSubjectModal(s)}
                                      style={{
                                        background: 'var(--bg-main)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '6px',
                                        padding: '0.3rem 0.5rem',
                                        color: 'var(--primary)',
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                      }}
                                      title={`Edit ${s.code}`}
                                    >
                                      <Pencil size={13} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteSubject(s)}
                                      style={{
                                        background: '#FEF2F2',
                                        border: '1px solid #FCA5A5',
                                        borderRadius: '6px',
                                        padding: '0.3rem 0.5rem',
                                        color: '#DC2626',
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                      }}
                                      title={`Delete ${s.code}`}
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                            {sem2Subjects.length === 0 && (
                              <tr>
                                <td colSpan={6} style={{ textAlign: 'center', padding: '1.25rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
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

                {/* SUMMER TERM / MID-YEAR CONTAINER */}
                {year === 3 && hasSummerInProgram && (
                  <div key="summer-container" className="glass-card" style={{ padding: '1.5rem', borderLeft: '4px solid #D97706', background: 'linear-gradient(180deg, #FFFDF8 0%, #FFFFFF 100%)' }}>
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
                              <th style={{ textAlign: 'center', width: '75px' }}>Actions</th>
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
                                <td style={{ fontSize: '0.78rem', color: cleanPrerequisiteString(s.prerequisites) !== 'None' ? 'var(--text-main)' : 'var(--text-muted)' }}>
                                  {cleanPrerequisiteString(s.prerequisites) !== 'None' ? (
                                    <span style={{ fontWeight: 700, color: 'var(--text-main)', background: 'var(--bg-main)', padding: '2px 5px', borderRadius: '4px' }}>
                                      {cleanPrerequisiteString(s.prerequisites)}
                                    </span>
                                  ) : (
                                    'None'
                                  )}
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}>
                                    <button
                                      type="button"
                                      onClick={() => handleOpenEditSubjectModal(s)}
                                      style={{
                                        background: 'var(--bg-main)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '6px',
                                        padding: '0.3rem 0.5rem',
                                        color: '#D97706',
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                      }}
                                      title={`Edit ${s.code}`}
                                    >
                                      <Pencil size={13} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteSubject(s)}
                                      style={{
                                        background: '#FEF2F2',
                                        border: '1px solid #FCA5A5',
                                        borderRadius: '6px',
                                        padding: '0.3rem 0.5rem',
                                        color: '#DC2626',
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                      }}
                                      title={`Delete ${s.code}`}
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                            {summerSubjects.length === 0 && (
                              <tr>
                                <td colSpan={6} style={{ textAlign: 'center', padding: '1.25rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
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

      {/* ========================================================= */}
      {/* MODAL 1: IMPORT CURRICULUM FILE MODAL                     */}
      {/* ========================================================= */}
      {showImportModal && (
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
            maxWidth: '850px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            background: '#FFFFFF',
            borderRadius: '16px',
            overflow: 'hidden',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '1.25rem 1.5rem',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'var(--bg-main)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: '#EFF6FF',
                  border: '1px solid #BFDBFE',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Upload size={18} color="#1D4ED8" />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                    Import Institutional Curriculum
                  </h3>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Upload curriculum syllabus (.xlsx, .xls, .csv) to sync degree programs & prerequisites into Supabase
                  </span>
                </div>
              </div>
              <button
                onClick={() => {
                  if (!isCommittingImport) {
                    setShowImportModal(false);
                    setImportFile(null);
                    setParsedResult(null);
                  }
                }}
                disabled={isCommittingImport}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: isCommittingImport ? 'not-allowed' : 'pointer',
                  color: 'var(--text-muted)'
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
              {/* File Dropzone */}
              {!parsedResult && (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    border: '2px dashed var(--border-color)',
                    borderRadius: '14px',
                    padding: '2.5rem 1.5rem',
                    textAlign: 'center',
                    background: 'var(--bg-main)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileSelect}
                    style={{ display: 'none' }}
                  />
                  <FileSpreadsheet size={48} color="var(--primary)" style={{ margin: '0 auto 1rem', opacity: 0.8 }} />
                  <h4 style={{ margin: '0 0 0.4rem', fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)' }}>
                    {isParsingFile ? 'Parsing Curriculum Syllabus...' : 'Click or Drag & Drop Curriculum File'}
                  </h4>
                  <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)', maxWidth: '520px', marginLeft: 'auto', marginRight: 'auto' }}>
                    Accepts official multi-sheet workbooks (e.g. <strong>GCT_Curriculum_All_Programs.xlsx</strong>) with individual program sheets or standard single-sheet CSV/XLSX files.
                  </p>
                  <div style={{ marginTop: '1.25rem' }}>
                    <span className="btn btn-primary" style={{ fontSize: '0.82rem', pointerEvents: 'none' }}>
                      {isParsingFile ? 'Reading & Validating...' : 'Select File (.xlsx / .csv)'}
                    </span>
                  </div>
                </div>
              )}

              {/* Parsed Summary & Fast Preview */}
              {parsedResult && (
                <div>
                  {/* Selected File Details Banner */}
                  {importFile && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.65rem 0.95rem',
                      background: '#F8FAFC',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      marginBottom: '1rem',
                      fontSize: '0.82rem'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <FileSpreadsheet size={16} color="var(--primary)" />
                        <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{importFile.name}</span>
                        <span style={{ color: 'var(--text-muted)' }}>({(importFile.size / 1024).toFixed(1)} KB)</span>
                      </div>
                      <span style={{ color: parsedResult?.isValid ? '#16A34A' : '#DC2626', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                        {parsedResult?.isValid ? (
                          <><CheckCircle2 size={14} /> Structure Verified</>
                        ) : (
                          <><AlertCircle size={14} /> Validation Required</>
                        )}
                      </span>
                    </div>
                  )}

                  {/* Required Column Structure Verification Card (Cat. No., Descriptive Title, Lec, Lab, units, Pre-Requisite) */}
                  <div style={{
                    background: parsedResult.isValid ? '#F0FDF4' : '#FEF2F2',
                    border: `1px solid ${parsedResult.isValid ? '#BBF7D0' : '#FECACA'}`,
                    borderRadius: '12px',
                    padding: '0.95rem 1.15rem',
                    marginBottom: '1.25rem'
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '0.5rem',
                      marginBottom: '0.65rem'
                    }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        fontSize: '0.88rem',
                        fontWeight: 800,
                        color: parsedResult.isValid ? '#166534' : '#991B1B'
                      }}>
                        {parsedResult.isValid ? <CheckCircle2 size={18} color="#16A34A" /> : <AlertCircle size={18} color="#DC2626" />}
                        <span>
                          {parsedResult.isValid
                            ? 'All Required Curriculum Columns Verified'
                            : 'Required Curriculum Columns Missing'}
                        </span>
                      </div>
                      <span style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        padding: '3px 9px',
                        borderRadius: '6px',
                        background: parsedResult.isValid ? '#DCFCE7' : '#FEE2E2',
                        color: parsedResult.isValid ? '#15803D' : '#B91C1C',
                        border: `1px solid ${parsedResult.isValid ? '#86EFAC' : '#FCA5A5'}`
                      }}>
                        {parsedResult.isValid ? 'Valid GCT Curriculum Format' : `${parsedResult.missingColumns.length} Missing Column(s)`}
                      </span>
                    </div>

                    {/* Columns Checklist Badges */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem', marginBottom: parsedResult.isValid ? 0 : '0.65rem' }}>
                      {[
                        { label: 'Cat. No.', detected: parsedResult.detectedColumns?.catNo },
                        { label: 'Descriptive Title', detected: parsedResult.detectedColumns?.descriptiveTitle },
                        { label: 'Lec', detected: parsedResult.detectedColumns?.lec },
                        { label: 'Lab', detected: parsedResult.detectedColumns?.lab },
                        { label: 'units', detected: parsedResult.detectedColumns?.units },
                        { label: 'Pre-Requisite', detected: parsedResult.detectedColumns?.preRequisite }
                      ].map(col => (
                        <span
                          key={col.label}
                          style={{
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            padding: '3px 9px',
                            borderRadius: '6px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            background: col.detected ? '#DCFCE7' : '#FEE2E2',
                            color: col.detected ? '#166534' : '#991B1B',
                            border: `1px solid ${col.detected ? '#86EFAC' : '#FCA5A5'}`
                          }}
                        >
                          {col.detected ? '✓' : '✗'} {col.label} {col.detected ? 'Verified' : 'Missing'}
                        </span>
                      ))}
                    </div>

                    {!parsedResult.isValid && (
                      <div style={{ fontSize: '0.78rem', color: '#B91C1C', lineHeight: 1.5, marginTop: '0.4rem' }}>
                        <strong>Storage Blocked:</strong> The uploaded file does not satisfy the official curriculum requirement. Missing: <strong>{parsedResult.missingColumns.join(', ')}</strong>. Please verify that your sheet header contains: <em>Cat. No., Descriptive Title, Lec, Lab, units, and Pre-Requisite</em> before saving to Supabase.
                      </div>
                    )}
                  </div>

                  {parsedResult.warnings.length > 0 && (
                    <div style={{
                      padding: '0.65rem 0.95rem',
                      background: '#FEF2F2',
                      borderRadius: '8px',
                      border: '1px solid #FECACA',
                      marginBottom: '1rem',
                      fontSize: '0.8rem',
                      color: '#DC2626',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}>
                      <AlertCircle size={16} />
                      <span>{parsedResult.warnings.join(', ')}</span>
                    </div>
                  )}

                  {/* File Metadata & Quick Stats Bar */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: '0.85rem',
                    marginBottom: '1.25rem'
                  }}>
                    <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '10px', padding: '0.85rem 1rem' }}>
                      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#1D4ED8', textTransform: 'uppercase' }}>
                        Curriculum Subjects
                      </div>
                      <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#1E3A8A' }}>
                        {parsedResult.subjects.length}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#64748B' }}>Total courses recognized</div>
                    </div>

                    <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '10px', padding: '0.85rem 1rem' }}>
                      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#15803D', textTransform: 'uppercase' }}>
                        Degree Programs
                      </div>
                      <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#166534' }}>
                        {parsedResult.programs.length}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#64748B' }}>All departments detected</div>
                    </div>

                    <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '10px', padding: '0.85rem 1rem' }}>
                      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#B45309', textTransform: 'uppercase' }}>
                        Prerequisites
                      </div>
                      <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#92400E' }}>
                        {parsedResult.prerequisiteCount}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#64748B' }}>Course dependency rules</div>
                    </div>

                    <div style={{ background: '#FAF5FF', border: '1px solid #E9D5FF', borderRadius: '10px', padding: '0.85rem 1rem' }}>
                      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#7E22CE', textTransform: 'uppercase' }}>
                        Target Database
                      </div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#6B21A8', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Database size={16} /> Supabase
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#64748B' }}>public.subjects & prerequisites</div>
                    </div>
                  </div>

                  {/* Program Badges Breakdown */}
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                      Programs in File (Click chip to filter preview):
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                      <button
                        type="button"
                        onClick={() => setImportPreviewFilter('ALL')}
                        style={{
                          border: importPreviewFilter === 'ALL' ? '2px solid #2563EB' : '1px solid var(--border-color)',
                          background: importPreviewFilter === 'ALL' ? '#EFF6FF' : 'var(--bg-main)',
                          color: importPreviewFilter === 'ALL' ? '#1D4ED8' : 'var(--text-main)',
                          padding: '3px 10px',
                          borderRadius: '8px',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        All ({parsedResult.subjects.length})
                      </button>
                      {parsedResult.programs.map(prog => (
                        <button
                          key={prog}
                          type="button"
                          onClick={() => setImportPreviewFilter(prog)}
                          style={{
                            border: importPreviewFilter === prog ? '2px solid #2563EB' : '1px solid var(--border-color)',
                            background: importPreviewFilter === prog ? '#EFF6FF' : 'var(--bg-main)',
                            color: importPreviewFilter === prog ? '#1D4ED8' : 'var(--text-main)',
                            padding: '3px 10px',
                            borderRadius: '8px',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          {prog} ({parsedResult.programCounts[prog] || 0})
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Search within Preview */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <div style={{ position: 'relative', width: '240px' }}>
                      <input
                        type="text"
                        placeholder="Search preview rows..."
                        value={importPreviewSearch}
                        onChange={e => setImportPreviewSearch(e.target.value)}
                        className="form-input"
                        style={{ paddingLeft: '2rem', height: '34px', fontSize: '0.8rem' }}
                      />
                      <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)' }} />
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Previewing <strong>{Math.min(previewSubjectsFiltered.length, 60)}</strong> of <strong>{previewSubjectsFiltered.length}</strong> items
                    </span>
                  </div>

                  {/* Preview Table */}
                  <div style={{ maxHeight: '240px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px', background: '#FFFFFF' }}>
                    <table className="custom-table" style={{ fontSize: '0.78rem', margin: 0 }}>
                      <thead>
                        <tr>
                          <th>Program</th>
                          <th>Yr & Term</th>
                          <th>Subject Code</th>
                          <th>Descriptive Title</th>
                          <th>Lec / Lab</th>
                          <th>Units</th>
                          <th>Prerequisites</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewSubjectsFiltered.slice(0, 60).map((s, idx) => (
                          <tr key={s.id || idx}>
                            <td><span className={`badge badge-${s.program}`}>{s.program}</span></td>
                            <td>{s.year_level}Y - {s.semester === 1 ? '1st' : s.semester === 2 ? '2nd' : 'Summer'}</td>
                            <td style={{ fontWeight: 800, color: 'var(--primary)' }}>{s.code}</td>
                            <td style={{ fontWeight: 600 }}>{s.title}</td>
                            <td>{s.lecUnits} / {s.labUnits}</td>
                            <td style={{ fontWeight: 700 }}>{s.units}</td>
                            <td style={{ color: cleanPrerequisiteString(s.prerequisites) !== 'None' ? 'var(--text-main)' : 'var(--text-muted)' }}>
                              {cleanPrerequisiteString(s.prerequisites)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '1rem 1.5rem',
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'var(--bg-main)'
            }}>
              <div>
                {parsedResult && (
                  <button
                    type="button"
                    onClick={() => {
                      setImportFile(null);
                      setParsedResult(null);
                    }}
                    disabled={isCommittingImport}
                    className="btn btn-secondary"
                    style={{ fontSize: '0.82rem' }}
                  >
                    Select Different File
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowImportModal(false);
                    setImportFile(null);
                    setParsedResult(null);
                  }}
                  disabled={isCommittingImport}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.82rem' }}
                >
                  Cancel
                </button>

                {parsedResult && (
                  <button
                    type="button"
                    onClick={handleCommitImport}
                    disabled={isCommittingImport || !parsedResult.isValid || parsedResult.subjects.length === 0}
                    className="btn btn-primary"
                    style={{
                      fontSize: '0.82rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      opacity: (!parsedResult.isValid || isCommittingImport) ? 0.5 : 1,
                      cursor: (!parsedResult.isValid || isCommittingImport) ? 'not-allowed' : 'pointer'
                    }}
                    title={!parsedResult.isValid ? `Cannot store: Missing ${parsedResult.missingColumns.join(', ')}` : 'Commit verified curriculum to Supabase'}
                  >
                    {isCommittingImport ? (
                      <>Saving {parsedResult.subjects.length} Subjects to Supabase...</>
                    ) : !parsedResult.isValid ? (
                      <>
                        <AlertCircle size={16} /> Cannot Store: Missing Required Columns
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={16} />
                        Commit & Sync {parsedResult.subjects.length} Subjects to Supabase
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: ADD / EDIT CURRICULUM SUBJECT MODAL              */}
      {/* ========================================================= */}
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
                  <label className="form-label">Total Credit Units</label>
                  <input
                    type="number"
                    value={subjFormUnits}
                    onChange={e => setSubjFormUnits(e.target.value)}
                    className="form-input"
                    required
                    min="1"
                    max="12"
                    style={{ fontWeight: 800, color: 'var(--primary)' }}
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
                    {availablePrograms.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
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
                  disabled={isSavingSubject}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingSubject}
                  className="btn btn-primary"
                >
                  {isSavingSubject ? 'Saving...' : (subjectModalMode === 'add' ? 'Add Subject' : 'Save Changes')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
