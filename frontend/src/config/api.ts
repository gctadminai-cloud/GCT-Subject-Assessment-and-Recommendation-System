function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
    // When accessed from another device on the local network (e.g. phone),
    // always use relative /api so Vite's dev proxy forwards to local backend
    if (!isLocalhost) {
      return '/api';
    }
  }

  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (!envUrl || envUrl.trim() === '' || envUrl.includes('localhost:5000')) {
    return '/api';
  }
  return envUrl;
}

const API_BASE_URL = getApiBaseUrl();

export async function fetchApi(endpoint: string, options: RequestInit = {}, userContext?: any) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {})
  };

  // Attach token if available
  const token = sessionStorage.getItem('gct_auth_token') || localStorage.getItem('gct_auth_token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Developer headers for instant role testing & API authentication
  let activeUser = userContext;
  if (!activeUser && typeof window !== 'undefined') {
    const saved = sessionStorage.getItem('gct_user_profile') || localStorage.getItem('gct_user_profile');
    if (saved) {
      try { activeUser = JSON.parse(saved); } catch (e) {}
    }
  }
  if (activeUser) {
    headers['x-user-id'] = activeUser.id || 'dev-id';
    headers['x-student-id'] = activeUser.student_id || activeUser.username || activeUser.id || '';
    headers['x-user-role'] = activeUser.role || 'registrar_admin';
    headers['x-user-email'] = activeUser.email || 'admin@gct.edu.ph';
    headers['x-user-name'] = activeUser.full_name || 'Administrator';
    headers['x-user-status'] = activeUser.approval_status || 'approved';
  } else {
    // Default to guest role for unauthenticated requests
    headers['x-user-id'] = 'guest';
    headers['x-student-id'] = '';
    headers['x-user-role'] = 'guest';
    headers['x-user-email'] = 'guest@gct.edu.ph';
    headers['x-user-name'] = 'Visitor';
    headers['x-user-status'] = 'approved';
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || `API error (${response.status})`);
  }
  return data;
}

export { API_BASE_URL };
