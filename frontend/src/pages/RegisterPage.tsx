import React, { useState, useEffect } from 'react';
import { fetchApi } from '../config/api';
import { useUI } from '../context/UIContext';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Mail,
  KeyRound,
  Loader2,
  RefreshCw,
  AlertCircle,
  Clock,
  Check
} from 'lucide-react';

interface RegisterPageProps {
  onGoToLogin: () => void;
}

export const RegisterPage: React.FC<RegisterPageProps> = ({ onGoToLogin }) => {
  const { showToast } = useUI();

  // Helper to read initial state from sessionStorage
  const getSessionValue = (key: string, fallback: string) => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem(`gct_reg_${key}`) || fallback;
    }
    return fallback;
  };

  // Steps:
  // 1 = Manual Student Information Input
  // 2 = Gmail OTP Verification
  // 3 = Registration Queued for Admin Approval
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // Form Fields (manual input: Student ID, Last Name, First Name, Middle Name (optional), Program, Email)
  const [studentId, setStudentId] = useState(() => getSessionValue('studentId', ''));
  const [lastName, setLastName] = useState(() => getSessionValue('lastName', ''));
  const [firstName, setFirstName] = useState(() => getSessionValue('firstName', ''));
  const [middleName, setMiddleName] = useState(() => getSessionValue('middleName', ''));
  const [program, setProgram] = useState(() => getSessionValue('program', 'BSIT'));
  const [email, setEmail] = useState(() => getSessionValue('email', ''));

  // OTP State
  const [otpCode, setOtpCode] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  // Status and Loading
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [submittedData, setSubmittedData] = useState<{
    student_id: string;
    last_name: string;
    first_name: string;
    middle_name?: string;
    full_name: string;
    program: string;
    email: string;
  } | null>(null);

  // Sync basic form inputs to sessionStorage so refresh doesn't wipe them
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      sessionStorage.setItem('gct_reg_studentId', studentId);
      sessionStorage.setItem('gct_reg_lastName', lastName);
      sessionStorage.setItem('gct_reg_firstName', firstName);
      sessionStorage.setItem('gct_reg_middleName', middleName);
      sessionStorage.setItem('gct_reg_program', program);
      sessionStorage.setItem('gct_reg_email', email);
    } catch (e) {
      console.warn('SessionStorage sync notice:', e);
    }
  }, [studentId, lastName, firstName, middleName, program, email]);

  // Resend OTP countdown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const clearRegistrationStorage = () => {
    if (typeof window === 'undefined') return;
    sessionStorage.removeItem('gct_reg_studentId');
    sessionStorage.removeItem('gct_reg_lastName');
    sessionStorage.removeItem('gct_reg_firstName');
    sessionStorage.removeItem('gct_reg_middleName');
    sessionStorage.removeItem('gct_reg_program');
    sessionStorage.removeItem('gct_reg_email');
    sessionStorage.removeItem('gct_reg_idFront');
    sessionStorage.removeItem('gct_reg_idBack');
    sessionStorage.removeItem('gct_reg_selfie');
  };

  // Step 1: Send Registration OTP to Gmail
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const cleanId = studentId.trim();
    const cleanLast = lastName.trim();
    const cleanFirst = firstName.trim();
    const cleanMiddle = middleName.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanId) {
      setErrorMsg('Please enter your GCT Student ID.');
      showToast('Student ID is required', 'warning');
      return;
    }

    if (!cleanLast) {
      setErrorMsg('Please enter your Last Name.');
      showToast('Last Name is required', 'warning');
      return;
    }

    if (!cleanFirst) {
      setErrorMsg('Please enter your First Name.');
      showToast('First Name is required', 'warning');
      return;
    }

    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMsg('Please provide a valid Gmail / Email address.');
      showToast('Valid Gmail address is required', 'warning');
      return;
    }

    const combinedName = cleanMiddle
      ? `${cleanLast}, ${cleanFirst} ${cleanMiddle}`
      : `${cleanLast}, ${cleanFirst}`;

    try {
      setLoading(true);
      const res = await fetchApi('/auth/send-registration-otp', {
        method: 'POST',
        body: JSON.stringify({
          student_id: cleanId,
          last_name: cleanLast,
          first_name: cleanFirst,
          middle_name: cleanMiddle,
          full_name: combinedName,
          email: cleanEmail,
          program
        })
      });

      showToast(res.message || `Verification code sent to ${cleanEmail}`, 'success');
      setCurrentStep(2);
      setResendCooldown(60);

      // If in dev / simulated mode, autofill OTP for convenient testing
      if (res.devOtp) {
        setOtpCode(res.devOtp);
      }
    } catch (err: any) {
      console.error('Request OTP Error:', err);
      setErrorMsg(err.message || 'Failed to send verification code. Please check your details.');
      showToast(err.message || 'Failed to send OTP', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    if (resendCooldown > 0 || loading) return;
    setErrorMsg('');

    const cleanLast = lastName.trim();
    const cleanFirst = firstName.trim();
    const cleanMiddle = middleName.trim();
    const combinedName = cleanMiddle
      ? `${cleanLast}, ${cleanFirst} ${cleanMiddle}`
      : `${cleanLast}, ${cleanFirst}`;

    try {
      setLoading(true);
      const res = await fetchApi('/auth/send-registration-otp', {
        method: 'POST',
        body: JSON.stringify({
          student_id: studentId.trim(),
          last_name: cleanLast,
          first_name: cleanFirst,
          middle_name: cleanMiddle,
          full_name: combinedName,
          email: email.trim().toLowerCase(),
          program
        })
      });

      showToast(`A new verification code has been sent to ${email.trim()}`, 'success');
      setResendCooldown(60);
      if (res.devOtp) {
        setOtpCode(res.devOtp);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to resend code');
      showToast(err.message || 'Failed to resend OTP', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Submit OTP and Complete Registration
  const handleVerifyOtpAndRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const cleanOtp = otpCode.trim();
    if (!cleanOtp || cleanOtp.length !== 6) {
      setErrorMsg('Please enter the 6-digit verification code sent to your Gmail.');
      showToast('Please enter the 6-digit OTP code', 'warning');
      return;
    }

    const cleanLast = lastName.trim();
    const cleanFirst = firstName.trim();
    const cleanMiddle = middleName.trim();
    const combinedName = cleanMiddle
      ? `${cleanLast}, ${cleanFirst} ${cleanMiddle}`
      : `${cleanLast}, ${cleanFirst}`;

    try {
      setLoading(true);
      const payload = {
        student_id: studentId.trim(),
        last_name: cleanLast,
        first_name: cleanFirst,
        middle_name: cleanMiddle,
        full_name: combinedName,
        email: email.trim().toLowerCase(),
        program,
        otp: cleanOtp
      };

      await fetchApi('/auth/register', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      setSubmittedData({
        student_id: payload.student_id,
        last_name: cleanLast,
        first_name: cleanFirst,
        middle_name: cleanMiddle,
        full_name: combinedName,
        program: payload.program,
        email: payload.email
      });

      clearRegistrationStorage();
      setCurrentStep(3);
      showToast('Registration submitted! Awaiting Admin approval.', 'success');
    } catch (err: any) {
      console.error('Registration Error:', err);
      setErrorMsg(err.message || 'Verification failed. Please check the code and try again.');
      showToast(err.message || 'Verification failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleGoBackToLogin = () => {
    clearRegistrationStorage();
    onGoToLogin();
  };

  return (
    <div style={{
      minHeight: '85vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem 1rem',
      backgroundColor: 'var(--bg-main)'
    }}>
      <div className="glass-card" style={{
        width: '100%',
        maxWidth: '560px',
        padding: '2.25rem 2.25rem',
        background: '#FFFFFF',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.08)',
        borderRadius: '16px',
        border: '1px solid #E2E8F0'
      }}>
        {/* Top Back Button */}
        {currentStep !== 3 && (
          <button
            type="button"
            onClick={handleGoBackToLogin}
            style={{
              background: 'none',
              border: 'none',
              color: '#64748B',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              marginBottom: '1rem',
              fontSize: '0.85rem',
              fontWeight: 600,
              padding: 0
            }}
          >
            <ArrowLeft size={16} /> Back to Sign In
          </button>
        )}

        {/* Header Branding */}
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <img
            src="/logo.png"
            alt="Garcia College of Technology Logo"
            style={{
              width: '80px',
              height: '80px',
              objectFit: 'contain',
              marginBottom: '0.75rem',
              filter: 'drop-shadow(0 4px 10px rgba(0, 0, 0, 0.12))'
            }}
          />
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
            Student Account Registration
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '0.35rem', fontWeight: 500 }}>
            Garcia College of Technology &bull; Subject Assessment System
          </p>
        </div>

        {/* Step Progress Indicators */}
        {currentStep !== 3 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.75rem',
            marginBottom: '1.5rem',
            padding: '0.65rem 1rem',
            background: '#F8FAFC',
            borderRadius: '10px',
            border: '1px solid #E2E8F0'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              fontSize: '0.82rem',
              fontWeight: 700,
              color: currentStep === 1 ? 'var(--primary)' : '#16A34A'
            }}>
              <span style={{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                background: currentStep === 1 ? 'var(--primary)' : '#16A34A',
                color: '#FFF',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.75rem'
              }}>
                {currentStep > 1 ? <Check size={12} /> : '1'}
              </span>
              <span>Student Details</span>
            </div>

            <span style={{ color: '#CBD5E1' }}>→</span>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              fontSize: '0.82rem',
              fontWeight: 700,
              color: currentStep === 2 ? 'var(--primary)' : '#94A3B8'
            }}>
              <span style={{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                background: currentStep === 2 ? 'var(--primary)' : '#CBD5E1',
                color: '#FFF',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.75rem'
              }}>
                2
              </span>
              <span>Gmail OTP</span>
            </div>
          </div>
        )}

        {/* Error Alert */}
        {errorMsg && (
          <div style={{
            background: '#FEF2F2',
            border: '1px solid #FCA5A5',
            borderRadius: '10px',
            padding: '0.75rem 1rem',
            color: '#991B1B',
            fontSize: '0.84rem',
            marginBottom: '1.25rem',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.5rem',
            lineHeight: 1.4
          }}>
            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>{errorMsg}</div>
          </div>
        )}

        {/* ============================================================== */}
        {/* STEP 1: STUDENT INFORMATION INPUT                              */}
        {/* ============================================================== */}
        {currentStep === 1 && (
          <form onSubmit={handleRequestOtp}>
            {/* Student ID */}
            <div style={{ marginBottom: '1.1rem' }}>
              <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                Student ID Number <span style={{ color: '#DC2626' }}>*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. 10526"
                value={studentId}
                onChange={e => setStudentId(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '0.7rem 0.9rem',
                  fontSize: '0.9rem',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  background: '#FFFFFF',
                  color: '#0F172A',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
              <span style={{ fontSize: '0.75rem', color: '#64748B', display: 'block', marginTop: '0.25rem' }}>
                Type your ID exactly as registered in the Garcia College of Technology record.
              </span>
            </div>

            {/* Last Name & First Name Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem', marginBottom: '1.1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                  Last Name <span style={{ color: '#DC2626' }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Dela Cruz"
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '0.7rem 0.9rem',
                    fontSize: '0.9rem',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    background: '#FFFFFF',
                    color: '#0F172A',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                  First Name <span style={{ color: '#DC2626' }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Juan"
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '0.7rem 0.9rem',
                    fontSize: '0.9rem',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    background: '#FFFFFF',
                    color: '#0F172A',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            {/* Middle Name (Optional) */}
            <div style={{ marginBottom: '1.1rem' }}>
              <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                Middle Name <span style={{ color: '#64748B', fontWeight: 400 }}>(Optional)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Santos"
                value={middleName}
                onChange={e => setMiddleName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.7rem 0.9rem',
                  fontSize: '0.9rem',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  background: '#FFFFFF',
                  color: '#0F172A',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Program / Course */}
            <div style={{ marginBottom: '1.1rem' }}>
              <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                Academic Program / Course <span style={{ color: '#DC2626' }}>*</span>
              </label>
              <select
                value={program}
                onChange={e => setProgram(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.7rem 0.9rem',
                  fontSize: '0.9rem',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  background: '#FFFFFF',
                  color: '#0F172A',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              >
                <option value="BSIT">BSIT - Bachelor of Science in Information Technology</option>
                <option value="BSCS">BSCS - Bachelor of Science in Computer Science</option>
              </select>
            </div>

            {/* Gmail Address */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                Gmail / Email Address <span style={{ color: '#DC2626' }}>*</span>
              </label>
              <input
                type="email"
                placeholder="e.g. juandelacruz@gmail.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '0.7rem 0.9rem',
                  fontSize: '0.9rem',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  background: '#FFFFFF',
                  color: '#0F172A',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
              <span style={{ fontSize: '0.75rem', color: '#64748B', display: 'block', marginTop: '0.25rem' }}>
                Make sure this is an active Gmail address. Your 6-digit OTP and login password will be sent here.
              </span>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              style={{
                width: '100%',
                padding: '0.85rem',
                fontSize: '0.95rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                borderRadius: '8px',
                cursor: loading ? 'not-allowed' : 'pointer'
              }}
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" /> Sending Verification Code...
                </>
              ) : (
                <>
                  Send Verification Code <ArrowRight size={17} />
                </>
              )}
            </button>
          </form>
        )}

        {/* ============================================================== */}
        {/* STEP 2: GMAIL OTP VERIFICATION                                 */}
        {/* ============================================================== */}
        {currentStep === 2 && (
          <form onSubmit={handleVerifyOtpAndRegister}>
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <div style={{
                width: '52px',
                height: '52px',
                borderRadius: '50%',
                background: '#EFF6FF',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '0.75rem',
                color: 'var(--primary)'
              }}>
                <Mail size={26} />
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                Check Your Gmail
              </h3>
              <p style={{ fontSize: '0.85rem', color: '#64748B', marginTop: '0.4rem', lineHeight: 1.4 }}>
                We sent a 6-digit verification code to <strong style={{ color: '#0F172A' }}>{email}</strong>. Please copy the code from your inbox and paste it below.
              </p>
            </div>

            {/* 6-Digit OTP Input */}
            <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
              <input
                type="text"
                maxLength={6}
                placeholder="123456"
                value={otpCode}
                onChange={e => setOtpCode(e.target.value.replace(/[^0-9]/g, ''))}
                autoFocus
                required
                style={{
                  width: '220px',
                  padding: '0.8rem',
                  fontSize: '1.75rem',
                  letterSpacing: '8px',
                  textAlign: 'center',
                  fontWeight: 800,
                  fontFamily: 'monospace',
                  borderRadius: '10px',
                  border: '2px solid var(--primary)',
                  background: '#F8FAFC',
                  color: 'var(--primary)',
                  outline: 'none',
                  margin: '0 auto'
                }}
              />
              <span style={{ fontSize: '0.75rem', color: '#64748B', display: 'block', marginTop: '0.5rem' }}>
                Enter the 6-digit numeric code from Garcia College of Technology
              </span>
            </div>

            {/* Submit OTP */}
            <button
              type="submit"
              disabled={loading || otpCode.length !== 6}
              className="btn btn-primary"
              style={{
                width: '100%',
                padding: '0.85rem',
                fontSize: '0.95rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                borderRadius: '8px',
                cursor: (loading || otpCode.length !== 6) ? 'not-allowed' : 'pointer',
                marginBottom: '1rem'
              }}
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" /> Verifying Code & Submitting...
                </>
              ) : (
                <>
                  <KeyRound size={17} /> Submit Registration for Approval
                </>
              )}
            </button>

            {/* Resend and Edit buttons */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem' }}>
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#64748B',
                  cursor: 'pointer',
                  fontWeight: 600,
                  padding: 0
                }}
              >
                &larr; Edit Student Details
              </button>

              <button
                type="button"
                onClick={handleResendOtp}
                disabled={resendCooldown > 0 || loading}
                style={{
                  background: 'none',
                  border: 'none',
                  color: resendCooldown > 0 ? '#94A3B8' : 'var(--primary)',
                  cursor: resendCooldown > 0 ? 'default' : 'pointer',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem'
                }}
              >
                <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend Code'}
              </button>
            </div>
          </form>
        )}

        {/* ============================================================== */}
        {/* STEP 3: REGISTRATION SUBMITTED - PENDING ADMIN APPROVAL         */}
        {/* ============================================================== */}
        {currentStep === 3 && (
          <div style={{ textAlign: 'center', padding: '0.5rem 0' }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: '#DCFCE7',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1rem',
              color: '#15803D'
            }}>
              <CheckCircle2 size={36} />
            </div>

            <h3 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0F172A', margin: '0 0 0.5rem 0' }}>
              Registration Submitted!
            </h3>
            <p style={{ fontSize: '0.88rem', color: '#475569', lineHeight: 1.5, margin: '0 0 1.5rem 0' }}>
              Your student registration details have been verified via OTP and queued for approval by the Registrar Admin.
            </p>

            {/* Registration Summary Card */}
            {submittedData && (
              <div style={{
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: '12px',
                padding: '1.1rem 1.25rem',
                textAlign: 'left',
                marginBottom: '1.5rem'
              }}>
                <div style={{ fontSize: '0.78rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.75rem' }}>
                  Submitted Registration Record
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.85rem' }}>
                  <div>
                    <span style={{ color: '#64748B', display: 'block', fontSize: '0.75rem' }}>Student ID</span>
                    <strong style={{ color: 'var(--primary)' }}>{submittedData.student_id}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748B', display: 'block', fontSize: '0.75rem' }}>Program</span>
                    <strong>{submittedData.program}</strong>
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <span style={{ color: '#64748B', display: 'block', fontSize: '0.75rem' }}>Full Name</span>
                    <strong>{submittedData.full_name}</strong>
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <span style={{ color: '#64748B', display: 'block', fontSize: '0.75rem' }}>Registered Gmail</span>
                    <strong>{submittedData.email}</strong>
                  </div>
                </div>
              </div>
            )}

            {/* Prominent Next Steps & 1-Week Password Notice */}
            <div style={{
              background: '#FEF3C7',
              border: '2px solid #F59E0B',
              borderRadius: '12px',
              padding: '1rem 1.25rem',
              textAlign: 'left',
              marginBottom: '1.5rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                <Clock size={18} color="#B45309" />
                <strong style={{ color: '#92400E', fontSize: '0.88rem' }}>
                  Next Step: Admin Approval & System-Generated Password
                </strong>
              </div>
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#78350F', lineHeight: 1.5 }}>
                1. The Registrar Admin will review your registration record.
                <br />
                2. Once approved, the system will automatically generate a secure password and send it to your Gmail (<strong>{submittedData?.email}</strong>).
                <br />
                3. <strong>Notice:</strong> All student passwords are <strong>valid for ONE WEEK only</strong>. The system automatically renews and sends a new password every week.
              </p>
            </div>

            <button
              type="button"
              onClick={handleGoBackToLogin}
              className="btn btn-primary"
              style={{
                width: '100%',
                padding: '0.85rem',
                fontSize: '0.95rem',
                fontWeight: 700,
                borderRadius: '8px'
              }}
            >
              Back to Sign In
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default RegisterPage;
