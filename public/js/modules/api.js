import { API_BASE } from '../utils/constants.js';

/**
 * Thin fetch wrapper around the REST API. The database is the single source of
 * truth — there is no localStorage data store. If the server can't be reached
 * the call fails loudly so the operator knows nothing was saved.
 */

const SERVER_UNREACHABLE = 'Cannot reach the server. Make sure the library app window is still running.';

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

function redirectToLogin() {
  if (!location.pathname.endsWith('/login.html')) {
    window.location.href = '/pages/login.html';
  }
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

  let res;
  try {
    res = await fetch(url, { ...options, headers });
  } catch {
    throw new Error(SERVER_UNREACHABLE);
  }

  // If 401, try refreshing the token once, then re-issue the request.
  if (res.status === 401 && !options._retried) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      headers['Authorization'] = `Bearer ${getToken()}`;
      try {
        res = await fetch(url, { ...options, headers, _retried: true });
      } catch {
        throw new Error(SERVER_UNREACHABLE);
      }
    } else {
      clearTokens();
      redirectToLogin();
      throw new Error('Session expired. Please sign in again.');
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
