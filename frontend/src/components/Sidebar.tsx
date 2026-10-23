import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  Users,
  BookOpen,
  GraduationCap,
  BookPlus,
  Sparkles,
  Bot,
  LogOut,
  Pin,
  ChevronRight,
  Menu
} from 'lucide-react';

import { useUI } from '../context/UIContext';

interface SidebarProps {
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab = 'home', onTabChange }) => {
  const { user, logout } = useAuth();
  const { confirmLogout } = useUI();
  const [isHovered, setIsHovered] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  if (!user) return null;

  const isExpanded = isPinned || isHovered;

  return (
    <>
      {/* Mobile Drawer Toggle */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        style={{
          display: 'none',
          position: 'fixed',
          top: '1rem',
          left: '1rem',
          zIndex: 90,
          background: '#FFFFFF',
          border: '1px solid var(--border-color)',
          color: 'var(--text-main)',
          borderRadius: '8px',
          padding: '0.5rem',
          cursor: 'pointer'
        }}
        className="mobile-toggle-btn"
      >
        <Menu size={20} />
      </button>

      {/* Hover Sensor Trigger Zone on Left Edge */}
      <div
        onMouseEnter={() => setIsHovered(true)}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          width: '16px',
          zIndex: 45,
          cursor: 'pointer'
        }}
      />

      {/* Slide Navigation Sidebar (Light Beige + Terracotta Active Pill) */}
      <aside
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          width: isExpanded ? '270px' : '64px',
          minWidth: isExpanded ? '270px' : '64px',
          height: '100vh',
          position: 'sticky',
          top: 0,
          background: 'var(--bg-sidebar)',
          borderRight: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          zIndex: 50,
          transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1), min-width 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          padding: isExpanded ? '1.25rem 1rem' : '1.25rem 0.5rem',
          boxShadow: isExpanded ? '6px 0 24px rgba(37, 99, 235, 0.12)' : 'none',
          overflowX: 'hidden'
        }}
        className={`sidebar-nav ${mobileOpen ? 'mobile-open' : ''}`}
      >
        {/* Top: Brand Header & Pin Toggle */}
        <div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: isExpanded ? 'space-between' : 'center',
            marginBottom: '1.25rem',
            paddingBottom: '0.85rem',
            borderBottom: '1px solid var(--border-light)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <img
                src="/logo.png"
                alt="Garcia College of Technology Logo"
                style={{
                  width: '38px',
                  height: '38px',
                  minWidth: '38px',
                  objectFit: 'contain',
                  filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.15))'
                }}
              />
              {isExpanded && (
                <div style={{ whiteSpace: 'nowrap' }}>
                  <h1 style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-main)', margin: 0, lineHeight: 1.2 }}>
                    AI-Based Subject
                  </h1>
                  <p style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--primary)', margin: 0 }}>
                    Assessment & Recommendation
                  </p>
                  <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', margin: 0 }}>
                    Garcia College of Technology
                  </p>
                </div>
              )}
            </div>

            {isExpanded ? (
              <button
                onClick={() => setIsPinned(!isPinned)}
                style={{
                  background: isPinned ? 'var(--primary)' : 'transparent',
                  border: 'none',
                  color: isPinned ? '#ffffff' : 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '0.35rem',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s ease'
                }}
                title={isPinned ? 'Unpin Sidebar' : 'Pin Sidebar Open'}
              >
                <Pin size={16} />
              </button>
            ) : (
              <ChevronRight size={16} color="var(--text-muted)" style={{ marginTop: '0.2rem' }} />
            )}
          </div>

          {/* Navigation Items per role */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            {/* REGISTRAR STAFF & ADMIN COMMON NAV */}
            {user.role !== 'student' && (
              <>
                <button
                  onClick={() => onTabChange?.('home')}
                  className="btn"
                  style={{
                    justifyContent: isExpanded ? 'flex-start' : 'center',
                    padding: '0.65rem 0.85rem',
                    background: activeTab === 'home' ? 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)' : 'transparent',
                    color: activeTab === 'home' ? '#FFFFFF' : 'var(--text-main)',
                    border: 'none',
                    borderRadius: '10px'
                  }}
                >
                  <LayoutDashboard size={18} />
                  {isExpanded && <span style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>Dashboard</span>}
                </button>

                {/* AI CHATBOT DIRECTLY BELOW DASHBOARD FOR ADMIN & STAFF */}
                <button
                  onClick={() => onTabChange?.('chatbot')}
                  className="btn"
                  style={{
                    justifyContent: isExpanded ? 'flex-start' : 'center',
                    padding: '0.65rem 0.85rem',
                    background: (activeTab === 'chatbot' || activeTab === 'ai_chatbot') ? 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)' : 'transparent',
                    color: (activeTab === 'chatbot' || activeTab === 'ai_chatbot') ? '#FFFFFF' : 'var(--text-main)',
                    border: 'none',
                    borderRadius: '10px'
                  }}
                  title="GCT AI Chatbot Assistant"
                >
                  <Bot size={18} />
                  {isExpanded && <span style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>AI Chatbot</span>}
                </button>

                {/* SUBJECT RECOMMENDATION DIRECTLY UNDER AI CHATBOT */}
                <button
                  onClick={() => onTabChange?.('recommendations')}
                  className="btn"
                  style={{
                    justifyContent: isExpanded ? 'flex-start' : 'center',
                    padding: '0.65rem 0.85rem',
                    background: activeTab === 'recommendations' ? 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)' : 'transparent',
                    color: activeTab === 'recommendations' ? '#FFFFFF' : 'var(--text-main)',
                    border: 'none',
                    borderRadius: '10px'
                  }}
                >
                  <Sparkles size={18} />
                  {isExpanded && <span style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>Subject Recommendation</span>}
                </button>

                <button
                  onClick={() => onTabChange?.('student_academic_records')}
                  className="btn"
                  style={{
                    justifyContent: isExpanded ? 'flex-start' : 'center',
                    padding: '0.65rem 0.85rem',
                    background: (activeTab === 'student_academic_records' || activeTab === 'student_records' || activeTab === 'academic_records' || activeTab === 'students' || activeTab === 'grades' || activeTab === 'records') ? 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)' : 'transparent',
                    color: (activeTab === 'student_academic_records' || activeTab === 'student_records' || activeTab === 'academic_records' || activeTab === 'students' || activeTab === 'grades' || activeTab === 'records') ? '#FFFFFF' : 'var(--text-main)',
                    border: 'none',
                    borderRadius: '10px'
                  }}
                  title="Student Academic Records"
                >
                  <GraduationCap size={18} />
                  {isExpanded && <span style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>Student Academic Records</span>}
                </button>

                <button
                  onClick={() => onTabChange?.('curriculum')}
                  className="btn"
                  style={{
                    justifyContent: isExpanded ? 'flex-start' : 'center',
                    padding: '0.65rem 0.85rem',
                    background: activeTab === 'curriculum' ? 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)' : 'transparent',
                    color: activeTab === 'curriculum' ? '#FFFFFF' : 'var(--text-main)',
                    border: 'none',
                    borderRadius: '10px'
                  }}
                >
                  <BookPlus size={18} />
                  {isExpanded && <span style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>Curriculum Management</span>}
                </button>

                {/* ADMIN ONLY NAVIGATION ITEMS */}
                {user.role === 'registrar_admin' && (
                  <>
                    <button
                      onClick={() => onTabChange?.('manage_accounts')}
                      className="btn"
                      style={{
                        justifyContent: isExpanded ? 'flex-start' : 'center',
                        padding: '0.65rem 0.85rem',
                        background: activeTab === 'manage_accounts' ? 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)' : 'transparent',
                        color: activeTab === 'manage_accounts' ? '#FFFFFF' : 'var(--text-main)',
                        border: 'none',
                        borderRadius: '10px'
                      }}
                    >
                      <Users size={18} />
                      {isExpanded && <span style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>User Management</span>}
                    </button>
                  </>
                )}
              </>
            )}

            {/* STUDENT NAV */}
            {user.role === 'student' && (
              <>
                <button
                  onClick={() => onTabChange?.('home')}
                  className="btn"
                  style={{
                    justifyContent: isExpanded ? 'flex-start' : 'center',
                    padding: '0.65rem 0.85rem',
                    background: activeTab === 'home' ? 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)' : 'transparent',
                    color: activeTab === 'home' ? '#FFFFFF' : 'var(--text-main)',
                    border: 'none',
                    borderRadius: '10px'
                  }}
                >
                  <LayoutDashboard size={18} />
                  {isExpanded && <span style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>Academic Portal</span>}
                </button>

                <button
                  onClick={() => onTabChange?.('records')}
                  className="btn"
                  style={{
                    justifyContent: isExpanded ? 'flex-start' : 'center',
                    padding: '0.65rem 0.85rem',
                    background: activeTab === 'records' ? 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)' : 'transparent',
                    color: activeTab === 'records' ? '#FFFFFF' : 'var(--text-main)',
                    border: 'none',
                    borderRadius: '10px'
                  }}
                >
                  <BookOpen size={18} />
                  {isExpanded && <span style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>My Grades</span>}
                </button>

                <button
                  onClick={() => onTabChange?.('recommendations')}
                  className="btn"
                  style={{
                    justifyContent: isExpanded ? 'flex-start' : 'center',
                    padding: '0.65rem 0.85rem',
                    background: activeTab === 'recommendations' ? 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)' : 'transparent',
                    color: activeTab === 'recommendations' ? '#FFFFFF' : 'var(--text-main)',
                    border: 'none',
                    borderRadius: '10px'
                  }}
                >
                  <Sparkles size={18} />
                  {isExpanded && <span style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>Recommended Subjects</span>}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Bottom Logout */}
        <div style={{
          paddingTop: '1rem',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem'
        }}>
          <button
            onClick={() => confirmLogout(logout)}
            className="btn"
            style={{
              justifyContent: isExpanded ? 'flex-start' : 'center',
              padding: '0.6rem 0.85rem',
              background: 'transparent',
              color: 'var(--text-muted)',
              border: 'none'
            }}
          >
            <LogOut size={18} />
            {isExpanded && <span style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>Logout</span>}
          </button>
        </div>
      </aside>
    </>
  );
};
