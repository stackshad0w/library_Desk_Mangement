import { api } from './api.js';
import { showToast } from '../utils/toast.js';

export async function login(username, password) {
  const data = await api.post('/auth/login', { username, password });
  api.setToken(data.token);
  api.setRefreshToken(data.refreshToken);
  api.setUser(data.user);
  return data;
}

export function logout() {
  api.post('/auth/logout').catch(() => {});
  api.clearTokens();
  window.location.href = '/pages/login.html';
}

export function isAuthenticated() {
  return !!api.getToken();
}

export function requireAuth() {
  if (!isAuthenticated()) {
    window.location.href = '/pages/login.html';
    return false;
  }
  return true;
}

export function getCurrentUser() {
  return api.getUser();
}

export function setupAuthUI() {
  const user = getCurrentUser();
  if (!user) return;
  const avatarEl = document.querySelector('.admin-avatar');
  const nameEl = document.querySelector('.admin-name');
  const roleEl = document.querySelector('.admin-role');
  if (avatarEl) avatarEl.textContent = user.username.slice(0, 2).toUpperCase();
  if (nameEl) nameEl.textContent = user.username;
  if (roleEl) roleEl.textContent = user.role.charAt(0).toUpperCase() + user.role.slice(1);

  // Logout button
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) logoutBtn.addEventListener('click', logout);
}
