import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertTriangle, Info, X, LogOut, HelpCircle } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

export interface ConfirmModalOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'primary' | 'success';
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
}

interface UIContextType {
  showToast: (message: string, type?: ToastType) => void;
  confirmAction: (options: ConfirmModalOptions) => void;
  confirmLogout: (onLogout: () => void) => void;
}

const UIContext = createContext<UIContextType | undefined>(undefined);

export const UIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [activeModal, setActiveModal] = useState<ConfirmModalOptions | null>(null);

  // Snackbar Toast Handler
  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    const id = 'toast-' + Date.now() + Math.random().toString(36).substr(2, 4);
    setToasts(prev => [...prev, { id, message, type }]);

    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3500);
  }, []);

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Pop-up Modal Handler
  const confirmAction = useCallback((options: ConfirmModalOptions) => {
    setActiveModal(options);
  }, []);

  // Built-in Logout Confirmation Handler
  const confirmLogout = useCallback((onLogout: () => void) => {
    confirmAction({
      title: 'Sign Out Confirmation',
      message: 'Are you sure you want to sign out of Garcia College of Technology Academic Hub?',
      confirmText: 'Yes, Sign Out',
      cancelText: 'No, Stay',
      type: 'danger',
      onConfirm: async () => {
        onLogout();
        showToast('Successfully signed out of GCT Academic Hub', 'info');
      }
    });
  }, [confirmAction, showToast]);

  const handleModalConfirm = async () => {
    if (!activeModal) return;
    const modalToExecute = activeModal;
    setActiveModal(null);
    try {
      await modalToExecute.onConfirm();
    } catch (err: any) {
      showToast(err.message || 'Action failed', 'error');
    }
  };

  const handleModalCancel = () => {
    if (activeModal?.onCancel) {
      activeModal.onCancel();
    }
    setActiveModal(null);
  };

  return (
    <UIContext.Provider value={{ showToast, confirmAction, confirmLogout }}>
      {children}

      {/* Floating Snackbar Toast Container (Bottom-Right) */}
      <div
        style={{
          position: 'fixed',
          bottom: '1.5rem',
          right: '1.5rem',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: '0.65rem',
          maxWidth: '380px',
          width: 'calc(100vw - 3rem)',
          pointerEvents: 'none'
        }}
      >
        {toasts.map(toast => {
          let icon = <CheckCircle2 size={18} color="#10B981" />;
          let bg = '#FFFFFF';
          let border = '#10B981';

          if (toast.type === 'error') {
            icon = <AlertTriangle size={18} color="#EF4444" />;
            border = '#EF4444';
          } else if (toast.type === 'info') {
            icon = <Info size={18} color="#2563EB" />;
            border = '#2563EB';
          } else if (toast.type === 'warning') {
            icon = <AlertTriangle size={18} color="#F59E0B" />;
            border = '#F59E0B';
          }

          return (
            <div
              key={toast.id}
              style={{
                pointerEvents: 'auto',
                background: bg,
                color: '#0F172A',
                borderLeft: `5px solid ${border}`,
                borderRadius: '10px',
                padding: '0.85rem 1rem',
                boxShadow: '0 10px 30px rgba(0, 0, 0, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.75rem',
                animation: 'slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                fontSize: '0.88rem',
                fontWeight: 600
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                {icon}
                <span>{toast.message}</span>
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#64748B',
                  cursor: 'pointer',
                  padding: '0.2rem',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <X size={15} />
              </button>
            </div>
          );
        })}
      </div>

      {/* Pop-up Confirmation Modal */}
      {activeModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            background: 'rgba(15, 23, 42, 0.7)',
            WebkitBackdropFilter: 'blur(4px)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.25rem',
            animation: 'fadeIn 0.15s ease-out'
          }}
        >
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: '16px',
              maxWidth: '400px',
              width: '100%',
              padding: '1.5rem',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25)',
              border: '1px solid rgba(226, 232, 240, 0.8)',
              textAlign: 'center',
              animation: 'popIn 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
              willChange: 'transform, opacity'
            }}
          >
            {/* Modal Header Icon */}
            <div
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '50%',
                background: activeModal.type === 'danger' ? '#FEE2E2' : '#EFF6FF',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '0.85rem'
              }}
            >
              {activeModal.type === 'danger' ? (
                <LogOut size={24} color="#DC2626" />
              ) : (
                <HelpCircle size={24} color="#2563EB" />
              )}
            </div>

            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F172A', marginBottom: '0.4rem' }}>
              {activeModal.title}
            </h3>

            <p style={{ color: '#475569', fontSize: '0.88rem', lineHeight: 1.45, marginBottom: '1.5rem' }}>
              {activeModal.message}
            </p>

            {/* Modal Action Buttons: YES / NO */}
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={handleModalCancel}
                className="btn btn-secondary"
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  fontSize: '0.9rem',
                  borderRadius: '10px',
                  touchAction: 'manipulation',
                  WebkitTapHighlightColor: 'transparent',
                  cursor: 'pointer'
                }}
              >
                {activeModal.cancelText || 'No, Cancel'}
              </button>

              <button
                type="button"
                onClick={handleModalConfirm}
                className={`btn ${activeModal.type === 'danger' ? 'btn-danger' : 'btn-primary'}`}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  fontSize: '0.9rem',
                  borderRadius: '10px',
                  background: activeModal.type === 'danger' ? '#DC2626' : undefined,
                  color: '#FFFFFF',
                  touchAction: 'manipulation',
                  WebkitTapHighlightColor: 'transparent',
                  cursor: 'pointer'
                }}
              >
                {activeModal.confirmText || 'Yes, Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Animation Styles */}
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes popIn {
          from { transform: scale(0.95) translateY(6px); opacity: 0; }
          to { transform: scale(1) translateY(0); opacity: 1; }
        }
      `}</style>
    </UIContext.Provider>
  );
};

export const useUI = () => {
  const context = useContext(UIContext);
  if (!context) throw new Error('useUI must be used within UIProvider');
  return context;
};
