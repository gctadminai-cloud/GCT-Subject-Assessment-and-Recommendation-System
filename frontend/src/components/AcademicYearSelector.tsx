import React, { useState, useEffect, useRef } from 'react';
import { useRegistrarData } from '../modules/RegistrarDataContext';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import {
  Calendar,
  Check,
  ChevronDown,
  Loader2,
  Plus,
  X
} from 'lucide-react';

export interface AcademicYearSelectorProps {
  variant?: 'light' | 'dark';
}

export const AcademicYearSelector: React.FC<AcademicYearSelectorProps> = ({ variant = 'light' }) => {
  const {
    academicYears,
    activeAcademicYear,
    selectedAcademicYear,
    setSelectedAcademicYearExternal,
    addAcademicYear,
    refreshAcademicYears
  } = useRegistrarData();

  const { user } = useAuth();
  const { showToast } = useUI();

  const [isOpen, setIsOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [newAyInput, setNewAyInput] = useState('');
  const [newAySetAsActive, setNewAySetAsActive] = useState(true);

  const dropdownRef = useRef<HTMLDivElement>(null);

  const isAdmin = user?.role === 'registrar_admin';

  // Compute auto-suggestion for new AY: latest existing AY +1
  const suggestedNextAy = React.useMemo(() => {
    if (academicYears.length === 0) {
      const now = new Date().getFullYear();
      return `${now}-${now + 1}`;
    }
    const sorted = [...academicYears].sort((a, b) => {
      const aStart = parseInt(String(a).split('-')[0] || '0', 10);
      const bStart = parseInt(String(b).split('-')[0] || '0', 10);
      return bStart - aStart;
    });
    const latest = sorted[0];
    const match = latest.match(/(\d{4})-(\d{4})/);
    if (match) {
      const y1 = parseInt(match[1], 10) + 1;
      const y2 = parseInt(match[2], 10) + 1;
      return `${y1}-${y2}`;
    }
    return latest;
  }, [academicYears]);

  // Click-outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setIsAdding(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-fill suggestion when opening add form
  useEffect(() => {
    if (isAdding && !newAyInput) {
      setNewAyInput(suggestedNextAy);
    }
  }, [isAdding, suggestedNextAy]);

  const handleSelectOption = async (value: string | 'all') => {
    setIsLoading(true);
    try {
      await setSelectedAcademicYearExternal(value);
      showToast(
        value === 'all'
          ? 'Showing academic records from all years'
          : `Now viewing data for Academic Year ${value}`,
        'info'
      );
    } finally {
      setIsLoading(false);
      setIsOpen(false);
    }
  };

  const handleSubmitNewAy = async (e: React.FormEvent) => {
    e.preventDefault();
    const input = newAyInput.trim();
    // Format validation
    const regex = /^(\d{4})-(\d{4})$/;
    const match = input.match(regex);
    if (!match) {
      showToast('Invalid format! Please use YYYY-YYYY (ex: 2026-2027)', 'error');
      return;
    }
    const y1 = parseInt(match[1], 10);
    const y2 = parseInt(match[2], 10);
    if (y2 !== y1 + 1) {
      showToast('Invalid range! Second year must be first year + 1 (ex: 2026-2027)', 'error');
      return;
    }
    setIsLoading(true);
    try {
      const ok = await addAcademicYear(input, newAySetAsActive);
      if (ok) {
        setNewAyInput('');
        setIsAdding(false);
        await refreshAcademicYears();
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Display label on trigger button
  const displayLabel = selectedAcademicYear === 'all'
    ? 'All Academic Years'
    : `AY ${selectedAcademicYear}`;

  const isLight = variant === 'light';

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        title="Academic Year Filter"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.4rem',
          padding: '0.45rem 0.8rem',
          borderRadius: '8px',
          background: isLight
            ? (selectedAcademicYear !== 'all' ? '#EFF6FF' : '#FFFFFF')
            : (selectedAcademicYear !== 'all' ? 'rgba(37, 99, 235, 0.25)' : 'rgba(255, 255, 255, 0.06)'),
          border: isLight
            ? (selectedAcademicYear !== 'all' ? '1px solid #93C5FD' : '1px solid #CBD5E1')
            : (selectedAcademicYear !== 'all' ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid rgba(255, 255, 255, 0.1)'),
          color: isLight
            ? (selectedAcademicYear !== 'all' ? '#1D4ED8' : '#334155')
            : (selectedAcademicYear !== 'all' ? '#BFDBFE' : '#CBD5E1'),
          fontSize: '0.8rem',
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          whiteSpace: 'nowrap',
          boxShadow: isLight ? '0 1px 2px rgba(15, 23, 42, 0.05)' : 'none'
        }}
      >
        {isLoading ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <Calendar size={14} color={isLight ? (selectedAcademicYear !== 'all' ? '#2563EB' : '#475569') : undefined} />
        )}
        <span>{displayLabel}</span>
        {selectedAcademicYear !== 'all' && selectedAcademicYear === activeAcademicYear && (
          <span
            style={{
              fontSize: '0.6rem',
              fontWeight: 700,
              padding: '1px 5px',
              borderRadius: '4px',
              background: '#ECFDF5',
              color: '#047857',
              border: '1px solid #A7F3D0'
            }}
          >
            Current
          </span>
        )}
        <ChevronDown size={13} style={{ opacity: 0.75 }} />
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            minWidth: '270px',
            maxWidth: '340px',
            background: '#FFFFFF',
            borderRadius: '10px',
            boxShadow: '0 10px 25px rgba(15, 23, 42, 0.18), 0 2px 6px rgba(15, 23, 42, 0.08)',
            border: '1px solid #E2E8F0',
            zIndex: 9999,
            overflow: 'hidden',
            color: '#0F172A',
            fontFamily: 'Inter, system-ui, sans-serif'
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '0.7rem 0.9rem',
              background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Calendar size={15} />
              <span style={{ fontSize: '0.82rem', fontWeight: 700 }}>
                Academic Year Filter
              </span>
            </div>
            <button
              onClick={() => { setIsOpen(false); setIsAdding(false); }}
              style={{
                border: 'none',
                background: 'transparent',
                color: '#BFDBFE',
                cursor: 'pointer',
                padding: '0.15rem',
                borderRadius: '4px',
                display: 'inline-flex'
              }}
            >
              <X size={13} />
            </button>
          </div>

          {/* Options List */}
          <div style={{ maxHeight: isAdding ? '180px' : '240px', overflowY: 'auto' }}>
            {/* All Academic Years */}
            <button
              type="button"
              onClick={() => handleSelectOption('all')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                textAlign: 'left',
                padding: '0.55rem 0.9rem',
                border: 'none',
                background: selectedAcademicYear === 'all' ? '#EFF6FF' : 'transparent',
                cursor: 'pointer',
                borderBottom: '1px solid #F1F5F9',
                transition: 'background 0.1s ease'
              }}
              onMouseEnter={(e) => { if (selectedAcademicYear !== 'all') (e.currentTarget as HTMLElement).style.background = '#F8FAFC'; }}
              onMouseLeave={(e) => { if (selectedAcademicYear !== 'all') (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              <span style={{ fontSize: '0.8rem', fontWeight: selectedAcademicYear === 'all' ? 700 : 600, color: '#1E293B' }}>
                📚 All Academic Years
              </span>
              {selectedAcademicYear === 'all' && <Check size={14} color="#1D4ED8" />}
            </button>

            {/* Each AY */}
            {academicYears.length === 0 && (
              <div style={{ padding: '0.85rem 0.9rem', textAlign: 'center', fontSize: '0.78rem', color: '#94A3B8' }}>
                <Loader2 size={14} className="animate-spin" style={{ verticalAlign: 'middle', marginRight: '0.3rem' }} />
                Loading academic years...
              </div>
            )}
            {academicYears.map(ay => {
              const isSelected = selectedAcademicYear === ay;
              const isActive = ay === activeAcademicYear;
              return (
                <div
                  key={ay}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    padding: '0.45rem 0.9rem',
                    background: isSelected ? '#EFF6FF' : 'transparent',
                    borderBottom: '1px solid #F1F5F9',
                    transition: 'background 0.1s ease',
                    boxSizing: 'border-box'
                  }}
                  onMouseEnter={(e) => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = '#F8FAFC'; }}
                  onMouseLeave={(e) => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  <button
                    type="button"
                    onClick={() => handleSelectOption(ay)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      flex: 1,
                      textAlign: 'left',
                      padding: 0
                    }}
                  >
                    <span style={{ fontSize: '0.8rem', fontWeight: isSelected ? 700 : 600, color: '#1E293B' }}>
                      AY {ay}
                    </span>
                    {isActive && (
                      <span
                        style={{
                          fontSize: '0.6rem',
                          fontWeight: 700,
                          padding: '1px 6px',
                          borderRadius: '4px',
                          background: '#ECFDF5',
                          color: '#047857',
                          border: '1px solid #A7F3D0'
                        }}
                      >
                        Current
                      </span>
                    )}
                  </button>

                  {isSelected && <Check size={14} color="#1D4ED8" />}
                </div>
              );
            })}
          </div>


          {/* Add New AY Section */}
          <div
            style={{
              borderTop: '1px solid #E2E8F0',
              background: '#F8FAFC'
            }}
          >
            {isAdmin && !isAdding && (
              <button
                type="button"
                onClick={() => { setIsAdding(true); setNewAyInput(suggestedNextAy); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.35rem',
                  width: '100%',
                  padding: '0.6rem 0.9rem',
                  border: 'none',
                  background: 'transparent',
                  color: '#1D4ED8',
                  fontWeight: 700,
                  fontSize: '0.76rem',
                  cursor: 'pointer',
                  transition: 'background 0.15s ease'
                }}
                onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = '#EFF6FF'}
                onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = 'transparent'}
              >
                <Plus size={13} />
                Add New Academic Year
              </button>
            )}

            {isAdmin && isAdding && (
              <form onSubmit={handleSubmitNewAy} style={{ padding: '0.85rem 0.9rem' }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0F172A', marginBottom: '0.5rem' }}>
                  ➕ Register New Academic Year
                </div>
                <input
                  type="text"
                  value={newAyInput}
                  onChange={e => setNewAyInput(e.target.value)}
                  placeholder="YYYY-YYYY (ex: 2026-2027)"
                  style={{
                    width: '100%',
                    padding: '0.45rem 0.65rem',
                    borderRadius: '6px',
                    border: '1px solid #CBD5E1',
                    fontSize: '0.78rem',
                    outline: 'none',
                    marginBottom: '0.5rem',
                    boxSizing: 'border-box'
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = '#2563EB')}
                  onBlur={(e) => (e.currentTarget.style.borderColor = '#CBD5E1')}
                />
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    fontSize: '0.72rem',
                    color: '#334155',
                    marginBottom: '0.6rem',
                    cursor: 'pointer',
                    userSelect: 'none'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={newAySetAsActive}
                    onChange={e => setNewAySetAsActive(e.target.checked)}
                  />
                  Set as Active Academic Year
                </label>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <button
                    type="button"
                    onClick={() => { setIsAdding(false); setNewAyInput(''); }}
                    style={{
                      flex: 1,
                      padding: '0.45rem',
                      borderRadius: '6px',
                      border: '1px solid #E2E8F0',
                      background: '#FFFFFF',
                      color: '#475569',
                      fontSize: '0.76rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading || !newAyInput.trim()}
                    style={{
                      flex: 1,
                      padding: '0.45rem',
                      borderRadius: '6px',
                      border: 'none',
                      background: isLoading || !newAyInput.trim() ? '#93C5FD' : 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
                      color: '#FFFFFF',
                      fontSize: '0.76rem',
                      fontWeight: 700,
                      cursor: isLoading || !newAyInput.trim() ? 'not-allowed' : 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.3rem'
                    }}
                  >
                    {isLoading ? <Loader2 size={12} className="animate-spin" /> : null}
                    Add Year
                  </button>
                </div>
              </form>
            )}

            {/* Non-admin note */}
            {!isAdmin && !isAdding && (
              <div
                style={{
                  padding: '0.55rem 0.9rem',
                  textAlign: 'center',
                  fontSize: '0.7rem',
                  color: '#94A3B8',
                  fontStyle: 'italic'
                }}
              >
                Contact Registrar Admin to add new academic years
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
