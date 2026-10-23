import React, { useState, useEffect, useRef } from 'react';
import {
  GraduationCap,
  Check,
  ChevronDown,
  Sun,
  BookOpen,
  X
} from 'lucide-react';

export type SemesterValue = '1' | '2' | 'summer';

export interface SemesterSelectorProps {
  selectedSemester: SemesterValue;
  onSelectSemester: (sem: SemesterValue) => void;
  variant?: 'light' | 'dark';
  currentSemester?: SemesterValue;
}

interface SemesterOption {
  value: SemesterValue;
  label: string;
  badge: string;
  badgeColor: string;
  badgeBg: string;
  badgeBorder: string;
  description: string;
}

const SEMESTER_OPTIONS: SemesterOption[] = [
  {
    value: '1',
    label: '1st Semester',
    badge: '1st Sem',
    badgeColor: '#1D4ED8',
    badgeBg: '#EFF6FF',
    badgeBorder: '#BFDBFE',
    description: '1st semester curriculum track & 1st sem deficiencies'
  },
  {
    value: '2',
    label: '2nd Semester',
    badge: '2nd Sem',
    badgeColor: '#6D28D9',
    badgeBg: '#F5F3FF',
    badgeBorder: '#DDD6FE',
    description: '2nd semester curriculum track & 2nd sem deficiencies'
  },
  {
    value: 'summer',
    label: 'Summer',
    badge: 'Summer',
    badgeColor: '#B45309',
    badgeBg: '#FFFBEB',
    badgeBorder: '#FDE68A',
    description: 'Summer / midyear track & accelerated backlog retakes'
  }
];

export const SemesterSelector: React.FC<SemesterSelectorProps> = ({
  selectedSemester,
  onSelectSemester,
  variant = 'light',
  currentSemester
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isLight = variant === 'light';

  // Click-outside listener
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeOption = SEMESTER_OPTIONS.find(o => o.value === selectedSemester) || SEMESTER_OPTIONS[0];

  const handleSelect = (val: SemesterValue) => {
    onSelectSemester(val);
    setIsOpen(false);
  };

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        title="Semester Filter"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.4rem',
          padding: '0.45rem 0.8rem',
          borderRadius: '8px',
          background: isLight ? '#FFFFFF' : 'rgba(255, 255, 255, 0.06)',
          border: isLight ? '1px solid #CBD5E1' : '1px solid rgba(255, 255, 255, 0.1)',
          color: isLight ? '#334155' : '#CBD5E1',
          fontSize: '0.8rem',
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          whiteSpace: 'nowrap',
          boxShadow: isLight ? '0 1px 2px rgba(15, 23, 42, 0.05)' : 'none'
        }}
      >
        {selectedSemester === 'summer' ? (
          <Sun size={14} color="#D97706" />
        ) : (
          <GraduationCap size={14} color={isLight ? '#2563EB' : undefined} />
        )}
        <span>{activeOption.label}</span>
        {currentSemester && selectedSemester === currentSemester && (
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
            left: 0,
            minWidth: '280px',
            maxWidth: '320px',
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
              background: 'linear-gradient(135deg, #1E3A8A 0%, #2563EB 100%)',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <BookOpen size={15} />
              <span style={{ fontSize: '0.82rem', fontWeight: 700 }}>
                Academic Semester
              </span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
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
          <div style={{ padding: '0.35rem 0' }}>
            {SEMESTER_OPTIONS.map(opt => {
              const isSelected = selectedSemester === opt.value;
              const isCurrent = currentSemester === opt.value;
              return (
                <button
                  type="button"
                  key={opt.value}
                  onClick={() => handleSelect(opt.value)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    textAlign: 'left',
                    padding: '0.65rem 0.95rem',
                    border: 'none',
                    background: isSelected ? '#EFF6FF' : 'transparent',
                    cursor: 'pointer',
                    borderBottom: '1px solid #F1F5F9',
                    transition: 'background 0.1s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) (e.currentTarget as HTMLElement).style.background = '#F8FAFC';
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent';
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                      {opt.value === 'summer' ? (
                        <Sun size={14} color="#D97706" />
                      ) : (
                        <GraduationCap size={14} color={isSelected ? '#2563EB' : '#64748B'} />
                      )}
                      <span
                        style={{
                          fontSize: '0.82rem',
                          fontWeight: isSelected ? 700 : 600,
                          color: isSelected ? '#1D4ED8' : '#1E293B'
                        }}
                      >
                        {opt.label}
                      </span>
                      <span
                        style={{
                          fontSize: '0.62rem',
                          fontWeight: 700,
                          padding: '1px 6px',
                          borderRadius: '4px',
                          background: opt.badgeBg,
                          color: opt.badgeColor,
                          border: `1px solid ${opt.badgeBorder}`
                        }}
                      >
                        {opt.badge}
                      </span>
                      {isCurrent && (
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
                    </div>
                    <span style={{ fontSize: '0.68rem', color: '#64748B', marginLeft: '1.35rem' }}>
                      {opt.description}
                    </span>
                  </div>
                  {isSelected && <Check size={16} color="#1D4ED8" style={{ flexShrink: 0, marginLeft: '0.5rem' }} />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
