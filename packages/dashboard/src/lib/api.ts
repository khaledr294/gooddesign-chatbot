const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/admin';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('gd_admin_token');
}

export async function apiFetch<T = any>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });

  if (res.status === 401) {
    localStorage.removeItem('gd_admin_token');
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(err.message || `HTTP ${res.status}`);
  }

  return res.json();
}

export async function login(email: string, password: string) {
  const data = await apiFetch('/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  localStorage.setItem('gd_admin_token', data.token);
  localStorage.setItem('gd_admin_agent', JSON.stringify(data.agent));
  return data;
}

export function getAgent() {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('gd_admin_agent');
  return raw ? JSON.parse(raw) : null;
}

export function logout() {
  localStorage.removeItem('gd_admin_token');
  localStorage.removeItem('gd_admin_agent');
  window.location.href = '/login';
}
