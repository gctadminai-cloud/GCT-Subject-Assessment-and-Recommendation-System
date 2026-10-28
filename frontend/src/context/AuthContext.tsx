import React, { createContext, useContext, useState, useEffect } from 'react';
import { fetchApi } from '../config/api';

export interface UserProfile {
  id: string;
  username: string;
  student_id?: string | null;
  email?: string;
  role: 'student' | 'registrar_staff' | 'registrar_admin';
  full_name: string;
  approval_status: 'pending' | 'approved' | 'rejected';
  status?: 'pending' | 'approved' | 'rejected';
  program?: string;
  year_level?: number;
  schedule?: string;
}

export interface StudentRecord {
  id: string;
  student_id: string;
  profile_id: string;
  program: string;
  year_level: number;
  section: string;
}

interface AuthContextType {
  user: UserProfile | null;
  student: StudentRecord | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<{ user: UserProfile; student: StudentRecord | null }>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(() => {
    if (typeof window !== 'undefined') {
      const savedUser = sessionStorage.getItem('gct_user_profile');
      const token = sessionStorage.getItem('gct_auth_token');
      if (savedUser && token) {
        try {
          return JSON.parse(savedUser);
        } catch (e) {}
      }
    }
    return null;
  });

  const [student, setStudent] = useState<StudentRecord | null>(() => {
    if (typeof window !== 'undefined') {
      const savedStudent = sessionStorage.getItem('gct_student_record');
      if (savedStudent) {
        try {
          return JSON.parse(savedStudent);
        } catch (e) {}
      }
    }
    return null;
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      sessionStorage.setItem('gct_user_profile', JSON.stringify(user));
    } else {
      sessionStorage.removeItem('gct_user_profile');
      localStorage.removeItem('gct_user_profile');
    }
  }, [user]);

  useEffect(() => {
    if (student) {
      sessionStorage.setItem('gct_student_record', JSON.stringify(student));
    } else {
      sessionStorage.removeItem('gct_student_record');
      localStorage.removeItem('gct_student_record');
    }
  }, [student]);

  const refreshUser = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const res = await fetchApi('/auth/me', {}, user);
      if (res.user) {
        setUser(res.user);
      }
      if (res.student) {
        setStudent(res.student);
      }
    } catch (err) {
      console.warn('Refresh user error:', err);
    } finally {
      setLoading(false);
    }
  };

  const login = async (username: string, password: string) => {
    setLoading(true);
    try {
      const res = await fetchApi('/login', {
        method: 'POST',
        body: JSON.stringify({ username, password })
      });

      if (!res.user) {
        throw new Error(res.error || 'Login failed');
      }

      const userData: UserProfile = {
        ...res.user,
        approval_status: res.user.status || res.user.approval_status || 'approved'
      };

      if (res.token) {
        sessionStorage.setItem('gct_auth_token', res.token);
      }

      setUser(userData);

      let studentRec = res.student || null;
      if (!studentRec && userData.role === 'student') {
        studentRec = {
          id: userData.student_id || userData.id,
          student_id: userData.student_id || userData.username,
          profile_id: userData.id,
          program: userData.program || 'BSIT',
          year_level: userData.year_level || 1,
          section: userData.schedule || 'Block A'
        };
      }
      setStudent(studentRec);

      return { user: userData, student: studentRec };
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    setStudent(null);
    sessionStorage.removeItem('gct_auth_token');
    sessionStorage.removeItem('gct_user_profile');
    sessionStorage.removeItem('gct_student_record');
    sessionStorage.setItem('gct_auth_view', 'login');
    localStorage.removeItem('gct_auth_token');
    localStorage.removeItem('gct_user_profile');
    localStorage.removeItem('gct_student_record');
    try {
      localStorage.removeItem('gct_chat_history_guest');
    } catch (e) {}
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', window.location.pathname);
    }
  };

  return (
    <AuthContext.Provider value={{ user, student, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
