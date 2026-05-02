import { API_BASE } from '../utils/constants.js';

function getToken() {
  return localStorage.getItem('edutrack_token');
}

function setToken(token) {
  localStorage.setItem('edutrack_token', token);
}

function setRefreshToken(token) {
  localStorage.setItem('edutrack_refresh_token', token);
}

function getRefreshToken() {
  return localStorage.getItem('edutrack_refresh_token');
}

function clearTokens() {
  localStorage.removeItem('edutrack_token');
  localStorage.removeItem('edutrack_refresh_token');
  localStorage.removeItem('edutrack_user');
}

async function refreshAccessToken() {
  const rToken = getRefreshToken();
  if (!rToken) return false;
  try {
    const res = await fetch(`${API_BASE}/auth/refresh-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: rToken }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    setToken(data.token);
    return true;
  } catch {
    return false;
  }
}

async function request(endpoint, options = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let res = await fetch(url, { ...options, headers });

  // If 401, try refreshing the token once
  if (res.status === 401 && !options._retried) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      headers['Authorization'] = `Bearer ${getToken()}`;
      res = await fetch(url, { ...options, headers, _retried: true });
    } else {
      clearTokens();
      window.location.href = '/pages/login.html';
      throw new Error('Session expired');
    }
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || 'Request failed');
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  get: (endpoint) => request(endpoint),
  post: (endpoint, body) => request(endpoint, { method: 'POST', body: JSON.stringify(body) }),
  put: (endpoint, body) => request(endpoint, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (endpoint) => request(endpoint, { method: 'DELETE' }),
  setToken,
  setRefreshToken,
  getToken,
  clearTokens,
  setUser: (user) => localStorage.setItem('edutrack_user', JSON.stringify(user)),
  getUser: () => { try { return JSON.parse(localStorage.getItem('edutrack_user')); } catch { return null; } },
};
