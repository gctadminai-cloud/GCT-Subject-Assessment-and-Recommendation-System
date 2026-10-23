import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { NotificationWidget } from '../components/NotificationWidget';
import { ChatbotWidget } from '../components/ChatbotWidget';
import {
  RegistrarDataProvider,
  AdminHomeModule,
  StudentAcademicRecordsModule,
  RecommendationsModule,
  CurriculumModule,
  UserManagementModule
} from '../modules';

interface AdminDashboardProps {
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

export const AdminDashboardContent: React.FC<AdminDashboardProps> = ({ activeTab = 'home', onTabChange }) => {
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

  const userInitials = 'SA';

  const isChatbotTab = currentTab === 'chatbot' || currentTab === 'ai_chatbot';

  const pageTitles: Record<string, string> = {
    home: 'Registrar Administrator Portal',
    chatbot: 'GCT Registrar AI Assistant',
    ai_chatbot: 'GCT Registrar AI Assistant',
    student_academic_records: 'Student Academic Records Management',
    students: 'Student Academic Records Management',
    student_records: 'Student Academic Records Management',
    academic_records: 'Student Academic Records Management',
    grades: 'Student Academic Records Management',
    records: 'Student Academic Records Management',
    recommendations: 'Subject Recommendation System',
    curriculum: 'Curriculum Catalog & Program Matrices',
    manage_accounts: 'User & Account Governance',
    users: 'User & Account Governance',
    reports: 'Institutional Academic Analytics & Reports',
    settings: 'System Settings & Academic Rules'
  };

  const pageSubtitles: Record<string, string> = {
    home: 'System governance, degree program distribution, academic rules & administrative logs',
    chatbot: 'Grounded in institutional database',
    ai_chatbot: 'Grounded in institutional database',
    student_academic_records: 'Unified student directory, section schedulers, academic grade sheets, and advising histories',
    students: 'Unified student directory, section schedulers, academic grade sheets, and advising histories',
    student_records: 'Unified student directory, section schedulers, academic grade sheets, and advising histories',
    academic_records: 'Unified student directory, section schedulers, academic grade sheets, and advising histories',
    grades: 'Unified student directory, section schedulers, academic grade sheets, and advising histories',
    records: 'Unified student directory, section schedulers, academic grade sheets, and advising histories',
    recommendations: 'AI-assisted prerequisite validation and recommended subject catalog per student',
    curriculum: 'Configure institutional course offerings, credit allocations & prerequisite relationships',
    manage_accounts: 'Manage registrar officer access permissions and review student registration approvals',
    users: 'Manage registrar officer access permissions and review student registration approvals',
    reports: 'Export pass rate trends, enrollment statistics, and prerequisite compliance reports',
    settings: 'Configure passing grade thresholds, maximum failed prerequisites, and active terms'
  };

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
                {pageTitles[currentTab] || 'Administrator Portal'}
              </h2>
              <p style={{ fontSize: '0.8rem', color: '#DBEAFE', margin: 0, marginTop: '0.15rem', fontWeight: 500 }}>
                {pageSubtitles[currentTab] || pageSubtitles.home}
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>

              {/* Interactive Notification Widget */}
              <NotificationWidget role={user?.role || 'registrar_admin'} onNavigateTab={tab => onTabChange?.(tab)} />

              {/* User Profile Pill */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #7C3AED 0%, #5B21B6 100%)',
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
                  <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#FFFFFF' }}>
                    System Administrator
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
        {currentTab === 'home' && <AdminHomeModule onTabChange={onTabChange} />}
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
        {(currentTab === 'manage_accounts' || currentTab === 'users') && <UserManagementModule />}
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

export const AdminDashboard: React.FC<AdminDashboardProps> = (props) => {
  return (
    <RegistrarDataProvider>
      <AdminDashboardContent {...props} />
    </RegistrarDataProvider>
  );
};

export default AdminDashboard;
