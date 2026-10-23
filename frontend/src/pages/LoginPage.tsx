import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import { fetchApi } from '../config/api';
import {
  ArrowRight,
  AlertCircle,
  Eye,
  EyeOff,
  KeyRound,
  Mail,
  CheckCircle2,
  X,
  RefreshCw,
  Lock,
  ShieldCheck,
  ArrowLeft
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

  // Forgot Password Modal States (3-Step: request -> verify -> new_password)
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotStep, setForgotStep] = useState<'request' | 'verify' | 'new_password'>('request');
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  // Load remembered username on mount
  useEffect(() => {
    const savedUsername = localStorage.getItem('gct_remember_login');
    if (savedUsername) {
      setUsername(savedUsername);
      setRememberMe(true);
    }
  }, []);

  // Countdown timer for resend code
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown(prev => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

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

  // Step 1: Send OTP to registered email
  const handleRequestOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!forgotEmail.trim()) {
      setForgotError('Please enter your registered email address.');
      return;
    }

    try {
      setForgotLoading(true);
      setForgotError('');
      setForgotSuccess('');

      const res = await fetchApi('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: forgotEmail.trim() })
      });

      setForgotOtp('');
      setForgotSuccess(res.message || 'Verification code sent to your Gmail inbox.');
      showToast('Verification code sent to your Gmail inbox! Please check your email.', 'success');
      setForgotStep('verify');
      setResendCooldown(60); // 60s cooldown
    } catch (err: any) {
      setForgotError(err.message || 'Failed to send verification code. Please verify your email.');
      showToast(err.message || 'Email lookup failed', 'error');
    } finally {
      setForgotLoading(false);
    }
  };

  // Step 2: Verify 6-digit OTP code before proceeding to set new password
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');

    const cleanOtp = forgotOtp.trim();
    if (!cleanOtp) {
      setForgotError('Please enter the 6-digit verification code.');
      return;
    }
    if (cleanOtp.length !== 6) {
      setForgotError('Verification code must be exactly 6 digits.');
      return;
    }

    try {
      setForgotLoading(true);
      setForgotError('');
      setForgotSuccess('');

      const res = await fetchApi('/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify({
          email: forgotEmail.trim(),
          otp: cleanOtp
        })
      });

      setForgotSuccess(res.message || 'Code verified! You may now set your new password.');
      showToast('Code verified successfully!', 'success');
      setForgotStep('new_password');
    } catch (err: any) {
      setForgotError(err.message || 'Invalid or expired verification code. Please try again.');
      showToast(err.message || 'Code verification failed', 'error');
    } finally {
      setForgotLoading(false);
    }
  };

  // Step 3: Set New Password & finalize reset
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');

    if (!newPassword || newPassword.length < 6) {
      setForgotError('New password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setForgotError('Passwords do not match. Please re-enter.');
      return;
    }

    try {
      setForgotLoading(true);
      const res = await fetchApi('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({
          email: forgotEmail.trim(),
          otp: forgotOtp.trim(),
          newPassword
        })
      });

      showToast('Password reset successfully! You can now log in.', 'success');
      setForgotSuccess(res.message || 'Password successfully updated!');

      if (res.username) {
        setUsername(res.username);
      } else {
        setUsername(forgotEmail.trim());
      }
      setPassword('');

      // Auto close modal after brief delay
      setTimeout(() => {
        setShowForgotModal(false);
        setForgotStep('request');
        setForgotOtp('');
        setNewPassword('');
        setConfirmNewPassword('');
        setForgotSuccess('');
      }, 1800);
    } catch (err: any) {
      setForgotError(err.message || 'Failed to reset password. Please check your code.');
      showToast(err.message || 'Password reset failed', 'error');
    } finally {
      setForgotLoading(false);
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
              <label className="form-label" style={{ margin: 0 }}>Password</label>
              <button
                type="button"
                onClick={() => {
                  setShowForgotModal(true);
                  setForgotStep('request');
                  setForgotError('');
                  setForgotSuccess('');
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--primary)',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  padding: 0
                }}
              >
                Forgot Password?
              </button>
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

      {/* FORGOT PASSWORD MODAL */}
      {showForgotModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(10, 25, 35, 0.72)',
          backdropFilter: 'blur(8px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'clamp(0.75rem, 4vw, 1.5rem)'
        }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: '18px',
            width: '100%',
            maxWidth: '480px',
            maxHeight: 'min(780px, 92vh)',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 32px 80px -28px rgba(2, 20, 32, 0.55)',
            border: '1px solid rgba(226, 232, 240, 0.9)',
            overflow: 'hidden',
            animation: 'fadeIn 0.18s ease-out'
          }}>
            <div style={{ height: '4px', background: 'linear-gradient(90deg, #0F766E 0%, #2563EB 100%)', flexShrink: 0 }} />
            {/* Modal Header */}
            <div style={{
              background: '#FFFFFF',
              color: '#0F172A',
              padding: '1.1rem clamp(1rem, 5vw, 1.5rem)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid #E8EEF3',
              flexShrink: 0
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: '#E8F3F8', color: '#155E75', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  <KeyRound size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.08rem', fontWeight: 800, color: '#102A43' }}>Account recovery</h3>
                  <p style={{ margin: '0.15rem 0 0', fontSize: '0.76rem', color: '#64748B' }}>Reset your GCT account password securely</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                style={{
                  background: '#F1F5F9',
                  border: '1px solid #E2E8F0',
                  borderRadius: '9px',
                  width: '34px',
                  height: '34px',
                  color: '#475569',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
                aria-label="Close password recovery"
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: 'clamp(1rem, 5vw, 1.5rem)', overflowY: 'auto' }}>
              {/* Alert Feedback */}
              {forgotError && (
                <div style={{
                  background: '#FEF2F2',
                  border: '1px solid #FCA5A5',
                  color: '#DC2626',
                  padding: '0.65rem 0.85rem',
                  borderRadius: '10px',
                  fontSize: '0.82rem',
                  marginBottom: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem'
                }}>
                  <AlertCircle size={16} style={{ flexShrink: 0 }} />
                  <span>{forgotError}</span>
                </div>
              )}

              {forgotSuccess && (
                <div style={{
                  background: '#F0FDF4',
                  border: '1px solid #86EFAC',
                  color: '#166534',
                  padding: '0.65rem 0.85rem',
                  borderRadius: '10px',
                  fontSize: '0.82rem',
                  marginBottom: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem'
                }}>
                  <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
                  <span>{forgotSuccess}</span>
                </div>
              )}

              {/* STEP PROGRESS INDICATOR */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                marginBottom: '1.4rem',
                padding: '0.75rem 0.6rem',
                background: '#F7FAFC',
                borderRadius: '12px',
                border: '1px solid #E5EDF2'
              }}>
                {/* Step 1: Email */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                    fontSize: '0.72rem',
                  fontWeight: 700,
                  color: forgotStep === 'request' ? 'var(--primary)' : '#10B981'
                }}>
                  <span style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: forgotStep === 'request' ? 'var(--primary)' : '#10B981',
                    color: '#FFFFFF',
                    fontSize: '0.7rem'
                  }}>
                    {forgotStep !== 'request' ? '✓' : '1'}
                  </span>
                  <span>Email</span>
                </div>

                <div style={{
                  width: '20px',
                  height: '2px',
                  background: forgotStep !== 'request' ? '#10B981' : '#CBD5E1'
                }} />

                {/* Step 2: Verify OTP */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                    fontSize: '0.72rem',
                  fontWeight: 700,
                  color: forgotStep === 'verify' ? 'var(--primary)' : (forgotStep === 'new_password' ? '#10B981' : '#94A3B8')
                }}>
                  <span style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: forgotStep === 'verify' ? 'var(--primary)' : (forgotStep === 'new_password' ? '#10B981' : '#E2E8F0'),
                    color: forgotStep === 'request' ? '#64748B' : '#FFFFFF',
                    fontSize: '0.7rem'
                  }}>
                    {forgotStep === 'new_password' ? '✓' : '2'}
                  </span>
                  <span>Enter Code</span>
                </div>

                <div style={{
                  width: '20px',
                  height: '2px',
                  background: forgotStep === 'new_password' ? '#10B981' : '#CBD5E1'
                }} />

                {/* Step 3: New Password */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                    fontSize: '0.72rem',
                  fontWeight: 700,
                  color: forgotStep === 'new_password' ? 'var(--primary)' : '#94A3B8'
                }}>
                  <span style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: forgotStep === 'new_password' ? 'var(--primary)' : '#E2E8F0',
                    color: forgotStep === 'new_password' ? '#FFFFFF' : '#64748B',
                    fontSize: '0.7rem'
                  }}>
                    3
                  </span>
                  <span>New Password</span>
                </div>
              </div>

              {/* STEP 1: REQUEST OTP */}
              {forgotStep === 'request' && (
                <form onSubmit={handleRequestOtp}>
                  <p style={{ fontSize: '0.86rem', color: '#526579', marginTop: 0, marginBottom: '1.35rem', lineHeight: 1.65 }}>
                    Enter the email address you used when creating your GCT account. We will send you a 6-digit OTP verification code to reset your password.
                  </p>

                  <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                    <label className="form-label" style={{ fontWeight: 700, color: '#243B53' }}>Registered email address</label>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <input
                        type="email"
                        placeholder="e.g. student@student.gct.edu.ph"
                        value={forgotEmail}
                        onChange={e => setForgotEmail(e.target.value)}
                        className="form-input"
                        style={{ paddingLeft: '2.7rem', height: '48px', borderRadius: '10px', background: '#FBFDFE' }}
                        autoCapitalize="none"
                        required
                      />
                      <Mail size={16} color="#94A3B8" style={{ position: 'absolute', left: '0.85rem' }} />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={forgotLoading}
                    style={{ width: '100%', minHeight: '48px', padding: '0.75rem', fontWeight: 700, borderRadius: '10px' }}
                  >
                    {forgotLoading ? 'Sending Verification Code...' : 'Send OTP Verification Code'}
                  </button>
                </form>
              )}

              {/* STEP 2: VERIFY OTP CODE */}
              {forgotStep === 'verify' && (
                <form onSubmit={handleVerifyOtp}>
                  <div style={{
                    background: '#F8FAFC',
                    border: '1px solid #E2E8F0',
                    borderRadius: '10px',
                    padding: '0.65rem 0.85rem',
                    marginBottom: '1.25rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                      <Mail size={15} color="#2563EB" />
                      <span style={{ fontSize: '0.8rem', color: '#475569' }}>
                        Code sent to: <strong>{forgotEmail}</strong>
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setForgotStep('request');
                        setForgotError('');
                        setForgotSuccess('');
                      }}
                      style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
                    >
                      Change
                    </button>
                  </div>

                  {/* 6-Digit OTP Code */}
                  <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                    <label className="form-label">6-Digit Verification Code</label>
                    <input
                      type="text"
                      maxLength={6}
                      placeholder="• • • • • •"
                      value={forgotOtp}
                      onChange={e => setForgotOtp(e.target.value.replace(/\D/g, ''))}
                      className="form-input"
                      style={{
                        textAlign: 'center',
                        fontSize: '1.4rem',
                        fontWeight: 800,
                        letterSpacing: '8px',
                        padding: '0.85rem',
                        height: '58px',
                        borderRadius: '12px',
                        background: '#FBFDFE',
                        color: '#12304A'
                      }}
                      required
                      autoFocus
                    />
                    <small style={{ color: '#64748B', fontSize: '0.75rem', marginTop: '0.35rem', display: 'block', textAlign: 'center' }}>
                      Check your Gmail inbox or Spam folder for the 6-digit code.
                    </small>
                  </div>

                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={forgotLoading || forgotOtp.trim().length !== 6}
                    style={{
                      width: '100%',
                      minHeight: '48px',
                      padding: '0.75rem',
                      fontWeight: 700,
                      marginBottom: '0.75rem',
                      borderRadius: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem'
                    }}
                  >
                    <span>{forgotLoading ? 'Verifying Code...' : 'Next / Submit Code'}</span>
                    <ArrowRight size={16} />
                  </button>

                  <div style={{ textAlign: 'center' }}>
                    <button
                      type="button"
                      disabled={resendCooldown > 0 || forgotLoading}
                      onClick={handleRequestOtp}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: resendCooldown > 0 ? '#94A3B8' : 'var(--primary)',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        cursor: resendCooldown > 0 ? 'default' : 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem'
                      }}
                    >
                      <RefreshCw size={12} />
                      {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend verification code'}
                    </button>
                  </div>
                </form>
              )}

              {/* STEP 3: SET NEW PASSWORD */}
              {forgotStep === 'new_password' && (
                <form onSubmit={handleResetPassword}>
                  <div style={{
                    background: '#F0FDF4',
                    border: '1px solid #BBF7D0',
                    borderRadius: '10px',
                    padding: '0.65rem 0.85rem',
                    marginBottom: '1.25rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    <ShieldCheck size={18} color="#16A34A" />
                    <span style={{ fontSize: '0.8rem', color: '#166534', fontWeight: 600 }}>
                      Code verified! Please create your new password for <strong>{forgotEmail}</strong>
                    </span>
                  </div>

                  {/* New Password */}
                  <div className="form-group" style={{ marginBottom: '0.85rem' }}>
                    <label className="form-label">New Password</label>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        placeholder="At least 6 characters"
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        className="form-input"
                        style={{ paddingLeft: '2.7rem', paddingRight: '2.7rem', height: '48px', borderRadius: '10px', background: '#FBFDFE' }}
                        minLength={6}
                        required
                        autoFocus
                      />
                      <Lock size={16} color="#94A3B8" style={{ position: 'absolute', left: '0.85rem' }} />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        style={{ position: 'absolute', right: '0.75rem', background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}
                      >
                        {showNewPassword ? <Eye size={16} /> : <EyeOff size={16} />}
                      </button>
                    </div>
                  </div>

                  {/* Confirm New Password */}
                  <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                    <label className="form-label">Confirm New Password</label>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <input
                        type={showConfirmNewPassword ? 'text' : 'password'}
                        placeholder="Re-enter new password"
                        value={confirmNewPassword}
                        onChange={e => setConfirmNewPassword(e.target.value)}
                        className="form-input"
                        style={{ paddingLeft: '2.7rem', paddingRight: '2.7rem', height: '48px', borderRadius: '10px', background: '#FBFDFE' }}
                        minLength={6}
                        required
                      />
                      <Lock size={16} color="#94A3B8" style={{ position: 'absolute', left: '0.85rem' }} />
                      <button
                        type="button"
                        onClick={() => setShowConfirmNewPassword(!showConfirmNewPassword)}
                        style={{ position: 'absolute', right: '0.75rem', background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}
                      >
                        {showConfirmNewPassword ? <Eye size={16} /> : <EyeOff size={16} />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={forgotLoading}
                    style={{
                      width: '100%',
                      minHeight: '48px',
                      padding: '0.75rem',
                      fontWeight: 700,
                      marginBottom: '0.75rem',
                      borderRadius: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem'
                    }}
                  >
                    <KeyRound size={16} />
                    <span>{forgotLoading ? 'Updating Password...' : 'Reset Password & Log In'}</span>
                  </button>

                  <div style={{ textAlign: 'center' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setForgotStep('verify');
                        setForgotError('');
                        setForgotSuccess('');
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#64748B',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem'
                      }}
                    >
                      <ArrowLeft size={12} />
                      Back to Code Verification
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
