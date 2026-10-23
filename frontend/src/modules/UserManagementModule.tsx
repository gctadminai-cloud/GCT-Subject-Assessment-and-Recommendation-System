import React, { useState, useEffect } from 'react';
import {
  Search,
  Plus,
  Users,
  Clock,
  BookOpen,
  School,
  Check,
  X,
  Pencil,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  CreditCard,
  Camera,
  ShieldCheck,
  Maximize2,
  Eye,
  EyeOff,
  Lock,
  User
} from 'lucide-react';
import { useRegistrarData } from './RegistrarDataContext';
import { fetchApi } from '../config/api';
import type { Student } from './types';

export const UserManagementModule: React.FC = () => {
  const {
    mockStudents,
    setMockStudents,
    staffAccounts,
    refreshStudents,
    refreshStaffAccounts,
    showToast
  } = useRegistrarData();

  const [userAccountSearch, setUserAccountSearch] = useState('');
  const [userAccountTab, setUserAccountTab] = useState<'all' | 'pending' | 'students' | 'staff'>('all');

  // Auto-fetch fresh student registrations and staff accounts on mount and tab switch
  useEffect(() => {
    refreshStudents();
    refreshStaffAccounts();
  }, [userAccountTab]);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Recently';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'Recently';
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const handleApproveRegistration = async (student: Student) => {
    if (reviewSubmitting) return false;
    setReviewSubmitting(true);
    try {
      await fetchApi(`/students/${student.student_id || student.id}/approval`, {
        method: 'PUT',
        body: JSON.stringify({ approval_status: 'approved' })
      });
      showToast(`Approved registration for ${student.name}! Student account is now active in Supabase.`, 'success');
      refreshStudents();
      return true;
    } catch (err: any) {
      console.error('Approve error:', err);
      showToast(err.message || `Failed to approve registration for ${student.name}`, 'error');
      return false;
    } finally {
      setReviewSubmitting(false);
    }
  };

  const handleRejectRegistration = async (student: Student) => {
    if (reviewSubmitting) return false;
    setReviewSubmitting(true);
    try {
      await fetchApi(`/students/${student.student_id || student.id}/approval`, {
        method: 'PUT',
        body: JSON.stringify({ approval_status: 'rejected' })
      });
      showToast(`Rejected registration for ${student.name} in Supabase`, 'error');
      refreshStudents();
      return true;
    } catch (err: any) {
      console.error('Reject error:', err);
      showToast(err.message || `Failed to reject registration for ${student.name}`, 'error');
      return false;
    } finally {
      setReviewSubmitting(false);
    }
  };

  // Photo Verification Review Modal State
  const [verificationStudent, setVerificationStudent] = useState<Student | null>(null);
  const [zoomedImage, setZoomedImage] = useState<{ url: string; title: string } | null>(null);

  // Provision Staff Account Modal State
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffUsername, setNewStaffUsername] = useState('');
  const [newStaffPassword, setNewStaffPassword] = useState('');
  const [showNewStaffPassword, setShowNewStaffPassword] = useState(false);
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffRole, setNewStaffRole] = useState<'registrar_staff' | 'registrar_admin'>('registrar_staff');
  const [provisionSubmitting, setProvisionSubmitting] = useState(false);

  // Edit / Delete Student Modal State
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [studentModalMode, setStudentModalMode] = useState<'add' | 'edit'>('edit');
  const [studentFormId, setStudentFormId] = useState('');
  const [studentFormStudentId, setStudentFormStudentId] = useState('');
  const [studentFormName, setStudentFormName] = useState('');
  const [studentFormEmail, setStudentFormEmail] = useState('');
  const [studentFormProgram, setStudentFormProgram] = useState('BSIT');
  const [studentFormYear, setStudentFormYear] = useState(1);
  const [studentFormSchedule, setStudentFormSchedule] = useState('Schedule 1');

  const [showDeleteStudentModal, setShowDeleteStudentModal] = useState(false);
  const [deletingStudent, setDeletingStudent] = useState<Student | null>(null);
  const [showDeleteStaffModal, setShowDeleteStaffModal] = useState(false);
  const [deletingStaff, setDeletingStaff] = useState<any | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);

  const handleOpenEditStudentModal = (st: Student) => {
    setStudentModalMode('edit');
    setStudentFormId(st.id);
    setStudentFormStudentId(st.student_id);
    setStudentFormName(st.name);
    setStudentFormEmail(st.email);
    setStudentFormProgram(st.program);
    setStudentFormYear(st.year);
    setStudentFormSchedule(st.schedule || 'Schedule 1');
    setShowStudentModal(true);
  };

  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (studentModalMode === 'add') {
        await fetchApi('/students', {
          method: 'POST',
          body: JSON.stringify({
            student_id: studentFormStudentId,
            full_name: studentFormName,
            email: studentFormEmail,
            program: studentFormProgram,
            year_level: Number(studentFormYear),
            schedule: studentFormSchedule
          })
        });
        showToast(`Student ${studentFormName} (${studentFormStudentId}) created in Supabase!`, 'success');
      } else {
        if (setMockStudents) {
          setMockStudents(prev => prev.map(s => {
            if (s.id === studentFormId || s.student_id === studentFormStudentId) {
              return {
                ...s,
                name: studentFormName,
                email: studentFormEmail,
                program: studentFormProgram,
                year: Number(studentFormYear),
                schedule: studentFormSchedule
              };
            }
            return s;
          }));
        }

        await fetchApi(`/students/${studentFormStudentId || studentFormId}`, {
          method: 'PUT',
          body: JSON.stringify({
            student_id: studentFormStudentId,
            full_name: studentFormName,
            email: studentFormEmail,
            program: studentFormProgram,
            year_level: Number(studentFormYear),
            schedule: studentFormSchedule
          })
        });
        showToast(`Student record for ${studentFormName} updated to Year ${studentFormYear} in Supabase!`, 'success');
      }
      if (refreshStudents) await refreshStudents();
      setShowStudentModal(false);
    } catch (err: any) {
      console.error('Save Student error:', err);
      showToast(err.message || 'Failed to save student record', 'error');
    }
  };

  const handleConfirmDeleteStaff = async () => {
    if (!deletingStaff) return;
    setIsDeletingUser(true);
    try {
      await fetchApi(`/staff/${deletingStaff.id}`, {
        method: 'DELETE'
      });
      showToast(`Staff account for ${deletingStaff.name || deletingStaff.username} deleted from Supabase.`, 'success');
      await refreshStaffAccounts();
      setShowDeleteStaffModal(false);
      setDeletingStaff(null);
    } catch (err: any) {
      console.error('Delete Staff error:', err);
      showToast(err.message || 'Failed to delete staff account from Supabase', 'error');
    } finally {
      setIsDeletingUser(false);
    }
  };

  const handleConfirmDeleteStudent = async () => {
    if (!deletingStudent) return;
    setIsDeletingUser(true);
    try {
      if (setMockStudents) {
        setMockStudents(prev => prev.filter(s => s.id !== deletingStudent.id && s.student_id !== deletingStudent.student_id));
      }
      await fetchApi(`/students/${deletingStudent.student_id || deletingStudent.id}`, {
        method: 'DELETE'
      });
      showToast(`Student user account for ${deletingStudent.student_id || deletingStudent.name} deleted from Supabase.`, 'success');
      if (refreshStudents) await refreshStudents();
      setShowDeleteStudentModal(false);
      setDeletingStudent(null);
    } catch (err: any) {
      console.error('Delete Student error:', err);
      showToast(err.message || 'Failed to delete student record from Supabase', 'error');
    } finally {
      setIsDeletingUser(false);
    }
  };

  const searchLower = userAccountSearch.toLowerCase().trim();

  const filteredStaff = staffAccounts.filter(st =>
    st.name.toLowerCase().includes(searchLower) ||
    st.email.toLowerCase().includes(searchLower) ||
    (st.username && st.username.toLowerCase().includes(searchLower))
  );

  // Only students who have actually registered/created an account are considered user accounts
  const registeredStudents = mockStudents.filter(s => s.has_account === true);

  const filteredPendingStudents = registeredStudents.filter(s =>
    s.status === 'pending' &&
    (s.name.toLowerCase().includes(searchLower) ||
      s.student_id.toLowerCase().includes(searchLower) ||
      s.email.toLowerCase().includes(searchLower) ||
      s.program.toLowerCase().includes(searchLower))
  );

  const filteredStudents = registeredStudents.filter(s =>
  (s.name.toLowerCase().includes(searchLower) ||
    s.student_id.toLowerCase().includes(searchLower) ||
    s.email.toLowerCase().includes(searchLower) ||
    s.program.toLowerCase().includes(searchLower))
  );

  const allAccountsList = [
    ...staffAccounts.map(st => ({
      id: st.id,
      displayId: st.username ? `@${st.username}` : `STAFF-${st.id.replace('staff-', '').slice(0, 5)}`,
      name: st.name,
      email: st.email,
      role: st.role || 'registrar_staff',
      program: st.role === 'registrar_admin' ? 'Administrator' : 'Registrar Staff',
      status: st.status,
      type: 'staff' as const,
      created_at: st.created_at
    })),
    ...registeredStudents.map(st => ({
      id: st.id,
      displayId: st.student_id,
      name: st.name,
      email: st.email,
      role: 'student',
      program: st.program,
      status: st.status,
      type: 'student' as const,
      created_at: st.created_at
    }))
  ];

  const filteredAllAccounts = allAccountsList.filter(acc =>
    acc.name.toLowerCase().includes(searchLower) ||
    acc.displayId.toLowerCase().includes(searchLower) ||
    acc.email.toLowerCase().includes(searchLower) ||
    acc.program.toLowerCase().includes(searchLower)
  );

  return (
    <div>
      {/* Row 1: Search bar & Provision Staff Account Button */}
      <div className="glass-card" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.65rem' }}>
          <div style={{ position: 'relative', width: '320px' }}>
            <input
              type="text"
              placeholder="Search users by name, email, or ID..."
              value={userAccountSearch}
              onChange={e => setUserAccountSearch(e.target.value)}
              className="form-input"
              style={{ paddingLeft: '2.2rem', fontSize: '0.85rem', height: '38px' }}
            />
            <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }} />
          </div>

          <button
            onClick={() => setShowAddStaffModal(true)}
            className="btn btn-primary"
            style={{
              height: '38px',
              padding: '0 0.95rem',
              fontSize: '0.85rem',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem'
            }}
          >
            <Plus size={16} /> Provision Staff Account
          </button>
        </div>
      </div>

      {/* Row 2: Tab Bar (All Accounts, Pending Approvals, Students, Registrar Officers) */}
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.25rem' }}>
        <div style={{ display: 'inline-flex', background: '#EFF6FF', padding: '4px', borderRadius: '12px', border: '1px solid var(--border-color)', flexWrap: 'wrap', gap: '4px' }}>
          <button
            onClick={() => setUserAccountTab('all')}
            style={{
              padding: '0.55rem 1.15rem',
              borderRadius: '8px',
              border: 'none',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              background: userAccountTab === 'all' ? '#FFFFFF' : 'transparent',
              color: userAccountTab === 'all' ? 'var(--primary)' : 'var(--text-muted)',
              boxShadow: userAccountTab === 'all' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
              transition: 'all 0.2s ease'
            }}
          >
            <Users size={16} />
            All Accounts ({filteredAllAccounts.length})
          </button>
          <button
            onClick={() => setUserAccountTab('pending')}
            style={{
              padding: '0.55rem 1.15rem',
              borderRadius: '8px',
              border: 'none',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              background: userAccountTab === 'pending' ? '#FFFFFF' : 'transparent',
              color: userAccountTab === 'pending' ? 'var(--primary)' : 'var(--text-muted)',
              boxShadow: userAccountTab === 'pending' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
              transition: 'all 0.2s ease'
            }}
          >
            <Clock size={16} />
            Pending Approvals ({filteredPendingStudents.length})
          </button>
          <button
            onClick={() => setUserAccountTab('students')}
            style={{
              padding: '0.55rem 1.15rem',
              borderRadius: '8px',
              border: 'none',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              background: userAccountTab === 'students' ? '#FFFFFF' : 'transparent',
              color: userAccountTab === 'students' ? 'var(--primary)' : 'var(--text-muted)',
              boxShadow: userAccountTab === 'students' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
              transition: 'all 0.2s ease'
            }}
          >
            <BookOpen size={16} />
            Students ({filteredStudents.length})
          </button>
          <button
            onClick={() => setUserAccountTab('staff')}
            style={{
              padding: '0.55rem 1.15rem',
              borderRadius: '8px',
              border: 'none',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              background: userAccountTab === 'staff' ? '#FFFFFF' : 'transparent',
              color: userAccountTab === 'staff' ? 'var(--primary)' : 'var(--text-muted)',
              boxShadow: userAccountTab === 'staff' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
              transition: 'all 0.2s ease'
            }}
          >
            <School size={16} />
            Registrar Officers ({filteredStaff.length})
          </button>
        </div>
      </div>

      {/* Row 3: Tab Content */}

      {/* TAB 1: ALL ACCOUNTS */}
      {userAccountTab === 'all' && (
        <div className="glass-card" style={{ padding: '1.35rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
              All User Accounts ({filteredAllAccounts.length})
            </h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Combined directory of registrar staff & student accounts
            </span>
          </div>

          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>User ID / Student ID</th>
                  <th>Full Name</th>
                  <th>Email</th>
                  <th>Role / Program</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredAllAccounts.map(account => (
                  <tr key={account.id}>
                    <td style={{ fontWeight: 800, color: account.type === 'staff' ? 'var(--text-main)' : 'var(--primary)' }}>
                      {account.displayId}
                    </td>
                    <td style={{ fontWeight: 700, color: 'var(--text-main)' }}>{account.name}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{account.email}</td>
                    <td>
                      {account.type === 'staff' ? (
                        <span className={`badge ${account.role === 'registrar_admin' ? 'badge-primary' : 'badge-registrar_staff'}`}>
                          {account.role === 'registrar_admin' ? 'Administrator' : 'Registrar Staff'}
                        </span>
                      ) : (
                        <span className={`badge badge-${account.program}`}>Student ({account.program})</span>
                      )}
                    </td>
                    <td>
                      <span className={`badge badge-${account.status === 'active' || account.status === 'approved' ? 'passed' : account.status === 'pending' ? 'pending' : 'failed'}`}>
                        {account.status === 'active' || account.status === 'approved' ? 'Active' : account.status === 'pending' ? 'Pending' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      {account.type === 'staff' ? (
                        (account.role === 'registrar_admin' || account.name?.toLowerCase().includes('administrator') || account.displayId === '@admin') ? (
                          <span
                            style={{
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              color: '#1E40AF',
                              background: '#EFF6FF',
                              border: '1px solid #BFDBFE',
                              padding: '3px 8px',
                              borderRadius: '6px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem'
                            }}
                            title="System Administrator account cannot be deleted or deactivated"
                          >
                            <ShieldCheck size={12} color="#2563EB" /> Protected
                          </span>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <button
                              onClick={async () => {
                                const newStatus = account.status === 'active' ? 'inactive' : 'active';
                                try {
                                  await fetchApi(`/staff/${account.id}/status`, {
                                    method: 'PUT',
                                    body: JSON.stringify({ status: newStatus })
                                  });
                                  showToast(`Staff account for ${account.name} ${newStatus === 'active' ? 'activated' : 'deactivated'} in Supabase`, 'info');
                                  refreshStaffAccounts();
                                } catch (err: any) {
                                  console.error('Staff status update error:', err);
                                  showToast(err.message || 'Failed to update staff status', 'error');
                                }
                              }}
                              className={`btn btn-sm ${account.status === 'active' ? 'btn-secondary' : 'btn-success'}`}
                            >
                              {account.status === 'active' ? 'Deactivate' : 'Activate'}
                            </button>
                            <button
                              onClick={() => {
                                setDeletingStaff({
                                  id: account.id,
                                  name: account.name,
                                  username: account.displayId.replace(/^@/, ''),
                                  email: account.email,
                                  role: account.role
                                });
                                setShowDeleteStaffModal(true);
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
                              title="Delete staff account from Supabase"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        )
                      ) : account.status === 'pending' ? (
                        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                          <button
                            onClick={() => {
                              const originalStudent = mockStudents.find(s => s.id === account.id || s.student_id === account.displayId) || {
                                id: account.id,
                                student_id: account.displayId,
                                name: account.name,
                                email: account.email,
                                program: account.program,
                                year: 1,
                                section: 'A',
                                status: 'pending' as const
                              };
                              setVerificationStudent(originalStudent);
                            }}
                            className="btn btn-primary btn-sm"
                          >
                            <Eye size={14} /> Review
                          </button>
                          <button
                            onClick={() => {
                              const originalStudent = mockStudents.find(s => s.id === account.id || s.student_id === account.displayId) || {
                                id: account.id,
                                student_id: account.displayId,
                                name: account.name,
                                email: account.email,
                                program: account.program,
                                year: 1,
                                section: 'A',
                                status: 'pending'
                              };
                              setDeletingStudent(originalStudent);
                              setShowDeleteStudentModal(true);
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
                            title="Delete pending registration from Supabase"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <button
                            onClick={() => {
                              const originalStudent = mockStudents.find(s => s.id === account.id || s.student_id === account.displayId);
                              if (originalStudent) handleOpenEditStudentModal(originalStudent);
                            }}
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
                            title="Edit student account"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            onClick={() => {
                              const originalStudent = mockStudents.find(s => s.id === account.id || s.student_id === account.displayId) || {
                                id: account.id,
                                student_id: account.displayId,
                                name: account.name,
                                email: account.email,
                                program: account.program,
                                year: 1,
                                section: 'A',
                                status: 'approved'
                              };
                              setDeletingStudent(originalStudent);
                              setShowDeleteStudentModal(true);
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
                            title="Delete student account from Supabase"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredAllAccounts.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                      No user accounts found matching search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: PENDING APPROVALS */}
      {userAccountTab === 'pending' && (
        <div className="glass-card" style={{ padding: '1.35rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
              Pending Student Registration Approvals ({filteredPendingStudents.length})
            </h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Review and authorize new student registration submissions
            </span>
          </div>

          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Student ID</th>
                  <th>Full Name</th>
                  <th>Email</th>
                  <th>Program</th>
                  <th>Year Level</th>
                  <th>Verification Photos</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredPendingStudents.map(student => {
                  const photoCount = Number(Boolean(student.id_front_image)) + Number(Boolean(student.id_back_image)) + Number(Boolean(student.selfie_image));
                  return (
                    <tr key={student.id}>
                      <td style={{ fontWeight: 800, color: 'var(--primary)' }}>{student.student_id}</td>
                      <td style={{ fontWeight: 700, color: 'var(--text-main)' }}>{student.name}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{student.email}</td>
                      <td><span className={`badge badge-${student.program}`}>{student.program}</span></td>
                      <td>Year {student.year}</td>
                      <td>
                        <button
                          type="button"
                          onClick={() => setVerificationStudent(student)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            background: photoCount > 0 ? '#EFF6FF' : '#FEF3C7',
                            color: photoCount > 0 ? 'var(--primary)' : '#92400E',
                            border: photoCount > 0 ? '1px solid #BFDBFE' : '1px solid #FDE68A',
                            padding: '0.35rem 0.75rem',
                            borderRadius: '8px',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.background = photoCount > 0 ? '#DBEAFE' : '#FDE68A';
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.background = photoCount > 0 ? '#EFF6FF' : '#FEF3C7';
                          }}
                        >
                          <CreditCard size={14} />
                          <span>Review info & photos</span>
                          <span style={{
                            fontSize: '0.7rem',
                            background: photoCount === 3 ? '#22C55E' : photoCount > 0 ? '#3B82F6' : '#E2E8F0',
                            color: '#FFFFFF',
                            padding: '1px 5px',
                            borderRadius: '10px',
                            fontWeight: 800
                          }}>
                            {photoCount}/3
                          </span>
                        </button>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'center' }}>
                          <button
                            onClick={() => {
                              setDeletingStudent(student);
                              setShowDeleteStudentModal(true);
                            }}
                            className="btn btn-danger btn-sm"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              background: '#DC2626',
                              borderColor: '#DC2626',
                              color: '#FFFFFF'
                            }}
                            title="Delete pending registration permanently from Supabase"
                          >
                            <Trash2 size={14} /> Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredPendingStudents.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)' }}>
                      <CheckCircle2 size={32} color="#15803D" style={{ marginBottom: '0.5rem', opacity: 0.7 }} />
                      <p style={{ fontWeight: 700, margin: 0 }}>No pending student registrations!</p>
                      <span style={{ fontSize: '0.8rem' }}>All student accounts are currently reviewed and approved.</span>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: STUDENTS */}
      {userAccountTab === 'students' && (
        <div className="glass-card" style={{ padding: '1.35rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
              Student Accounts ({filteredStudents.length})
            </h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Enrolled student user profiles
            </span>
          </div>

          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Student ID</th>
                  <th>Full Name</th>
                  <th>Email</th>
                  <th>Program</th>
                  <th>Status</th>
                  <th>Date Registered</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map(st => (
                  <tr key={st.id}>
                    <td style={{ fontWeight: 800, color: 'var(--primary)' }}>{st.student_id}</td>
                    <td style={{ fontWeight: 700, color: 'var(--text-main)' }}>{st.name}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{st.email}</td>
                    <td><span className={`badge badge-${st.program}`}>{st.program}</span></td>
                    <td>
                      <span className={`badge badge-${st.status === 'approved' ? 'passed' : 'pending'}`}>
                        {st.status === 'approved' ? 'Active' : 'Pending'}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                      {formatDate(st.created_at)}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <button
                          onClick={() => handleOpenEditStudentModal(st)}
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
                          title="Edit student account"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => {
                            setDeletingStudent(st);
                            setShowDeleteStudentModal(true);
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
                          title="Delete student account"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredStudents.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)' }}>
                      {registeredStudents.length === 0
                        ? 'No registered student accounts yet. Student accounts will appear here once students create their accounts.'
                        : 'No student accounts found matching search.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: REGISTRAR OFFICERS */}
      {userAccountTab === 'staff' && (
        <div className="glass-card" style={{ padding: '1.35rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
              Registrar Officers ({filteredStaff.length})
            </h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Authorized institutional staff members
            </span>
          </div>

          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Full Name</th>
                  <th>Username</th>
                  <th>Email Address</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredStaff.map(st => (
                  <tr key={st.id}>
                    <td style={{ fontWeight: 700, color: 'var(--text-main)' }}>{st.name}</td>
                    <td style={{ fontWeight: 600, color: '#2563EB' }}>{st.username || st.email.split('@')[0]}</td>
                    <td style={{ color: 'var(--text-muted)', fontWeight: 500 }}>{st.email}</td>
                    <td>
                      <span className={`badge ${st.role === 'registrar_admin' ? 'badge-primary' : 'badge-registrar_staff'}`}>
                        {st.role === 'registrar_admin' ? 'Administrator' : 'Registrar Staff'}
                      </span>
                    </td>
                    <td>
                      <span className={`badge badge-${st.status === 'active' ? 'passed' : 'failed'}`}>
                        {st.status === 'active' ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      {(st.role === 'registrar_admin' || st.name?.toLowerCase().includes('administrator') || st.username === 'admin') ? (
                        <span
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            color: '#1E40AF',
                            background: '#EFF6FF',
                            border: '1px solid #BFDBFE',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem'
                          }}
                          title="System Administrator account cannot be deleted or deactivated"
                        >
                          <ShieldCheck size={12} color="#2563EB" /> Protected
                        </span>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <button
                            onClick={async () => {
                              const newStatus = st.status === 'active' ? 'inactive' : 'active';
                              try {
                                await fetchApi(`/staff/${st.id}/status`, {
                                  method: 'PUT',
                                  body: JSON.stringify({ status: newStatus })
                                });
                                showToast(`Staff account for ${st.name} ${newStatus === 'active' ? 'activated' : 'deactivated'} in Supabase`, 'info');
                                refreshStaffAccounts();
                              } catch (err: any) {
                                console.error('Staff status toggle error:', err);
                                showToast(err.message || 'Failed to update staff status', 'error');
                              }
                            }}
                            className={`btn btn-sm ${st.status === 'active' ? 'btn-secondary' : 'btn-success'}`}
                          >
                            {st.status === 'active' ? 'Deactivate' : 'Activate'}
                          </button>
                          <button
                            onClick={() => {
                              setDeletingStaff(st);
                              setShowDeleteStaffModal(true);
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
                            title="Delete staff account from Supabase"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredStaff.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                      No registrar officers found matching search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: PROVISION STAFF ACCOUNT */}
      {showAddStaffModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(45, 38, 30, 0.45)',
          backdropFilter: 'blur(5px)',
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem'
        }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '480px', padding: '2rem', background: '#FFFFFF', boxShadow: 'var(--shadow-elevated)', borderRadius: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                  Provision Registrar Staff Account
                </h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0.2rem 0 0' }}>
                  Set the credentials that the staff member will use to sign in.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddStaffModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!newStaffName.trim()) {
                showToast('Please enter the staff member\'s full name.', 'error');
                return;
              }
              if (!newStaffUsername.trim()) {
                showToast('Please enter a username for the staff member.', 'error');
                return;
              }
              if (!newStaffPassword.trim()) {
                showToast('Please set a password for the staff member.', 'error');
                return;
              }

              setProvisionSubmitting(true);
              try {
                const cleanUser = newStaffUsername.trim().toLowerCase();
                const emailValue = newStaffEmail.trim() || `${cleanUser}@gct.edu.ph`;
                await fetchApi('/staff', {
                  method: 'POST',
                  body: JSON.stringify({
                    full_name: newStaffName.trim(),
                    username: cleanUser,
                    password: newStaffPassword,
                    email: emailValue,
                    role: newStaffRole
                  })
                });
                showToast(`Staff account for ${newStaffName} created! Username: ${cleanUser}`, 'success');
                await refreshStaffAccounts();
                setShowAddStaffModal(false);
                setNewStaffName('');
                setNewStaffUsername('');
                setNewStaffPassword('');
                setNewStaffEmail('');
                setNewStaffRole('registrar_staff');
              } catch (err: any) {
                console.error('Provision staff error:', err);
                showToast(err.message || 'Failed to provision staff account in Supabase', 'error');
              } finally {
                setProvisionSubmitting(false);
              }
            }}>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 700 }}>Full Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Maria Clara Santos"
                  value={newStaffName}
                  onChange={e => setNewStaffName(e.target.value)}
                  className="form-input"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 700 }}>Login Username *</label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input
                    type="text"
                    placeholder="e.g. maria_santos"
                    value={newStaffUsername}
                    onChange={e => {
                      const val = e.target.value.toLowerCase().replace(/\s+/g, '_');
                      setNewStaffUsername(val);
                      if (!newStaffEmail || newStaffEmail.endsWith('@gct.edu.ph')) {
                        setNewStaffEmail(`${val}@gct.edu.ph`);
                      }
                    }}
                    className="form-input"
                    style={{ paddingLeft: '2.2rem' }}
                    required
                  />
                  <User size={15} color="var(--text-muted)" style={{ position: 'absolute', left: '0.75rem' }} />
                </div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.25rem' }}>
                  Staff member enters this username to log in to the dashboard.
                </span>
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 700 }}>Login Password *</label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input
                    type={showNewStaffPassword ? 'text' : 'password'}
                    placeholder="Enter staff login password"
                    value={newStaffPassword}
                    onChange={e => setNewStaffPassword(e.target.value)}
                    className="form-input"
                    style={{ paddingLeft: '2.2rem', paddingRight: '2.5rem', width: '100%' }}
                    required
                  />
                  <Lock size={15} color="var(--text-muted)" style={{ position: 'absolute', left: '0.75rem' }} />
                  <button
                    type="button"
                    onClick={() => setShowNewStaffPassword(!showNewStaffPassword)}
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
                    title={showNewStaffPassword ? 'Hide password' : 'Show password'}
                  >
                    {showNewStaffPassword ? <Eye size={16} /> : <EyeOff size={16} />}
                  </button>
                </div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.25rem' }}>
                  The password set here will be required when the staff logs in.
                </span>
              </div>

              <div className="form-group">
                <label className="form-label">Email Address (Optional)</label>
                <input
                  type="email"
                  placeholder="e.g. maria_santos@gct.edu.ph"
                  value={newStaffEmail}
                  onChange={e => setNewStaffEmail(e.target.value)}
                  className="form-input"
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label className="form-label">Account Role</label>
                <select
                  value={newStaffRole}
                  onChange={e => setNewStaffRole(e.target.value as any)}
                  className="form-select"
                >
                  <option value="registrar_staff">Registrar Staff (Student & Grade Ops)</option>
                  <option value="registrar_admin">System Administrator (Full Governance)</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowAddStaffModal(false)}
                  className="btn btn-secondary"
                  disabled={provisionSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={provisionSubmitting}
                >
                  {provisionSubmitting ? 'Provisioning...' : 'Provision Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT STUDENT MODAL */}
      {showStudentModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(45, 38, 30, 0.4)',
          backdropFilter: 'blur(4px)',
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem'
        }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '520px', padding: '2rem', background: '#FFFFFF', boxShadow: 'var(--shadow-elevated)', borderRadius: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)', margin: 0, textAlign: 'center' }}>
                {studentModalMode === 'add' ? 'Register New Student' : 'Edit Student Profile'}
              </h3>
            </div>

            <form onSubmit={handleSaveStudent}>
              <div className="form-group">
                <label className="form-label">Student ID</label>
                <input
                  type="text"
                  value={studentFormStudentId}
                  onChange={e => setStudentFormStudentId(e.target.value)}
                  className="form-input"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input
                  type="text"
                  placeholder="Enter student full name"
                  value={studentFormName}
                  onChange={e => setStudentFormName(e.target.value)}
                  className="form-input"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input
                  type="email"
                  placeholder="student@gct.edu.ph"
                  value={studentFormEmail}
                  onChange={e => setStudentFormEmail(e.target.value)}
                  className="form-input"
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.5rem' }}>
                <div className="form-group">
                  <label className="form-label">Program</label>
                  <select
                    value={studentFormProgram}
                    onChange={e => setStudentFormProgram(e.target.value)}
                    className="form-select"
                  >
                    <option value="BSIT">BSIT</option>
                    <option value="BSCS">BSCS</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Year Level</label>
                  <select
                    value={studentFormYear}
                    onChange={e => setStudentFormYear(Number(e.target.value))}
                    className="form-select"
                  >
                    <option value={1}>1st Year</option>
                    <option value={2}>2nd Year</option>
                    <option value={3}>3rd Year</option>
                    <option value={4}>4th Year</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowStudentModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {studentModalMode === 'add' ? 'Create Student' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DELETE STUDENT CONFIRMATION */}
      {showDeleteStudentModal && deletingStudent && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(45, 38, 30, 0.4)',
          backdropFilter: 'blur(4px)',
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem'
        }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '460px', padding: '2rem', background: '#FFFFFF', boxShadow: 'var(--shadow-elevated)', borderRadius: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', color: 'var(--danger)' }}>
              <AlertTriangle size={24} />
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: 'var(--danger)' }}>
                Delete Student User Account
              </h3>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem', lineHeight: 1.5 }}>
              Are you sure you want to delete the user account for <strong style={{ color: 'var(--text-main)' }}>{deletingStudent.name}</strong> ({deletingStudent.student_id})? Their login account and credentials will be removed from Supabase.
            </p>
            <div style={{
              background: '#F0FDF4',
              border: '1px solid #86EFAC',
              borderRadius: '8px',
              padding: '0.65rem 0.85rem',
              marginBottom: '1.5rem',
              fontSize: '0.78rem',
              color: '#166534',
              lineHeight: 1.4
            }}>
              ✓ <strong>Protected:</strong> Official academic grades, transcripts, and curriculum history are permanently preserved in the Registrar database and will NOT be erased.
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowDeleteStudentModal(false)} className="btn btn-secondary" disabled={isDeletingUser}>
                Cancel
              </button>
              <button onClick={handleConfirmDeleteStudent} className="btn btn-danger" disabled={isDeletingUser}>
                {isDeletingUser ? 'Deleting...' : 'Delete Account'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DELETE STAFF CONFIRMATION */}
      {showDeleteStaffModal && deletingStaff && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(45, 38, 30, 0.4)',
          backdropFilter: 'blur(4px)',
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem'
        }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '460px', padding: '2rem', background: '#FFFFFF', boxShadow: 'var(--shadow-elevated)', borderRadius: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', color: 'var(--danger)' }}>
              <AlertTriangle size={24} />
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: 'var(--danger)' }}>
                Delete Staff Account
              </h3>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem', lineHeight: 1.5 }}>
              Are you sure you want to permanently delete the registrar staff account for <strong style={{ color: 'var(--text-main)' }}>{deletingStaff.name || deletingStaff.username}</strong> ({deletingStaff.email || deletingStaff.username})?
            </p>
            <div style={{
              background: '#FEF2F2',
              border: '1px solid #FCA5A5',
              borderRadius: '8px',
              padding: '0.65rem 0.85rem',
              marginBottom: '1.5rem',
              fontSize: '0.78rem',
              color: '#991B1B',
              lineHeight: 1.4
            }}>
              ⚠️ <strong>Warning:</strong> This staff member will no longer be able to log in to the Registrar portal. All authentication credentials will be permanently erased from Supabase.
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowDeleteStaffModal(false)} className="btn btn-secondary" disabled={isDeletingUser}>
                Cancel
              </button>
              <button onClick={handleConfirmDeleteStaff} className="btn btn-danger" disabled={isDeletingUser}>
                {isDeletingUser ? 'Deleting...' : 'Delete Staff'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: STUDENT ID & SELFIE VERIFICATION PHOTO REVIEW MODAL */}
      {verificationStudent && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(6px)',
          zIndex: 9990,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem'
        }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '860px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
            border: '1px solid #E2E8F0'
          }}>
            {/* Header */}
            <div style={{
              padding: '1.2rem 1.5rem',
              background: 'linear-gradient(135deg, #1E3A8A 0%, #2563EB 100%)',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  padding: '0.45rem',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <ShieldCheck size={22} color="#FBBF24" />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, lineHeight: 1.2 }}>
                    Student Identity & Photo Verification Review
                  </h3>
                  <span style={{ fontSize: '0.78rem', color: '#DBEAFE' }}>
                    Review official student ID documents and live face selfie before authorization
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setVerificationStudent(null)}
                disabled={reviewSubmitting}
                style={{
                  background: 'rgba(255, 255, 255, 0.15)',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#FFFFFF',
                  padding: '6px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Student Info Summary Banner */}
            <div style={{
              background: '#F8FAFC',
              borderBottom: '1px solid #E2E8F0',
              padding: '0.9rem 1.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '0.75rem',
              flexShrink: 0
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '1rem', fontWeight: 800, color: '#0F172A' }}>
                  {verificationStudent.name}
                </span>
                <span style={{
                  background: '#EFF6FF',
                  color: 'var(--primary)',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: '6px',
                  border: '1px solid #BFDBFE'
                }}>
                  ID: {verificationStudent.student_id}
                </span>
                <span className={`badge badge-${verificationStudent.program}`}>
                  {verificationStudent.program}
                </span>
                <span style={{ fontSize: '0.8rem', color: '#475569', fontWeight: 600 }}>
                  Year {verificationStudent.year}
                </span>
              </div>

              <div style={{ fontSize: '0.8rem', color: '#64748B' }}>
                Email: <strong style={{ color: '#0F172A' }}>{verificationStudent.email}</strong>
              </div>
            </div>

            {/* Photos Grid Scrollable Body */}
            <div style={{
              flex: 1,
              padding: '1.25rem 1.5rem',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem'
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>

                {/* 1. FRONT ID PHOTO CARD */}
                <div style={{
                  background: '#FFFFFF',
                  borderRadius: '12px',
                  border: '1px solid #CBD5E1',
                  overflow: 'hidden',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                  display: 'flex',
                  flexDirection: 'column'
                }}>
                  <div style={{
                    padding: '0.65rem 0.95rem',
                    background: '#F1F5F9',
                    borderBottom: '1px solid #E2E8F0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#1E293B' }}>
                      🪪 Student ID (Front)
                    </span>
                    {verificationStudent.id_front_image && (
                      <button
                        onClick={() => setZoomedImage({ url: verificationStudent.id_front_image!, title: `${verificationStudent.name} - ID (Front)` })}
                        style={{
                          background: '#EFF6FF',
                          border: '1px solid #BFDBFE',
                          borderRadius: '6px',
                          padding: '2px 7px',
                          fontSize: '0.7rem',
                          color: 'var(--primary)',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.2rem'
                        }}
                      >
                        <Maximize2 size={11} /> Zoom
                      </button>
                    )}
                  </div>
                  <div style={{
                    padding: '0.85rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: '170px',
                    background: '#FAFAFA'
                  }}>
                    {verificationStudent.id_front_image ? (
                      <img
                        src={verificationStudent.id_front_image}
                        alt="Front ID"
                        onClick={() => setZoomedImage({ url: verificationStudent.id_front_image!, title: `${verificationStudent.name} - ID (Front)` })}
                        style={{
                          maxWidth: '100%',
                          maxHeight: '180px',
                          objectFit: 'contain',
                          borderRadius: '8px',
                          border: '1px solid #E2E8F0',
                          cursor: 'zoom-in'
                        }}
                      />
                    ) : (
                      <div style={{ textAlign: 'center', color: '#94A3B8', fontSize: '0.82rem' }}>
                        <CreditCard size={32} style={{ marginBottom: '0.4rem', opacity: 0.5 }} />
                        <p style={{ margin: 0 }}>No Front ID Photo Provided</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. BACK ID PHOTO CARD */}
                <div style={{
                  background: '#FFFFFF',
                  borderRadius: '12px',
                  border: '1px solid #CBD5E1',
                  overflow: 'hidden',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                  display: 'flex',
                  flexDirection: 'column'
                }}>
                  <div style={{
                    padding: '0.65rem 0.95rem',
                    background: '#F1F5F9',
                    borderBottom: '1px solid #E2E8F0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#1E293B' }}>
                      🪪 Student ID (Back)
                    </span>
                    {verificationStudent.id_back_image && (
                      <button
                        onClick={() => setZoomedImage({ url: verificationStudent.id_back_image!, title: `${verificationStudent.name} - ID (Back)` })}
                        style={{
                          background: '#EFF6FF',
                          border: '1px solid #BFDBFE',
                          borderRadius: '6px',
                          padding: '2px 7px',
                          fontSize: '0.7rem',
                          color: 'var(--primary)',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.2rem'
                        }}
                      >
                        <Maximize2 size={11} /> Zoom
                      </button>
                    )}
                  </div>
                  <div style={{
                    padding: '0.85rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: '170px',
                    background: '#FAFAFA'
                  }}>
                    {verificationStudent.id_back_image ? (
                      <img
                        src={verificationStudent.id_back_image}
                        alt="Back ID"
                        onClick={() => setZoomedImage({ url: verificationStudent.id_back_image!, title: `${verificationStudent.name} - ID (Back)` })}
                        style={{
                          maxWidth: '100%',
                          maxHeight: '180px',
                          objectFit: 'contain',
                          borderRadius: '8px',
                          border: '1px solid #E2E8F0',
                          cursor: 'zoom-in'
                        }}
                      />
                    ) : (
                      <div style={{ textAlign: 'center', color: '#94A3B8', fontSize: '0.82rem' }}>
                        <CreditCard size={32} style={{ marginBottom: '0.4rem', opacity: 0.5 }} />
                        <p style={{ margin: 0 }}>No Back ID Photo Provided</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* 3. STUDENT SELFIE PHOTO CARD */}
                <div style={{
                  background: '#FFFFFF',
                  borderRadius: '12px',
                  border: '1px solid #CBD5E1',
                  overflow: 'hidden',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                  display: 'flex',
                  flexDirection: 'column'
                }}>
                  <div style={{
                    padding: '0.65rem 0.95rem',
                    background: '#F1F5F9',
                    borderBottom: '1px solid #E2E8F0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#1E293B' }}>
                      🤳 Live Face Selfie
                    </span>
                    {verificationStudent.selfie_image && (
                      <button
                        onClick={() => setZoomedImage({ url: verificationStudent.selfie_image!, title: `${verificationStudent.name} - Face Selfie` })}
                        style={{
                          background: '#EFF6FF',
                          border: '1px solid #BFDBFE',
                          borderRadius: '6px',
                          padding: '2px 7px',
                          fontSize: '0.7rem',
                          color: 'var(--primary)',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.2rem'
                        }}
                      >
                        <Maximize2 size={11} /> Zoom
                      </button>
                    )}
                  </div>
                  <div style={{
                    padding: '0.85rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: '170px',
                    background: '#FAFAFA'
                  }}>
                    {verificationStudent.selfie_image ? (
                      <img
                        src={verificationStudent.selfie_image}
                        alt="Selfie"
                        onClick={() => setZoomedImage({ url: verificationStudent.selfie_image!, title: `${verificationStudent.name} - Face Selfie` })}
                        style={{
                          maxWidth: '100%',
                          maxHeight: '180px',
                          objectFit: 'contain',
                          borderRadius: '8px',
                          border: '1px solid #E2E8F0',
                          cursor: 'zoom-in'
                        }}
                      />
                    ) : (
                      <div style={{ textAlign: 'center', color: '#94A3B8', fontSize: '0.82rem' }}>
                        <Camera size={32} style={{ marginBottom: '0.4rem', opacity: 0.5 }} />
                        <p style={{ margin: 0 }}>No Selfie Photo Provided</p>
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </div>

            {/* Action Footer */}
            <div style={{
              padding: '1rem 1.5rem',
              borderTop: '1px solid #E2E8F0',
              background: '#F8FAFC',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.85rem',
              flexShrink: 0
            }}>
              <button
                type="button"
                disabled={reviewSubmitting}
                onClick={async () => {
                  if (await handleRejectRegistration(verificationStudent)) setVerificationStudent(null);
                }}
                className="btn btn-danger"
                style={{ padding: '1rem 0.25rem', fontSize: '0.85rem', flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', fontWeight: 700 }}
              >
                <X size={15} /> {reviewSubmitting ? 'Processing...' : 'Reject Registration'}
              </button>

              <button
                type="button"
                disabled={reviewSubmitting}
                onClick={async () => {
                  if (await handleApproveRegistration(verificationStudent)) setVerificationStudent(null);
                }}
                className="btn btn-success"
                style={{ padding: '1rem 0.25rem', fontSize: '0.85rem', flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', fontWeight: 800 }}
              >
                <Check size={16} /> {reviewSubmitting ? 'Processing...' : 'Authorize & Approve Student'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FULLSCREEN PHOTO LIGHTBOX / ZOOM MODAL */}
      {zoomedImage && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.92)',
          zIndex: 99999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem'
        }}>
          <div style={{
            position: 'absolute',
            top: '1rem',
            right: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem'
          }}>
            <span style={{ color: '#F8FAFC', fontWeight: 700, fontSize: '0.9rem' }}>
              {zoomedImage.title}
            </span>
            <button
              onClick={() => setZoomedImage(null)}
              style={{
                background: 'rgba(255, 255, 255, 0.2)',
                border: 'none',
                borderRadius: '8px',
                color: '#FFFFFF',
                padding: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <X size={22} />
            </button>
          </div>
          <img
            src={zoomedImage.url}
            alt={zoomedImage.title}
            style={{
              maxWidth: '90vw',
              maxHeight: '85vh',
              objectFit: 'contain',
              borderRadius: '10px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.8)'
            }}
          />
        </div>
      )}
    </div>
  );
};
