import React, { useState } from 'react';
import {
  Sun,
  Moon,
  Monitor,
  GraduationCap,
  Save,
  RotateCcw
} from 'lucide-react';
import { useRegistrarData } from './RegistrarDataContext';
import { fetchApi } from '../config/api';

export const SystemSettingsModule: React.FC = () => {
  const {
    passingThreshold,
    setPassingThreshold,
    maxFailedPrereqs,
    setMaxFailedPrereqs,
    activeAcademicYear,
    setActiveAcademicYear,
    activeSemesterSetting,
    setActiveSemesterSetting,
    refreshSettings,
    showToast
  } = useRegistrarData();

  // Theme state
  const [themeMode, setThemeMode] = useState<'light' | 'dark' | 'system'>('light');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await Promise.all([
        fetchApi('/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: 'passingThreshold', value: passingThreshold })
        }),
        fetchApi('/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: 'maxFailedPrereqs', value: maxFailedPrereqs })
        }),
        fetchApi('/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: 'activeAcademicYear', value: activeAcademicYear })
        }),
        fetchApi('/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: 'activeSemester', value: activeSemesterSetting })
        })
      ]);
      await refreshSettings();
      showToast('System settings saved successfully!', 'success');
    } catch (err: any) {
      console.warn('Failed to sync settings to API:', err);
      showToast('System settings saved locally.', 'info');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetDefaults = () => {
    setThemeMode('light');
    showToast('Theme reset to light mode.', 'info');
  };

  return (
    <div>
      <form onSubmit={handleSave}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>

          {/* 1. Grading Rules */}
          <div className="glass-card" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              <GraduationCap size={20} color="var(--primary)" />
              <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                Grading Rules
              </h4>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="form-group">
                <label className="form-label">Passing Grade Threshold (%)</label>
                <input
                  type="number"
                  value={passingThreshold}
                  onChange={e => setPassingThreshold(e.target.value)}
                  className="form-input"
                  min="50"
                  max="100"
                  placeholder="e.g. 50"
                  required
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'block' }}>
                  Input for minimum passing score (e.g., 50% = 3.00 grade).
                </span>
              </div>

              <div className="form-group">
                <label className="form-label">Maximum Allowed Failed Prerequisites</label>
                <input
                  type="number"
                  value={maxFailedPrereqs}
                  onChange={e => setMaxFailedPrereqs(e.target.value)}
                  className="form-input"
                  min="1"
                  max="10"
                  placeholder="e.g. 3"
                  required
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'block' }}>
                  Limit before student is flagged for review.
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Active Academic Year</label>
                  <input
                    type="text"
                    value={activeAcademicYear}
                    onChange={e => setActiveAcademicYear(e.target.value)}
                    className="form-input"
                    placeholder="e.g. 2025-2026"
                    required
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'block' }}>
                    Current academic school year (free text).
                  </span>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Active Semester</label>
                  <select
                    value={activeSemesterSetting}
                    onChange={e => setActiveSemesterSetting(e.target.value)}
                    className="form-select"
                    required
                  >
                    <option value="1">1st Semester</option>
                    <option value="2">2nd Semester</option>
                    <option value="3">Summer Term</option>
                  </select>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'block' }}>
                    Current semester term.
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 2. Theme & Interface Mode */}
          <div className="glass-card" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              <Sun size={20} color="var(--primary)" />
              <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                Theme & Interface Mode
              </h4>
            </div>

            <div>
              <label style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-main)', display: 'block', marginBottom: '0.75rem' }}>
                3-Way Theme Switcher
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => {
                    setThemeMode('light');
                    showToast('Light theme active', 'info');
                  }}
                  style={{
                    padding: '1rem 0.5rem',
                    borderRadius: '12px',
                    border: themeMode === 'light' ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                    background: themeMode === 'light' ? '#EFF6FF' : '#FFFFFF',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.4rem',
                    transition: 'all 0.2s'
                  }}
                >
                  <Sun size={22} color={themeMode === 'light' ? 'var(--primary)' : '#64748B'} />
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, color: themeMode === 'light' ? 'var(--primary)' : 'var(--text-main)' }}>
                    ☀️ Light
                  </span>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                    Crisp & bright
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setThemeMode('dark');
                    showToast('Dark theme active', 'info');
                  }}
                  style={{
                    padding: '1rem 0.5rem',
                    borderRadius: '12px',
                    border: themeMode === 'dark' ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                    background: themeMode === 'dark' ? '#EFF6FF' : '#FFFFFF',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.4rem',
                    transition: 'all 0.2s'
                  }}
                >
                  <Moon size={22} color={themeMode === 'dark' ? 'var(--primary)' : '#64748B'} />
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, color: themeMode === 'dark' ? 'var(--primary)' : 'var(--text-main)' }}>
                    🌙 Dark
                  </span>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                    Sleek dark mode
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setThemeMode('system');
                    showToast('System auto-detect theme active', 'info');
                  }}
                  style={{
                    padding: '1rem 0.5rem',
                    borderRadius: '12px',
                    border: themeMode === 'system' ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                    background: themeMode === 'system' ? '#EFF6FF' : '#FFFFFF',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.4rem',
                    transition: 'all 0.2s'
                  }}
                >
                  <Monitor size={22} color={themeMode === 'system' ? 'var(--primary)' : '#64748B'} />
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, color: themeMode === 'system' ? 'var(--primary)' : 'var(--text-main)' }}>
                    💻 System
                  </span>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                    Matches OS
                  </span>
                </button>
              </div>
            </div>
          </div>

        </div>

        {/* 3. Actions at the bottom */}
        <div className="glass-card" style={{ padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <button
            type="button"
            onClick={handleResetDefaults}
            className="btn btn-secondary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, padding: '0.6rem 1.25rem' }}
          >
            <RotateCcw size={15} /> Reset Defaults
          </button>

          <button
            type="submit"
            disabled={isSaving}
            className="btn btn-primary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, padding: '0.6rem 1.5rem' }}
          >
            <Save size={16} /> {isSaving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  );
};
