import React, { useState, useRef, useEffect } from 'react';
import { fetchApi } from '../config/api';
import { useUI } from '../context/UIContext';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Camera,
  Upload,
  RefreshCw,
  Trash2,
  UserCheck,
  CreditCard,
  X,
  AlertTriangle,
  Sparkles,
  ShieldCheck,
  Scan,
  Check,
  Loader2
} from 'lucide-react';

interface RegisterPageProps {
  onGoToLogin: () => void;
}

type CameraTarget = 'id_front' | 'id_back' | 'selfie' | null;

export const RegisterPage: React.FC<RegisterPageProps> = ({ onGoToLogin }) => {
  const { showToast } = useUI();

  // Helper to read initial state from sessionStorage
  const getSessionValue = (key: string, fallback: string) => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem(`gct_reg_${key}`) || fallback;
    }
    return fallback;
  };

  // Step state: 1 = Student Information, 2 = Photo ID & Selfie Verification
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);

  // Form Fields
  const [fullName, setFullName] = useState(() => getSessionValue('fullName', ''));
  const [firstName, setFirstName] = useState(() => getSessionValue('firstName', ''));
  const [lastName, setLastName] = useState(() => getSessionValue('lastName', ''));
  const [middleName, setMiddleName] = useState(() => getSessionValue('middleName', ''));
  const [email, setEmail] = useState(() => getSessionValue('email', ''));
  const [password, setPassword] = useState(() => getSessionValue('password', ''));
  const [confirmPassword, setConfirmPassword] = useState(() => getSessionValue('confirmPassword', ''));
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [studentId, setStudentId] = useState(() => getSessionValue('studentId', ''));
  const [program, setProgram] = useState(() => getSessionValue('program', 'BSIT'));
  const [yearLevel, setYearLevel] = useState(() => getSessionValue('yearLevel', '1'));

  // Returning vs Database-matched Student State
  const [isReturning, setIsReturning] = useState(false);
  const [databaseFound, setDatabaseFound] = useState(false);
  const [checkingStudent, setCheckingStudent] = useState(false);

  // Verification Photos States (Base64 Data URLs)
  const [idFrontImage, setIdFrontImage] = useState<string>(() => getSessionValue('idFront', ''));
  const [idBackImage, setIdBackImage] = useState<string>(() => getSessionValue('idBack', ''));
  const [selfieImage, setSelfieImage] = useState('');

  // Registration image validation state
  const [scanningActive, setScanningActive] = useState(false);

  const applyStudentData = (std: any) => {
    if (std.full_name) {
      setFullName(std.full_name);
      if (std.last_name) setLastName(std.last_name);
      if (std.first_name) setFirstName(std.first_name);
      if (!std.last_name || !std.first_name) {
        const parts = std.full_name.split(',');
        if (parts.length >= 2) {
          setLastName(parts[0].trim());
          const rest = parts[1].trim().split(' ');
          setFirstName(rest[0] || '');
          if (rest.length > 1) setMiddleName(rest.slice(1).join(' '));
        } else {
          setFirstName(std.full_name);
        }
      }
    }
    if (std.program && (std.program === 'BSIT' || std.program === 'BSCS')) {
      setProgram(std.program);
    }
    if (std.year_level) {
      setYearLevel(String(std.year_level));
    }
  };

  // Check if Student ID exists in students table or grade_records
  const checkStudentId = async (idVal: string) => {
    const trimmed = idVal.trim();
    if (!trimmed || trimmed.length < 4) {
      setIsReturning(false);
      setDatabaseFound(false);
      return;
    }
    try {
      setCheckingStudent(true);
      const res = await fetchApi(`/auth/check-student/${encodeURIComponent(trimmed)}`);
      if (res && res.isReturning && res.verified) {
        setIsReturning(true);
        setDatabaseFound(true);
        if (res.student) {
          applyStudentData(res.student);
        }
        showToast('Verified returning student record found! ID photos are waived.', 'info');
      } else if (res && (res.exists || res.existsInDatabase) && res.student) {
        setIsReturning(false);
        setDatabaseFound(true);
        applyStudentData(res.student);
        showToast(`Official GCT record found! Course (${res.student.program}) and Name populated.`, 'info');
      } else {
        setIsReturning(false);
        setDatabaseFound(false);
      }
    } catch (e) {
      setIsReturning(false);
      setDatabaseFound(false);
    } finally {
      setCheckingStudent(false);
    }
  };

  // Check on initial load if studentId is present
  useEffect(() => {
    if (studentId && studentId.length >= 4) {
      checkStudentId(studentId);
    }
  }, []);

  // Auto-sync form state to sessionStorage so page refreshes don't lose progress
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      sessionStorage.setItem('gct_reg_fullName', fullName);
      sessionStorage.setItem('gct_reg_firstName', firstName);
      sessionStorage.setItem('gct_reg_lastName', lastName);
      sessionStorage.setItem('gct_reg_middleName', middleName);
      sessionStorage.setItem('gct_reg_email', email);
      sessionStorage.setItem('gct_reg_password', password);
      sessionStorage.setItem('gct_reg_confirmPassword', confirmPassword);
      sessionStorage.setItem('gct_reg_studentId', studentId);
      sessionStorage.setItem('gct_reg_program', program);
      sessionStorage.setItem('gct_reg_yearLevel', yearLevel);
      if (idFrontImage) sessionStorage.setItem('gct_reg_idFront', idFrontImage);
      else sessionStorage.removeItem('gct_reg_idFront');
      if (idBackImage) sessionStorage.setItem('gct_reg_idBack', idBackImage);
      else sessionStorage.removeItem('gct_reg_idBack');
      sessionStorage.removeItem('gct_reg_selfie');
    } catch (err) {
      console.warn('Storage sync notice:', err);
    }
  }, [fullName, firstName, lastName, middleName, email, password, confirmPassword, studentId, program, yearLevel, idFrontImage, idBackImage, selfieImage]);

  const clearRegistrationStorage = () => {
    if (typeof window === 'undefined') return;
    sessionStorage.removeItem('gct_reg_fullName');
    sessionStorage.removeItem('gct_reg_firstName');
    sessionStorage.removeItem('gct_reg_lastName');
    sessionStorage.removeItem('gct_reg_middleName');
    sessionStorage.removeItem('gct_reg_email');
    sessionStorage.removeItem('gct_reg_password');
    sessionStorage.removeItem('gct_reg_confirmPassword');
    sessionStorage.removeItem('gct_reg_studentId');
    sessionStorage.removeItem('gct_reg_program');
    sessionStorage.removeItem('gct_reg_yearLevel');
    sessionStorage.removeItem('gct_reg_idFront');
    sessionStorage.removeItem('gct_reg_idBack');
    sessionStorage.removeItem('gct_reg_selfie');
  };

  // Live Camera Modal State
  const [cameraActiveTarget, setCameraActiveTarget] = useState<CameraTarget>(null);
  const [cameraFacingMode, setCameraFacingMode] = useState<'user' | 'environment'>('environment');
  const [cameraError, setCameraError] = useState<string>('');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Hidden file & native camera inputs
  const fileInputRefFront = useRef<HTMLInputElement | null>(null);
  const cameraInputRefFront = useRef<HTMLInputElement | null>(null);
  const fileInputRefBack = useRef<HTMLInputElement | null>(null);
  const cameraInputRefBack = useRef<HTMLInputElement | null>(null);

  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [previewPhotoModal, setPreviewPhotoModal] = useState<{ url: string; title: string } | null>(null);

  const triggerCameraOrModal = (target: 'id_front' | 'id_back' | 'selfie') => {
    if (typeof navigator !== 'undefined' && navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function') {
      setCameraActiveTarget(target);
    } else if (target === 'selfie') {
      showToast('Live selfie requires camera access in a secure browser connection.', 'error');
    } else {
      if (target === 'id_front') {
        cameraInputRefFront.current?.click();
      } else if (target === 'id_back') {
        cameraInputRefBack.current?.click();
      }
    }
  };

  // Start webcam stream for modal
  useEffect(() => {
    if (!cameraActiveTarget) return;

    let isMounted = true;
    const startCamera = async () => {
      setCameraError('');
      try {
        const mode = cameraActiveTarget === 'selfie' ? 'user' : cameraFacingMode;
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: mode,
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        });

        if (!isMounted) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(e => console.warn('Video play notice:', e));
        }
      } catch (err: any) {
        console.error('Camera access error:', err);
        setCameraError(err.message || 'Unable to access camera. Please allow camera permissions.');
      }
    };

    startCamera();

    return () => {
      isMounted = false;
      stopCamera();
    };
  }, [cameraActiveTarget, cameraFacingMode]);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const handleCaptureSnapshot = () => {
    if (!videoRef.current) return;

    try {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      if (cameraActiveTarget === 'selfie' || cameraFacingMode === 'user') {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

      if (cameraActiveTarget === 'id_front') setIdFrontImage(dataUrl);
      if (cameraActiveTarget === 'id_back') setIdBackImage(dataUrl);
      if (cameraActiveTarget === 'selfie') setSelfieImage(dataUrl);

      showToast(
        cameraActiveTarget === 'id_front'
          ? 'Front ID photo captured!'
          : cameraActiveTarget === 'id_back'
            ? 'Back ID photo captured!'
            : 'Selfie photo captured!',
        'success'
      );

      setCameraActiveTarget(null);
      stopCamera();
    } catch (err: any) {
      console.error('Capture error:', err);
      showToast('Failed to capture snapshot', 'error');
    }
  };

  const compressImageFile = (file: File, maxDim = 1280, quality = 0.82): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.onload = (e) => {
        const img = new Image();
        img.onerror = () => reject(new Error('Failed to load image'));
        img.onload = () => {
          let width = img.width;
          let height = img.height;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(e.target?.result as string);
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(dataUrl);
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, target: 'id_front' | 'id_back') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Please select a valid image file (PNG, JPG, JPEG).', 'error');
      return;
    }

    try {
      const compressedDataUrl = await compressImageFile(file);
      if (target === 'id_front') setIdFrontImage(compressedDataUrl);
      if (target === 'id_back') setIdBackImage(compressedDataUrl);
      showToast(
        target === 'id_front'
          ? 'Front ID photo attached!'
          : 'Back ID photo attached!',
        'success'
      );
    } catch (err: any) {
      console.error('Photo processing error:', err);
      showToast('Failed to process image file.', 'error');
    }
    e.target.value = '';
  };

  // Validate Step 1 before proceeding to Step 2
  const handleProceedToStep2 = () => {
    setErrorMsg('');
    const activeFullName = fullName.trim() || (middleName.trim()
      ? `${lastName.trim()}, ${firstName.trim()} ${middleName.trim()}`
      : `${lastName.trim()}, ${firstName.trim()}`);

    if (!studentId.trim()) {
      setErrorMsg('Please enter your GCT Student ID.');
      showToast('Student ID is required', 'warning');
      return;
    }

    if (!activeFullName.trim()) {
      setErrorMsg('Please provide your Full Name.');
      showToast('Full Name is required', 'warning');
      return;
    }

    if (!email.trim()) {
      setErrorMsg('Please provide a valid email address.');
      showToast('Email address is required', 'warning');
      return;
    }

    if (!password || password.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      showToast('Password must be at least 6 characters', 'warning');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('Password and Confirm Password do not match.');
      showToast('Passwords do not match', 'warning');
      return;
    }

    // Step 1 validated! Move to Step 2
    setCurrentStep(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Perform Final Registration Submission to Supabase
  const executeRegistrationSubmission = async () => {
    const activeFullName = fullName.trim() || (middleName.trim()
      ? `${lastName.trim()}, ${firstName.trim()} ${middleName.trim()}`
      : `${lastName.trim()}, ${firstName.trim()}`);

    try {
      setLoading(true);
      setErrorMsg('');

      const res = await fetchApi('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          full_name: activeFullName,
          student_id: studentId.trim(),
          email: email.trim(),
          program,
          year_level: Number(yearLevel),
          schedule: '1',
          password,
          id_front_image: isReturning ? null : idFrontImage,
          id_back_image: isReturning ? null : idBackImage,
          selfie_image: isReturning ? null : selfieImage
        })
      });

      const msg = res.message || (isReturning
        ? 'Welcome back! Your account has been restored and auto-approved.'
        : 'Registration submitted! Awaiting Registrar Staff approval.');

      setSuccessMsg(msg);
      clearRegistrationStorage();
      showToast(isReturning ? 'Account restored & auto-approved!' : 'Student registration submitted successfully!', 'success');
    } catch (err: any) {
      setErrorMsg(err.message || 'Registration failed');
      showToast(err.message || 'Registration failed', 'error');
    } finally {
      setLoading(false);
      setScanningActive(false);
    }
  };

  // Step 2: Validate and submit registration photos
  const handleStartStrictScanAndSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    // If returning student, ID photos are waived
    if (isReturning) {
      await executeRegistrationSubmission();
      return;
    }

    // Strictly enforce all 3 photos
    if (!idFrontImage) {
      setErrorMsg('Strict Verification: Please upload or capture the FRONT of your Student ID.');
      showToast('Missing Front ID photo!', 'warning');
      return;
    }
    if (!idBackImage) {
      setErrorMsg('Strict Verification: Please upload or capture the BACK of your Student ID.');
      showToast('Missing Back ID photo!', 'warning');
      return;
    }
    if (!selfieImage) {
      setErrorMsg('Strict Verification: Live Camera Selfie is required to verify identity.');
      showToast('Missing Live Selfie photo!', 'warning');
      return;
    }

    // The backend validates the images before saving the registration.
    setScanningActive(true);
    await executeRegistrationSubmission();
  };

  const handleGoBack = () => {
    clearRegistrationStorage();
    onGoToLogin();
  };

  const allPhotosCaptured = Boolean(idFrontImage && idBackImage && selfieImage);

  return (
    <div style={{
      minHeight: '85vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem 1rem',
      backgroundColor: 'var(--bg-main)'
    }}>
      <div className="glass-card" style={{ width: '100%', maxWidth: '640px', padding: '2rem 2.25rem', background: '#FFFFFF' }}>
        <button
          type="button"
          onClick={handleGoBack}
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
            fontWeight: 600
          }}
        >
          <ArrowLeft size={16} /> Back to Sign In
        </button>

        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <img
            src="/logo.png"
            alt="Garcia College of Technology Logo"
            style={{
              width: '85px',
              height: '85px',
              objectFit: 'contain',
              marginBottom: '0.85rem',
              filter: 'drop-shadow(0 4px 12px rgba(0, 0, 0, 0.15))'
            }}
          />
          <h2 style={{ fontSize: '1.55rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
            Student Account Registration
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.35rem', fontWeight: 500 }}>
            Garcia College of Technology &bull; Subject Assessment System
          </p>
        </div>

        {/* STEP PROGRESS INDICATOR (When not submitted yet) */}
        {!successMsg && !isReturning && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.75rem',
            marginBottom: '1.75rem',
            padding: '0.75rem',
            background: '#F8FAFC',
            borderRadius: '12px',
            border: '1px solid #E2E8F0'
          }}>
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              style={{
                background: currentStep === 1 ? 'var(--primary)' : '#E2E8F0',
                color: currentStep === 1 ? '#FFFFFF' : '#475569',
                border: 'none',
                borderRadius: '8px',
                padding: '6px 14px',
                fontSize: '0.82rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                cursor: 'pointer'
              }}
            >
              <span>1. Student Details</span>
              {currentStep === 2 && <Check size={14} color="#16A34A" />}
            </button>

            <span style={{ color: '#94A3B8', fontSize: '0.9rem' }}>→</span>

            <button
              type="button"
              onClick={() => {
                if (currentStep === 1) handleProceedToStep2();
              }}
              style={{
                background: currentStep === 2 ? 'var(--primary)' : '#E2E8F0',
                color: currentStep === 2 ? '#FFFFFF' : '#475569',
                border: 'none',
                borderRadius: '8px',
                padding: '6px 14px',
                fontSize: '0.82rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                cursor: 'pointer'
              }}
            >
              <span>2. ID & Selfie Verification</span>
              {allPhotosCaptured && <Check size={14} color="#16A34A" />}
            </button>
          </div>
        )}

        {successMsg ? (
          <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
            <CheckCircle2 size={56} color="#16A34A" style={{ marginBottom: '1rem' }} />
            <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0F172A', marginBottom: '0.5rem' }}>
              Registration Submitted!
            </h3>
            <p style={{ color: '#475569', fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: 1.6, maxWidth: '440px', margin: '0 auto 1.5rem auto' }}>
              {successMsg}
            </p>
            <button type="button" onClick={handleGoBack} className="btn btn-primary" style={{ padding: '0.75rem 2rem', fontWeight: 700 }}>
              Return to Sign In
            </button>
          </div>
        ) : (
          <div>
            {/* RETURNING STUDENT BANNER */}
            {isReturning && (
              <div style={{
                background: '#F0FDF4',
                border: '1px solid #86EFAC',
                borderRadius: '10px',
                padding: '0.85rem 1rem',
                marginBottom: '1.25rem',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.6rem'
              }}>
                <CheckCircle2 size={18} color="#16A34A" style={{ marginTop: '2px', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: '0.86rem', fontWeight: 700, color: '#166534' }}>
                    Verified Returning Student
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#15803D', marginTop: '2px', lineHeight: 1.4 }}>
                    Your Student ID is permanently verified in the GCT system. ID & selfie photos are waived! Set your password to activate your account.
                  </div>
                </div>
              </div>
            )}

            {/* DATABASE RECORD AUTO-MATCH BANNER */}
            {databaseFound && !isReturning && (
              <div style={{
                background: '#EFF6FF',
                border: '1px solid #BFDBFE',
                borderRadius: '10px',
                padding: '0.85rem 1rem',
                marginBottom: '1.25rem',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.6rem'
              }}>
                <Sparkles size={18} color="var(--primary)" style={{ marginTop: '2px', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: '0.86rem', fontWeight: 700, color: '#1E3A8A' }}>
                    Official Academic Record Found in GCT Database
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#1E40AF', marginTop: '2px', lineHeight: 1.4 }}>
                    Your official Full Name, Course ({program}), and Year Level have been automatically pre-filled based on your existing academic and grade records in Supabase.
                  </div>
                </div>
              </div>
            )}

            {/* Error Message Display */}
            {errorMsg && (
              <div style={{
                background: '#FEF2F2',
                border: '1px solid #FCA5A5',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                color: '#DC2626',
                fontSize: '0.82rem',
                marginBottom: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* ============================================================ */}
            {/* STEP 1: STUDENT PERSONAL & ACADEMIC INFORMATION              */}
            {/* ============================================================ */}
            {currentStep === 1 && (
              <form onSubmit={e => { e.preventDefault(); if (isReturning) executeRegistrationSubmission(); else handleProceedToStep2(); }}>
                <div style={{ marginBottom: '1.5rem' }}>
                  <h4 style={{ fontSize: '0.92rem', fontWeight: 800, color: '#1E293B', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <UserCheck size={16} color="var(--primary)" />
                    1. Student Identity & Course Details
                  </h4>

                  {/* Student ID field (Checked against DB) */}
                  <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                    <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>GCT Student ID</span>
                      {checkingStudent && (
                        <span style={{ fontSize: '0.72rem', color: 'var(--primary)', fontWeight: 600 }}>Checking GCT database...</span>
                      )}
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 10526 or GCT-2026-0001"
                      value={studentId}
                      onChange={e => {
                        const val = e.target.value;
                        setStudentId(val);
                        if (val.trim().length >= 4) {
                          checkStudentId(val);
                        } else {
                          setIsReturning(false);
                          setDatabaseFound(false);
                        }
                      }}
                      onBlur={() => checkStudentId(studentId)}
                      className="form-input"
                      required
                      autoFocus
                    />
                  </div>

                  {/* Full Name field */}
                  <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                    <label className="form-label">Full Name</label>
                    <input
                      type="text"
                      placeholder="e.g. ABAYON, CHIN-CHIN"
                      value={fullName}
                      onChange={e => setFullName(e.target.value)}
                      className="form-input"
                      required
                    />
                  </div>

                  {/* Name fields: First Name, Middle Name, Last Name */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem', marginBottom: '0.75rem' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">First Name</label>
                      <input
                        type="text"
                        placeholder="Enter first name"
                        value={firstName}
                        onChange={e => setFirstName(e.target.value)}
                        className="form-input"
                        required
                      />
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Middle Name <span style={{ fontWeight: 400, color: '#94A3B8' }}>(Optional)</span></label>
                      <input
                        type="text"
                        placeholder="Middle name"
                        value={middleName}
                        onChange={e => setMiddleName(e.target.value)}
                        className="form-input"
                      />
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Last Name</label>
                      <input
                        type="text"
                        placeholder="Enter last name"
                        value={lastName}
                        onChange={e => setLastName(e.target.value)}
                        className="form-input"
                        required
                      />
                    </div>
                  </div>

                  {/* Email Address */}
                  <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                    <label className="form-label">Email Address (Used for OTP & Password Recovery)</label>
                    <input
                      type="email"
                      placeholder="e.g. student@student.gct.edu.ph"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="form-input"
                      required
                    />
                  </div>

                  {/* Course & Year Level */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Course</label>
                      <select value={program} onChange={e => setProgram(e.target.value)} className="form-select">
                        <option value="BSIT">BSIT - Information Technology</option>
                        <option value="BSCS">BSCS - Computer Science</option>
                      </select>
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Year Level</label>
                      <select value={yearLevel} onChange={e => setYearLevel(e.target.value)} className="form-select">
                        <option value="1">1st Year</option>
                        <option value="2">2nd Year</option>
                        <option value="3">3rd Year</option>
                        <option value="4">4th Year</option>
                      </select>
                    </div>
                  </div>

                  {/* Password & Confirm Password */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Password</label>
                      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <input
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Min 6 characters"
                          value={password}
                          onChange={e => setPassword(e.target.value)}
                          className="form-input"
                          style={{ paddingRight: '2.5rem', width: '100%' }}
                          minLength={6}
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
                        >
                          {showPassword ? <Eye size={18} /> : <EyeOff size={18} />}
                        </button>
                      </div>
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Confirm Password</label>
                      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <input
                          type={showConfirmPassword ? 'text' : 'password'}
                          placeholder="Re-enter password"
                          value={confirmPassword}
                          onChange={e => setConfirmPassword(e.target.value)}
                          className="form-input"
                          style={{ paddingRight: '2.5rem', width: '100%' }}
                          minLength={6}
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
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
                        >
                          {showConfirmPassword ? <Eye size={18} /> : <EyeOff size={18} />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Step 1 Actions */}
                {isReturning ? (
                  <button
                    type="submit"
                    disabled={loading}
                    className="btn btn-primary"
                    style={{ width: '100%', padding: '0.85rem', fontWeight: 700 }}
                  >
                    {loading ? 'Restoring Account...' : 'Restore & Activate Returning Student Account'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleProceedToStep2}
                    className="btn btn-primary"
                    style={{ width: '100%', padding: '0.85rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                  >
                    Next: ID & Selfie Photos <ArrowRight size={18} />
                  </button>
                )}
              </form>
            )}

            {/* ============================================================ */}
            {/* STEP 2: PHOTO ID & SELFIE VERIFICATION WITH STRICT SCAN       */}
            {/* ============================================================ */}
            {currentStep === 2 && !isReturning && (
              <form onSubmit={handleStartStrictScanAndSubmit}>
                <div style={{
                  background: '#F8FAFC',
                  borderRadius: '14px',
                  border: '1px solid #E2E8F0',
                  padding: '1.25rem',
                  marginBottom: '1.5rem'
                }}>
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.4rem' }}>
                      <h4 style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0F172A', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <CreditCard size={16} color="var(--primary)" />
                        2. ID Card & Selfie Photos (Required)
                      </h4>
                      <span style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: '12px',
                        background: allPhotosCaptured ? '#DCFCE7' : '#FEF3C7',
                        color: allPhotosCaptured ? '#166534' : '#92400E',
                        border: allPhotosCaptured ? '1px solid #86EFAC' : '1px solid #FDE68A'
                      }}>
                        {allPhotosCaptured ? '✓ All 3 Photos Attached' : `${Number(Boolean(idFrontImage)) + Number(Boolean(idBackImage)) + Number(Boolean(selfieImage))}/3 Photos Attached`}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.78rem', color: '#64748B', margin: '0.35rem 0 0 0', lineHeight: 1.4 }}>
                      Provide clear photos of your Student ID (Front & Back) and capture a selfie with your camera. The server checks image format, resolution, lighting, and blur; the Registrar reviews the photos before approval.
                    </p>
                    <div style={{
                      marginTop: '0.5rem',
                      fontSize: '0.74rem',
                      color: '#0369A1',
                      background: '#F0F9FF',
                      border: '1px solid #BAE6FD',
                      borderRadius: '8px',
                      padding: '6px 10px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem'
                    }}>
                      <ShieldCheck size={14} style={{ flexShrink: 0 }} />
                      <span>
                        <strong>Image quality checks:</strong> OCR, face matching, and liveness detection are not automated yet.
                      </span>
                    </div>
                  </div>

                  {/* HIDDEN INPUTS */}
                  <input type="file" ref={fileInputRefFront} accept="image/*" style={{ display: 'none' }} onChange={e => handleFileUpload(e, 'id_front')} />
                  <input type="file" ref={cameraInputRefFront} accept="image/*" capture="environment" style={{ display: 'none' }} onChange={e => handleFileUpload(e, 'id_front')} />
                  <input type="file" ref={fileInputRefBack} accept="image/*" style={{ display: 'none' }} onChange={e => handleFileUpload(e, 'id_back')} />
                  <input type="file" ref={cameraInputRefBack} accept="image/*" capture="environment" style={{ display: 'none' }} onChange={e => handleFileUpload(e, 'id_back')} />

                  {/* 3 PHOTO CARDS GRID */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.85rem' }}>
                    {/* CARD 1: ID FRONT */}
                    <div style={{
                      background: '#FFFFFF',
                      borderRadius: '12px',
                      border: idFrontImage ? '2px solid #22C55E' : '1px dashed #CBD5E1',
                      padding: '0.85rem',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      textAlign: 'center',
                      position: 'relative'
                    }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#1E293B', marginBottom: '0.5rem' }}>
                        🪪 ID Card (Front)
                      </span>

                      {idFrontImage ? (
                        <div style={{ width: '100%', position: 'relative' }}>
                          <img
                            src={idFrontImage}
                            alt="Front of ID"
                            onClick={() => setPreviewPhotoModal({ url: idFrontImage, title: 'ID Card (Front)' })}
                            style={{
                              width: '100%',
                              height: '95px',
                              objectFit: 'cover',
                              borderRadius: '8px',
                              border: '1px solid #E2E8F0',
                              marginBottom: '0.5rem',
                              cursor: 'pointer'
                            }}
                            title="Tap to preview"
                          />
                          <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'center' }}>
                            <button
                              type="button"
                              onClick={() => triggerCameraOrModal('id_front')}
                              style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '6px', padding: '3px 7px', fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}
                            >
                              <RefreshCw size={11} /> Retake
                            </button>
                            <button
                              type="button"
                              onClick={() => setIdFrontImage('')}
                              style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '6px', padding: '3px 7px', fontSize: '0.7rem', color: '#DC2626', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}
                            >
                              <Trash2 size={11} /> Remove
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', width: '100%', margin: '0.4rem 0' }}>
                          <button
                            type="button"
                            onClick={() => triggerCameraOrModal('id_front')}
                            className="btn btn-primary"
                            style={{ fontSize: '0.75rem', padding: '0.45rem 0.6rem', width: '100%' }}
                          >
                            <Camera size={13} /> Take Photo
                          </button>
                          <button
                            type="button"
                            onClick={() => fileInputRefFront.current?.click()}
                            className="btn btn-secondary"
                            style={{ fontSize: '0.75rem', padding: '0.45rem 0.6rem', width: '100%' }}
                          >
                            <Upload size={13} /> Upload File
                          </button>
                        </div>
                      )}
                    </div>

                    {/* CARD 2: ID BACK */}
                    <div style={{
                      background: '#FFFFFF',
                      borderRadius: '12px',
                      border: idBackImage ? '2px solid #22C55E' : '1px dashed #CBD5E1',
                      padding: '0.85rem',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      textAlign: 'center',
                      position: 'relative'
                    }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#1E293B', marginBottom: '0.5rem' }}>
                        🪪 ID Card (Back)
                      </span>

                      {idBackImage ? (
                        <div style={{ width: '100%', position: 'relative' }}>
                          <img
                            src={idBackImage}
                            alt="Back of ID"
                            onClick={() => setPreviewPhotoModal({ url: idBackImage, title: 'ID Card (Back)' })}
                            style={{
                              width: '100%',
                              height: '95px',
                              objectFit: 'cover',
                              borderRadius: '8px',
                              border: '1px solid #E2E8F0',
                              marginBottom: '0.5rem',
                              cursor: 'pointer'
                            }}
                            title="Tap to preview"
                          />
                          <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'center' }}>
                            <button
                              type="button"
                              onClick={() => triggerCameraOrModal('id_back')}
                              style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '6px', padding: '3px 7px', fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}
                            >
                              <RefreshCw size={11} /> Retake
                            </button>
                            <button
                              type="button"
                              onClick={() => setIdBackImage('')}
                              style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '6px', padding: '3px 7px', fontSize: '0.7rem', color: '#DC2626', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}
                            >
                              <Trash2 size={11} /> Remove
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', width: '100%', margin: '0.4rem 0' }}>
                          <button
                            type="button"
                            onClick={() => triggerCameraOrModal('id_back')}
                            className="btn btn-primary"
                            style={{ fontSize: '0.75rem', padding: '0.45rem 0.6rem', width: '100%' }}
                          >
                            <Camera size={13} /> Take Photo
                          </button>
                          <button
                            type="button"
                            onClick={() => fileInputRefBack.current?.click()}
                            className="btn btn-secondary"
                            style={{ fontSize: '0.75rem', padding: '0.45rem 0.6rem', width: '100%' }}
                          >
                            <Upload size={13} /> Upload File
                          </button>
                        </div>
                      )}
                    </div>

                    {/* CARD 3: LIVE SELFIE */}
                    <div style={{
                      background: '#FFFFFF',
                      borderRadius: '12px',
                      border: selfieImage ? '2px solid #22C55E' : '1px dashed #CBD5E1',
                      padding: '0.85rem',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      textAlign: 'center',
                      position: 'relative'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#1E293B' }}>
                          🤳 Live Selfie
                        </span>
                        <span style={{
                          fontSize: '0.62rem',
                          fontWeight: 700,
                          background: '#EFF6FF',
                          color: 'var(--primary)',
                          padding: '1px 5px',
                          borderRadius: '4px',
                          border: '1px solid #BFDBFE'
                        }}>
                          Camera Capture
                        </span>
                      </div>

                      {selfieImage ? (
                        <div style={{ width: '100%', position: 'relative' }}>
                          <img
                            src={selfieImage}
                            alt="Student Selfie"
                            onClick={() => setPreviewPhotoModal({ url: selfieImage, title: 'Live Selfie' })}
                            style={{
                              width: '100%',
                              height: '95px',
                              objectFit: 'cover',
                              borderRadius: '8px',
                              border: '1px solid #E2E8F0',
                              marginBottom: '0.5rem',
                              cursor: 'pointer'
                            }}
                            title="Tap to preview"
                          />
                          <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'center' }}>
                            <button
                              type="button"
                              onClick={() => triggerCameraOrModal('selfie')}
                              style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '6px', padding: '3px 7px', fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}
                            >
                              <RefreshCw size={11} /> Retake
                            </button>
                            <button
                              type="button"
                              onClick={() => setSelfieImage('')}
                              style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '6px', padding: '3px 7px', fontSize: '0.7rem', color: '#DC2626', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}
                            >
                              <Trash2 size={11} /> Remove
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', width: '100%', margin: '0.4rem 0' }}>
                          <button
                            type="button"
                            onClick={() => triggerCameraOrModal('selfie')}
                            className="btn btn-primary"
                            style={{ fontSize: '0.75rem', padding: '0.55rem 0.6rem', width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}
                          >
                            <Camera size={14} /> Take Live Selfie
                          </button>
                          <span style={{ fontSize: '0.66rem', color: '#64748B', lineHeight: 1.2 }}>
                            Live camera snap required
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Step 2 Action Buttons */}
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(1)}
                    className="btn btn-secondary"
                    style={{ flex: 1, padding: '0.85rem', fontWeight: 700 }}
                  >
                    ← Back to Details
                  </button>
                  <button
                    type="submit"
                    disabled={loading || scanningActive}
                    className="btn btn-primary"
                    style={{ flex: 2, padding: '0.85rem', fontWeight: 750, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                  >
                    <Scan size={18} /> Submit Photos for Review
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>

      {/* Registration image validation status */}
      {scanningActive && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.88)',
          backdropFilter: 'blur(8px)',
          zIndex: 10000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem'
        }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: '20px',
            width: '100%',
            maxWidth: '480px',
            padding: '2rem',
            textAlign: 'center',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
            border: '1px solid rgba(255, 255, 255, 0.2)'
          }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #1E3A8A 0%, #2563EB 100%)',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.25rem auto',
              boxShadow: '0 8px 16px rgba(37, 99, 235, 0.35)'
            }}>
              <Loader2 size={32} className="spin-animation" />
            </div>

            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F172A', margin: '0 0 0.5rem 0' }}>
              Checking Registration Photos
            </h3>
            <p style={{ fontSize: '0.82rem', color: '#64748B', margin: '0 0 1.5rem 0', lineHeight: 1.5 }}>
              The server is checking image format and basic photo quality before saving your submission.
            </p>

            <div style={{ background: '#F8FAFC', borderRadius: '12px', padding: '1rem', border: '1px solid #E2E8F0', marginBottom: '1.5rem', color: '#334155', fontSize: '0.82rem' }}>
              Validating all three images before the Registrar review submission.
            </div>

            <p style={{ fontSize: '0.74rem', color: '#94A3B8', margin: 0 }}>
              Please do not close this window while verification is running.
            </p>
          </div>
        </div>
      )}

      {/* LIVE CAMERA CAPTURE MODAL VIEWPORT */}
      {cameraActiveTarget && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(6px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem'
        }}>
          <div style={{
            background: '#0F172A',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '520px',
            overflow: 'hidden',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
          }}>
            <div style={{
              padding: '1rem 1.25rem',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              color: '#F8FAFC'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Camera size={18} color="#38BDF8" />
                <span style={{ fontWeight: 800, fontSize: '0.95rem' }}>
                  {cameraActiveTarget === 'id_front'
                    ? 'Capture Front of Student ID'
                    : cameraActiveTarget === 'id_back'
                      ? 'Capture Back of Student ID'
                      : 'Capture Live Selfie'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCameraActiveTarget(null);
                  stopCamera();
                }}
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: 'none',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  color: '#FFFFFF',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ position: 'relative', width: '100%', height: '360px', background: '#000000', overflow: 'hidden' }}>
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  transform: cameraActiveTarget === 'selfie' || cameraFacingMode === 'user' ? 'scaleX(-1)' : 'none'
                }}
              />

              {/* Viewfinder Overlay Guide */}
              <div style={{
                position: 'absolute',
                top: cameraActiveTarget === 'selfie' ? '12%' : '18%',
                left: '10%',
                right: '10%',
                bottom: cameraActiveTarget === 'selfie' ? '12%' : '18%',
                border: '2px dashed rgba(56, 189, 248, 0.75)',
                borderRadius: cameraActiveTarget === 'selfie' ? '50%' : '12px',
                pointerEvents: 'none',
                boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.45)'
              }}>
                <span style={{
                  position: 'absolute',
                  bottom: '-28px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: 'rgba(15, 23, 42, 0.85)',
                  color: '#38BDF8',
                  padding: '3px 10px',
                  borderRadius: '12px',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  whiteSpace: 'nowrap'
                }}>
                  {cameraActiveTarget === 'selfie' ? 'Align face inside frame' : 'Align ID card inside edges'}
                </span>
              </div>

              {cameraError && (
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'rgba(15, 23, 42, 0.95)',
                  color: '#F87171',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '1.5rem',
                  textAlign: 'center'
                }}>
                  <AlertTriangle size={36} style={{ marginBottom: '0.75rem' }} />
                  <p style={{ margin: 0, fontSize: '0.85rem' }}>{cameraError}</p>
                </div>
              )}
            </div>

            <div style={{
              padding: '1rem 1.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#0F172A',
              borderTop: '1px solid rgba(255, 255, 255, 0.1)'
            }}>
              {cameraActiveTarget !== 'selfie' ? (
                <button
                  type="button"
                  onClick={() => setCameraFacingMode(prev => prev === 'user' ? 'environment' : 'user')}
                  style={{
                    background: 'rgba(255, 255, 255, 0.1)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '8px',
                    color: '#F8FAFC',
                    padding: '8px 12px',
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem'
                  }}
                >
                  <RefreshCw size={14} /> Flip Camera
                </button>
              ) : <div />}

              <button
                type="button"
                onClick={handleCaptureSnapshot}
                style={{
                  background: 'linear-gradient(135deg, #0284C7 0%, #0369A1 100%)',
                  border: 'none',
                  borderRadius: '24px',
                  color: '#FFFFFF',
                  padding: '10px 24px',
                  fontSize: '0.88rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  boxShadow: '0 4px 12px rgba(2, 132, 199, 0.4)'
                }}
              >
                <Camera size={16} /> Snap Photo
              </button>

              <button
                type="button"
                onClick={() => {
                  setCameraActiveTarget(null);
                  stopCamera();
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94A3B8',
                  fontSize: '0.8rem',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PHOTO PREVIEW MODAL */}
      {previewPhotoModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(6px)',
          zIndex: 10001,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem'
        }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: '16px',
            maxWidth: '560px',
            width: '100%',
            overflow: 'hidden',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.4)'
          }}>
            <div style={{
              padding: '0.85rem 1.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid #E2E8F0'
            }}>
              <span style={{ fontWeight: 800, fontSize: '0.9rem', color: '#0F172A' }}>
                {previewPhotoModal.title}
              </span>
              <button
                type="button"
                onClick={() => setPreviewPhotoModal(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}
              >
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: '1rem', textAlign: 'center', background: '#F8FAFC' }}>
              <img
                src={previewPhotoModal.url}
                alt={previewPhotoModal.title}
                style={{
                  maxWidth: '100%',
                  maxHeight: '65vh',
                  objectFit: 'contain',
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                }}
              />
            </div>
            <div style={{ padding: '0.75rem 1.25rem', textAlign: 'right', borderTop: '1px solid #E2E8F0' }}>
              <button
                type="button"
                onClick={() => setPreviewPhotoModal(null)}
                className="btn btn-secondary"
                style={{ padding: '0.45rem 1rem', fontSize: '0.8rem' }}
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
