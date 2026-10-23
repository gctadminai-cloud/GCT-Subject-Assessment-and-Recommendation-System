import React, { useState } from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { NotificationWidget } from '../components/NotificationWidget';
import { ChatbotWidget } from '../components/ChatbotWidget';
import {
  RegistrarDataProvider,
  StaffHomeModule,
  StudentAcademicRecordsModule,
  RecommendationsModule,
  CurriculumModule
} from '../modules';

interface StaffDashboardProps {
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

export const StaffDashboardContent: React.FC<StaffDashboardProps> = ({ activeTab = 'home', onTabChange }) => {
  const { user } = useAuth();
  const currentTab = activeTab || 'home';
  const [chatbotClearSignal, setChatbotClearSignal] = useState(0);
  const [selectedStudentForTab, setSelectedStudentForTab] = useState<string>('');
  const [selectedTermForTab, setSelectedTermForTab] = useState<string>('');
  const [selectedSemesterForTab, setSelectedSemesterForTab] = useState<'1' | '2' | 'summer' | undefined>(undefined);

  const handleChatbotNavigate = (
    tab: string,
    studentId?: string,
    targetTerm?: string,
    semester?: '1' | '2' | 'summer'
  ) => {
    if (studentId) setSelectedStudentForTab(studentId);
    if (targetTerm) setSelectedTermForTab(targetTerm);
    if (semester) setSelectedSemesterForTab(semester);
    onTabChange?.(tab);
  };

  const userInitials = user?.full_name
    ? user.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : 'RS';

  const isChatbotTab = currentTab === 'chatbot' || currentTab === 'ai_chatbot';

  const pageTitles: Record<string, string> = {
    home: 'Registrar Operations Dashboard',
    chatbot: 'GCT Registrar AI Assistant',
    ai_chatbot: 'GCT Registrar AI Assistant',
    student_academic_records: 'Student Academic Records Management',
    students: 'Student Academic Records Management',
    student_records: 'Student Academic Records Management',
    academic_records: 'Student Academic Records Management',
    grades: 'Student Academic Records Management',
    records: 'Student Academic Records Management',
    recommendations: 'Subject Recommendation System',
    curriculum: 'Curriculum Management',
    manage_accounts: 'User & Account Governance',
    users: 'User & Account Governance',
    reports: 'Reports & Analytics',
    settings: 'System Settings & Policies'
  };

  const pageSubtitles: Record<string, string> = {
    home: 'Student record administration, grade sheet validation & recommendation approvals',
    chatbot: 'Grounded in institutional database',
    ai_chatbot: 'Grounded in institutional database',
    student_academic_records: 'Unified student directory, section schedulers, academic grade sheets, and advising histories',
    students: 'Unified student directory, section schedulers, academic grade sheets, and advising histories',
    student_records: 'Unified student directory, section schedulers, academic grade sheets, and advising histories',
    academic_records: 'Unified student directory, section schedulers, academic grade sheets, and advising histories',
    grades: 'Unified student directory, section schedulers, academic grade sheets, and advising histories',
    records: 'Unified student directory, section schedulers, academic grade sheets, and advising histories',
    recommendations: 'AI-assisted prerequisite validation and recommended subject catalog per student',
    curriculum: 'Institutional course offerings, credit allocations & prerequisite configurations',
    manage_accounts: 'User account directory & registration approval governance',
    users: 'User account directory & registration approval governance',
    reports: 'Institutional academic performance metrics and report exports',
    settings: 'Decision engine thresholds, passing grade standards, and active semester controls'
  };

  const renderAdminRestrictedBanner = (sectionName: string) => (
    <div className="glass-card" style={{ padding: '3.5rem 2rem', textAlign: 'center', maxWidth: '640px', margin: '2rem auto' }}>
      <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem auto' }}>
        <AlertTriangle size={32} color="#DC2626" />
      </div>
      <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.5rem' }}>
        Access Restricted — Administrator Access Required
      </h3>
      <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: '1.5rem', lineHeight: 1.5 }}>
        <strong>{sectionName}</strong> is reserved exclusively for System Administrators. As Registrar Staff, your access is configured for Student Records, Academic Records, Subject Recommendations, and Curriculum Management.
      </p>
      <button onClick={() => onTabChange?.('home')} className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', margin: '0 auto' }}>
        Return to Dashboard
      </button>
    </div>
  );

  return (
    <div style={{
      background: '#F8FAFC',
      minHeight: isChatbotTab ? '100vh' : '100vh',
      height: isChatbotTab ? '100vh' : 'auto',
      maxHeight: isChatbotTab ? '100vh' : 'none',
      display: 'flex',
      flexDirection: 'column',
      flex: 1,
      overflow: isChatbotTab ? 'hidden' : 'visible'
    }}>
      {/* PERSISTENT TOP HEADER BAR (Student Dashboard color theme) */}
      <header style={{
        background: 'linear-gradient(135deg, #1E3A8A 0%, #2563EB 55%, #1D4ED8 100%)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.15)',
        padding: '1rem 2rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: isChatbotTab ? 'relative' : 'sticky',
        top: 0,
        zIndex: 40,
        flexShrink: 0,
        boxShadow: '0 4px 20px -2px rgba(30, 58, 138, 0.25)'
      }}>
        {isChatbotTab ? (
          <>
            <div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#FFFFFF', margin: 0, lineHeight: 1.2, textShadow: '0 1px 2px rgba(0,0,0,0.15)' }}>
                GCT Registrar AI Assistant
              </h2>
              <p style={{ fontSize: '0.8rem', color: '#DBEAFE', margin: 0, marginTop: '0.15rem', fontWeight: 500 }}>
                Grounded in institutional database
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
              <span style={{
                background: 'rgba(16, 185, 129, 0.2)',
                color: '#34D399',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                padding: '6px 14px',
                borderRadius: '20px',
                fontSize: '0.78rem',
                fontWeight: 700
              }}>
                ● Active GCT AI Knowledge Engine
              </span>

              <button
                type="button"
                onClick={() => setChatbotClearSignal(s => s + 1)}
                style={{
                  background: 'rgba(255, 255, 255, 0.15)',
                  border: '1px solid rgba(255, 255, 255, 0.25)',
                  color: '#FFFFFF',
                  borderRadius: '8px',
                  padding: '0.45rem 0.95rem',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  transition: 'all 0.2s ease'
                }}
                title="Clear Conversation History"
              >
                <Trash2 size={14} /> Clear History
              </button>
            </div>
          </>
        ) : (
          <>
            <div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#FFFFFF', margin: 0, lineHeight: 1.2, textShadow: '0 1px 2px rgba(0,0,0,0.15)' }}>
                {pageTitles[currentTab] || 'Dashboard'}
              </h2>
              <p style={{ fontSize: '0.8rem', color: '#DBEAFE', margin: 0, marginTop: '0.15rem', fontWeight: 500 }}>
                {pageSubtitles[currentTab] || pageSubtitles.home}
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
              {/* Interactive Notification Widget */}
              <NotificationWidget role={user?.role || 'registrar_staff'} onNavigateTab={tab => onTabChange?.(tab)} />

              {/* User Profile Pill */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#FFFFFF',
                  fontWeight: 800,
                  fontSize: '0.88rem',
                  boxShadow: '0 0 0 2px rgba(255,255,255,0.35)'
                }}>
                  {userInitials}
                </div>
                <div style={{ lineHeight: 1.2 }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#FFFFFF' }}>
                    {user?.full_name || 'Registrar Officer'}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#DBEAFE' }}>
                    Registrar Staff
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </header>

      {/* MAIN CONTENT AREA */}
      <main style={{
        padding: isChatbotTab ? 0 : '1.75rem 2rem',
        flex: 1,
        maxWidth: isChatbotTab ? '100%' : '1440px',
        width: '100%',
        margin: isChatbotTab ? 0 : '0 auto',
        display: isChatbotTab ? 'flex' : 'block',
        flexDirection: 'column',
        minHeight: 0,
        overflow: isChatbotTab ? 'hidden' : 'visible'
      }}>
        {currentTab === 'home' && <StaffHomeModule onTabChange={onTabChange} />}
        {isChatbotTab && (
          <ChatbotWidget
            isFullScreen={true}
            hideHeader={true}
            clearTrigger={chatbotClearSignal}
            onNavigateTab={handleChatbotNavigate}
          />
        )}
        {currentTab === 'recommendations' && (
          <RecommendationsModule
            initialStudentId={selectedStudentForTab}
            initialSemester={selectedSemesterForTab}
          />
        )}
        {(currentTab === 'student_academic_records' || currentTab === 'students' || currentTab === 'student_records' || currentTab === 'academic_records' || currentTab === 'grades' || currentTab === 'records') && (
          <StudentAcademicRecordsModule
            initialSubView={currentTab === 'academic_records' || currentTab === 'grades' || currentTab === 'records' ? 'grades' : 'directory'}
            initialStudentId={selectedStudentForTab}
            initialSearchQuery={selectedStudentForTab}
            initialTargetTerm={selectedTermForTab}
          />
        )}
        {currentTab === 'curriculum' && <CurriculumModule />}
        {(currentTab === 'manage_accounts' || currentTab === 'users') && renderAdminRestrictedBanner('User Account Governance')}
      </main>

      {/* FOOTER - Hidden on chatbot tab so input sits at bottom of screen */}
      {!isChatbotTab && (
        <footer style={{
          background: '#FFFFFF',
          borderTop: '1px solid #E2E8F0',
          padding: '1.25rem 1.5rem',
          textAlign: 'center',
          fontSize: '0.78rem',
          color: '#64748B',
          marginTop: 'auto'
        }}>
          © 2026 Garcia College of Technology. All rights reserved.
        </footer>
      )}
    </div>
  );
};

export const StaffDashboard: React.FC<StaffDashboardProps> = (props) => {
  return (
    <RegistrarDataProvider>
      <StaffDashboardContent {...props} />
    </RegistrarDataProvider>
  );
};

export default StaffDashboard;
