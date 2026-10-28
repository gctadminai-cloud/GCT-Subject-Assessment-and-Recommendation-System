import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import {
  ArrowRight,
  AlertCircle,
  Eye,
  EyeOff
} from 'lucide-react';

interface LoginPageProps {
  onGoToRegister: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onGoToRegister }) => {
  const { login } = useAuth();
  const { showToast } = useUI();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Load remembered username on mount
  useEffect(() => {
    const savedUsername = localStorage.getItem('gct_remember_login');
    if (savedUsername) {
      setUsername(savedUsername);
      setRememberMe(true);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setErrorMsg('Please enter both your Username / Student ID and Password.');
      return;
    }

    try {
      setErrorMsg('');
      setSubmitting(true);
      const res = await login(username.trim(), password);

      // Handle Remember Me
      if (rememberMe) {
        localStorage.setItem('gct_remember_login', username.trim());
      } else {
        localStorage.removeItem('gct_remember_login');
      }

      showToast(`Welcome back, ${res.user.full_name || res.user.username}!`, 'success');
    } catch (err: any) {
      const msg = err.message || 'Login failed. Please check your credentials.';
      setErrorMsg(msg);
      showToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };



  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem 1rem',
      backgroundColor: 'var(--bg-main)'
    }}>
      <div className="glass-card" style={{ width: '100%', maxWidth: '440px', padding: '2.5rem', background: '#FFFFFF', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04)' }}>
        {/* Header Logo */}
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <img
            src="/logo.png"
            alt="Garcia College of Technology Logo"
            style={{
              width: '90px',
              height: '90px',
              objectFit: 'contain',
              marginBottom: '1rem',
              filter: 'drop-shadow(0 4px 12px rgba(0, 0, 0, 0.15))'
            }}
          />
          <h2 style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
            AI-Based Subject Recommendation and Assessment System
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.35rem', fontWeight: 500 }}>
            Garcia College of Technology
          </p>
        </div>

        {errorMsg && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#dc2626',
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            fontSize: '0.85rem',
            marginBottom: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            lineHeight: 1.4
          }}>
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Single Unified Login Form */}
        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label className="form-label">Username / Student ID</label>
            <input
              type="text"
              placeholder="e.g. GCT-2026-0123 or 10526"
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="form-input"
              autoCapitalize="none"
              required
            />
          </div>

          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <div style={{ marginBottom: '0.35rem' }}>
              <label className="form-label" style={{ margin: 0 }}>Password</label>
            </div>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="form-input"
                style={{ paddingRight: '2.5rem', width: '100%' }}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '0.75rem',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0.25rem'
                }}
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <Eye size={18} /> : <EyeOff size={18} />}
              </button>
            </div>
          </div>

          {/* Remember Me Checkbox */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-main)', userSelect: 'none' }}>
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={e => setRememberMe(e.target.checked)}
                style={{
                  width: '16px',
                  height: '16px',
                  accentColor: 'var(--primary)',
                  cursor: 'pointer',
                  borderRadius: '4px'
                }}
              />
              <span style={{ fontWeight: 500 }}>Remember me on this device</span>
            </label>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting}
            style={{ width: '100%', padding: '0.85rem', fontSize: '0.95rem', fontWeight: 700 }}
          >
            {submitting ? 'Authenticating...' : 'Sign In to Dashboard'} <ArrowRight size={16} />
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-color)' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Are you a GCT student? </span>
          <button
            onClick={onGoToRegister}
            style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem' }}
          >
            Create Student Account
          </button>
        </div>
      </div>

    </div>
  );
};
