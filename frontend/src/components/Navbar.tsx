import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import { NotificationWidget } from './NotificationWidget';
import { LogOut } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const { confirmLogout } = useUI();

  return (
    <header style={{
      background: 'rgba(15, 23, 42, 0.85)',
      backdropFilter: 'blur(16px)',
      borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
      position: 'sticky',
      top: 0,
      zIndex: 50,
      padding: '0.85rem 1.5rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: '1rem'
    }}>
      {/* Brand Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
        <img
          src="/logo.png"
          alt="Garcia College of Technology Logo"
          style={{
            width: '42px',
            height: '42px',
            objectFit: 'contain',
            filter: 'drop-shadow(0 2px 8px rgba(0, 0, 0, 0.3))'
          }}
        />
        <div>
          <h1 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#f8fafc', margin: 0, lineHeight: 1.2 }}>
            GCT Academic Hub
          </h1>
          <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: 0, fontWeight: 500 }}>
            Garcia College of Technology — Assessment & Recommendation System
          </p>
        </div>
      </div>

      {/* Role Switcher & User Profile Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        {user && <NotificationWidget role={user.role} />}
        {/* User Pill */}
        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f8fafc' }}>
                {user.full_name}
              </div>
              <span className={`badge badge-${user.role}`}>
                {user.role === 'student' ? 'Student' : 'Registrar Portal'}
              </span>
            </div>
            <button
              onClick={() => confirmLogout(logout)}
              className="btn btn-secondary btn-sm"
              title="Logout"
              style={{ padding: '0.4rem 0.6rem' }}
            >
              <LogOut size={16} />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
