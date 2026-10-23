import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import { Clock, LogOut } from 'lucide-react';

export const PendingApprovalPage: React.FC = () => {
  const { user, logout } = useAuth();
  const { confirmLogout } = useUI();

  return (
    <div style={{
      minHeight: '80vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem 1rem'
    }}>
      <div className="glass-card" style={{ width: '100%', maxWidth: '500px', padding: '2.5rem', textAlign: 'center' }}>
        <Clock size={54} color="#fbbf24" style={{ marginBottom: '1.25rem' }} />

        <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#f8fafc', marginBottom: '0.5rem' }}>
          Registration Pending Approval
        </h2>

        <p style={{ color: '#94a3b8', fontSize: '0.9rem', lineHeight: 1.5, marginBottom: '1.5rem' }}>
          Hello <strong>{user?.full_name}</strong>. Your student registration account has been successfully received by Garcia College of Technology.
          <br /><br />
          Per institutional policy, your account must be verified and approved by the <strong>Admin or Registrar Staff</strong> member before you can access your grade dashboard.
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem' }}>
          <button onClick={() => confirmLogout(logout)} className="btn btn-secondary">
            <LogOut size={16} /> Sign Out
          </button>
        </div>
      </div>
    </div>
  );
};
