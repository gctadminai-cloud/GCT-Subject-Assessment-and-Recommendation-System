import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { UIProvider } from './context/UIContext';
import { RegistrarDataProvider } from './modules/RegistrarDataContext';
import { Sidebar } from './components/Sidebar';
import { ChatbotWidget } from './components/ChatbotWidget';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { PendingApprovalPage } from './pages/PendingApprovalPage';
import { StudentDashboard } from './pages/StudentDashboard';
import { StaffDashboard } from './pages/StaffDashboard';
import { AdminDashboard } from './pages/AdminDashboard';

const DashboardView: React.FC<{ activeTab: string; onTabChange?: (tab: string) => void }> = ({ activeTab, onTabChange }) => {
  const { user } = useAuth();

  if (!user) return null;

  if (user.role === 'student' && user.approval_status === 'pending') {
    return <PendingApprovalPage />;
  }

  switch (user.role) {
    case 'student':
      return <StudentDashboard activeTab={activeTab} onTabChange={onTabChange} />;
    case 'registrar_admin':
      return <AdminDashboard activeTab={activeTab} onTabChange={onTabChange} />;
    case 'registrar_staff':
    default:
      return <StaffDashboard activeTab={activeTab as any} onTabChange={onTabChange} />;
  }
};

const getInitialAuthView = (): 'login' | 'register' => {
  if (typeof window !== 'undefined') {
    if (window.location.hash === '#register') return 'register';
    sessionStorage.removeItem('gct_auth_view');
  }
  return 'login';
};

const MainAppLayout: React.FC = () => {
  const { user } = useAuth();
  const [authView, setAuthViewState] = useState<'login' | 'register'>(getInitialAuthView);
  const [activeTab, setActiveTab] = useState<string>('home');

  const setAuthView = (view: 'login' | 'register') => {
    setAuthViewState(view);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('gct_auth_view', view);
      window.location.hash = view === 'register' ? 'register' : '';
    }
  };

  // Whenever an authenticated user logs in or switches accounts, ALWAYS direct them straight to the Dashboard ('home')
  React.useEffect(() => {
    if (user) {
      setActiveTab('home');
      if (typeof window !== 'undefined' && window.location.hash) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    }
  }, [user?.id, user?.role]);

  // When logged out, also ensure activeTab is reset to 'home' and auth view goes straight to login
  React.useEffect(() => {
    if (!user) {
      setActiveTab('home');
      setAuthViewState('login');
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('gct_auth_view', 'login');
        if (window.location.hash) {
          window.history.replaceState(null, '', window.location.pathname + window.location.search);
        }
      }
    }
  }, [user]);

  React.useEffect(() => {
    const handleHashChange = () => {
      if (window.location.hash === '#register') {
        setAuthViewState('register');
        sessionStorage.setItem('gct_auth_view', 'register');
      } else if (window.location.hash === '' || window.location.hash === '#login') {
        setAuthViewState('login');
        sessionStorage.setItem('gct_auth_view', 'login');
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  if (!user) {
    return (
      <div style={{ minHeight: '100vh', position: 'relative' }}>
        {authView === 'register' ? (
          <RegisterPage onGoToLogin={() => setAuthView('login')} />
        ) : (
          <LoginPage onGoToRegister={() => setAuthView('register')} />
        )}
        {/* Floating GCT AI Chatbot for Login & Registration */}
        <ChatbotWidget />
      </div>
    );
  }

  const isStudent = user.role === 'student';

  const isChatbot = activeTab === 'chatbot' || activeTab === 'ai_chatbot';

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      height: isChatbot ? '100vh' : 'auto',
      overflow: isChatbot ? 'hidden' : 'visible',
      background: 'var(--bg-main)'
    }}>
      {/* Left Sidebar Navigation (Staff / Admin Only) */}
      {!isStudent && <Sidebar activeTab={activeTab} onTabChange={tab => setActiveTab(tab)} />}

      {/* Main Content View */}
      <main style={{
        flex: 1,
        minWidth: 0,
        height: isChatbot ? '100vh' : 'auto',
        display: isChatbot ? 'flex' : 'block',
        flexDirection: 'column',
        overflowX: 'hidden',
        overflowY: isChatbot ? 'hidden' : 'visible'
      }}>
        <DashboardView activeTab={activeTab} onTabChange={tab => setActiveTab(tab)} />
      </main>

      {/* Floating AI Chatbot Bubble ONLY for Login, Register & Students */}
      {(!user || user.role === 'student') && <ChatbotWidget />}
    </div>
  );
};

export function App() {
  return (
    <AuthProvider>
      <UIProvider>
        <RegistrarDataProvider>
          <MainAppLayout />
        </RegistrarDataProvider>
      </UIProvider>
    </AuthProvider>
  );
}

export default App;
