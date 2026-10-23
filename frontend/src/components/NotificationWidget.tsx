import React, { useState, useRef, useEffect } from 'react';
import { Bell, Trash2, CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';
import { useUI } from '../context/UIContext';
import { useAuth } from '../context/AuthContext';
import { useRegistrarData } from '../modules/RegistrarDataContext';
import { fetchApi } from '../config/api';

interface NotificationWidgetProps {
  role: 'student' | 'registrar_staff' | 'registrar_admin';
  onNavigateTab?: (tab: string) => void;
}

export interface SystemNotification {
  id: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
  type: 'success' | 'warning' | 'info' | 'error';
  targetTab?: string;
  source?: 'registration' | 'grade';
  entityId?: string;
}

const formatRelativeTime = (dateValue?: string) => {
  if (!dateValue) return 'Recently';
  const timestamp = new Date(dateValue).getTime();
  if (!Number.isFinite(timestamp)) return 'Recently';
  const seconds = Math.round((timestamp - Date.now()) / 1000);
  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  if (Math.abs(seconds) < 60) return formatter.format(seconds, 'second');
  if (Math.abs(seconds) < 3600) return formatter.format(Math.round(seconds / 60), 'minute');
  if (Math.abs(seconds) < 86400) return formatter.format(Math.round(seconds / 3600), 'hour');
  return formatter.format(Math.round(seconds / 86400), 'day');
};

const mergeNotifications = (
  current: SystemNotification[],
  incoming: SystemNotification[],
  dismissedIds: Set<string>
) => {
  const currentById = new Map(current.map(notification => [notification.id, notification]));
  return incoming
    .filter(notification => !dismissedIds.has(notification.id))
    .map(notification => ({
      ...notification,
      read: currentById.get(notification.id)?.read ?? notification.read
    }));
};

export const NotificationWidget: React.FC<NotificationWidgetProps> = ({ role, onNavigateTab }) => {
  const { showToast } = useUI();
  const { user } = useAuth();
  const { mockStudents, refreshStudents } = useRegistrarData();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  const [loadedStorageKey, setLoadedStorageKey] = useState('');

  const containerRef = useRef<HTMLDivElement>(null);
  const ownerId = user?.student_id || user?.id || user?.username || role;
  const storageKey = `gct_notifications_${role}_${ownerId}`;
  const dismissedStorageKey = `${storageKey}_dismissed`;

  useEffect(() => {
    setNotifications([]);
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || '[]');
      setNotifications(Array.isArray(saved) ? saved : []);
    } catch {
      setNotifications([]);
    }
    setLoadedStorageKey(storageKey);
  }, [storageKey]);

  useEffect(() => {
    if (loadedStorageKey !== storageKey) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(notifications));
    } catch (error) {
      console.warn('Notification storage unavailable:', error);
    }
  }, [loadedStorageKey, notifications, storageKey]);

  const readDismissedIds = () => {
    try {
      const ids = JSON.parse(localStorage.getItem(dismissedStorageKey) || '[]');
      return new Set<string>(Array.isArray(ids) ? ids : []);
    } catch {
      return new Set<string>();
    }
  };

  const refreshStudentsRef = useRef(refreshStudents);
  useEffect(() => {
    refreshStudentsRef.current = refreshStudents;
  }, [refreshStudents]);

  useEffect(() => {
    if (role === 'student') return;
    const refresh = () => { void refreshStudentsRef.current(); };
    const interval = window.setInterval(refresh, 60_000);
    window.addEventListener('focus', refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refresh);
    };
  }, [role]);

  useEffect(() => {
    if (role === 'student' || loadedStorageKey !== storageKey || mockStudents.length === 0) return;
    const pendingStudents = mockStudents.filter(student => student.has_account && student.status === 'pending');
    const pendingIds = new Set(pendingStudents.map(student => student.student_id));
    const knownAccountIds = new Set(mockStudents.filter(student => student.has_account).map(student => student.student_id));
    const incoming = pendingStudents.map(student => ({
      id: `registration-${student.student_id}`,
      title: 'Student registration pending',
      message: `${student.name} (${student.student_id}) is waiting for approval.`,
      time: formatRelativeTime(student.created_at),
      read: false,
      type: 'warning' as const,
      targetTab: 'manage_accounts',
      source: 'registration' as const,
      entityId: student.student_id
    }));

    setNotifications(current => {
      const retained = current.filter(notification =>
        notification.source !== 'registration' ||
        !knownAccountIds.has(notification.entityId || '') ||
        pendingIds.has(notification.entityId || '')
      );
      return mergeNotifications(retained, incoming, readDismissedIds());
    });
  }, [loadedStorageKey, mockStudents, role, storageKey]);

  useEffect(() => {
    if (role !== 'student' || loadedStorageKey !== storageKey) return;
    const studentId = user?.student_id || user?.username;
    if (!studentId) return;

    let active = true;
    const refreshGrades = async () => {
      try {
        const rows = await fetchApi(`/academic-records?student_id=${encodeURIComponent(studentId)}`, {}, user);
        if (!active || !Array.isArray(rows)) return;
        const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
        const incoming = rows
          .filter((row: any) => {
            const createdAt = new Date(row.created_at || '').getTime();
            return Number.isFinite(createdAt) && createdAt >= cutoff;
          })
          .slice(0, 10)
          .map((row: any) => {
            const subjectCode = row.subject?.code || row.subject_id || row.id;
            const grade = row.grade == null ? 'pending' : row.grade;
            return {
              id: `grade-${row.id}`,
              title: 'Recent academic record',
              message: `${subjectCode} (${row.term || 'current term'}): ${grade}`,
              time: formatRelativeTime(row.created_at),
              read: false,
              type: 'info' as const,
              source: 'grade' as const,
              entityId: String(row.id)
            };
          });
        setNotifications(current => {
          const retained = current.filter(notification => notification.source !== 'grade');
          return mergeNotifications(retained, incoming, readDismissedIds());
        });
      } catch (error) {
        console.warn('Student notifications could not be refreshed:', error);
      }
    };

    void refreshGrades();
    const interval = window.setInterval(refreshGrades, 5 * 60_000);
    window.addEventListener('focus', refreshGrades);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener('focus', refreshGrades);
    };
  }, [loadedStorageKey, role, storageKey, user]);

  // Unread badge count
  const unreadCount = notifications.filter(n => !n.read).length;

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    showToast('All notifications marked as read', 'info');
  };

  const handleClearNotifications = () => {
    try {
      localStorage.setItem(dismissedStorageKey, JSON.stringify(notifications.map(notification => notification.id)));
    } catch (error) {
      console.warn('Notification dismiss state unavailable:', error);
    }
    setNotifications([]);
    showToast('Notifications cleared', 'info');
  };

  const handleNotificationClick = (notif: SystemNotification) => {
    setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n));
    if (notif.targetTab && onNavigateTab) {
      onNavigateTab(notif.targetTab);
    }
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-block' }}>
      {/* Bell Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        style={{
          width: '38px',
          height: '38px',
          borderRadius: '10px',
          background: isOpen ? '#EFF6FF' : 'var(--bg-main)',
          border: isOpen ? '1px solid var(--primary)' : '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          position: 'relative',
          transition: 'all 0.2s ease'
        }}
        title="Notifications"
      >
        <Bell size={18} color={unreadCount > 0 ? 'var(--primary)' : 'var(--text-muted)'} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: '4px',
            right: '4px',
            background: 'var(--danger)',
            color: '#FFFFFF',
            fontSize: '0.65rem',
            fontWeight: 800,
            borderRadius: '10px',
            minWidth: '16px',
            height: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 3px',
            border: '2px solid #FFFFFF'
          }}>
            {unreadCount}
          </span>
        )}
      </button>

      {/* Floating Notification Popover Dropdown */}
      {isOpen && (
        <div style={{
          position: 'absolute',
          right: 0,
          top: '46px',
          width: 'min(360px, calc(100vw - 2rem))',
          maxHeight: '480px',
          background: '#FFFFFF',
          border: '1px solid var(--border-color)',
          borderRadius: '14px',
          boxShadow: 'var(--shadow-elevated)',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'fadeIn 0.2s ease-out'
        }}>
          {/* Header */}
          <div style={{
            padding: '0.85rem 1rem',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-main)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Bell size={16} color="var(--primary)" />
              <strong style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>Notifications</strong>
              {unreadCount > 0 && (
                <span className="badge badge-BSIT" style={{ fontSize: '0.7rem', padding: '0.15rem 0.45rem' }}>
                  {unreadCount} Unread
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--primary)',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    padding: '0.2rem 0.4rem'
                  }}
                  title="Mark all as read"
                >
                  Mark Read
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* List of Notification Items */}
          <div style={{ overflowY: 'auto', flex: 1, padding: '0.5rem 0' }}>
            {notifications.length === 0 ? (
              <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                <CheckCircle2 size={32} color="var(--text-muted)" style={{ marginBottom: '0.5rem', opacity: 0.5 }} />
                <div>No notifications right now!</div>
              </div>
            ) : (
              notifications.map(notif => (
                <button
                  type="button"
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  aria-label={`${notif.title}. ${notif.message}. ${notif.time}${notif.read ? '' : '. Unread'}`}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    border: 'none',
                    font: 'inherit',
                    padding: '0.75rem 1rem',
                    borderBottom: '1px solid var(--border-color)',
                    background: notif.read ? '#FFFFFF' : 'rgba(37, 99, 235, 0.04)',
                    cursor: 'pointer',
                    transition: 'background 0.15s ease',
                    display: 'flex',
                    gap: '0.75rem',
                    alignItems: 'flex-start'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-main)'}
                  onMouseLeave={e => e.currentTarget.style.background = notif.read ? '#FFFFFF' : 'rgba(37, 99, 235, 0.04)'}
                >
                  {/* Icon Indicator */}
                  <span style={{ marginTop: '2px' }}>
                    {notif.type === 'success' && <CheckCircle2 size={18} color="var(--success)" />}
                    {notif.type === 'warning' && <AlertTriangle size={18} color="var(--warning)" />}
                    {notif.type === 'info' && <Info size={18} color="var(--primary)" />}
                    {notif.type === 'error' && <X size={18} color="var(--danger)" />}
                  </span>

                  {/* Body Content */}
                  <span style={{ flex: 1 }}>
                    <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                      <strong style={{ fontSize: '0.82rem', color: notif.read ? 'var(--text-main)' : 'var(--primary)' }}>
                        {notif.title}
                      </strong>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{notif.time}</span>
                    </span>
                    <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.35 }}>
                      {notif.message}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>

          {/* Footer Bar */}
          {notifications.length > 0 && (
            <div style={{
              padding: '0.5rem 1rem',
              borderTop: '1px solid var(--border-color)',
              background: 'var(--bg-main)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Showing {notifications.length} updates
              </span>
              <button
                onClick={handleClearNotifications}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--danger)',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem'
                }}
              >
                <Trash2 size={12} /> Clear all
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
