import { api } from './api.js';
import { showToast } from '../utils/toast.js';
import { formatCurrency } from '../utils/helpers.js';
import { applyBodyTheme } from '../utils/theme.js';

export const DEFAULT_THEMES = [
  { id: 'default', label: 'Dark Default', bg: '#1a1a2e' },
  { id: 'warm', label: 'Warm Retro', bg: '#2a2010' },
  { id: 'light', label: 'Standard Light', bg: '#ffffff' },
  { id: 'sepia', label: 'Soft Sepia', bg: '#f5f0e8' },
  { id: 'cool', label: 'Cool Blue', bg: '#0d1b2a' },
];

const SELECTED_THEME_KEY = 'selectedTheme';
const LOCAL_SETTINGS_KEY = 'edutrack_settings';
const DEFAULT_FEE_TIERS = [{ gender: 'Male', shift: 'Day', months: 1, fee: 1000 }];
const DEFAULT_COURSES = ['UPSC MPSC', 'IIT JEE/MHT CET', 'MEDICAL', 'OTHER'];
let courseList = DEFAULT_COURSES.slice();

function loadFeeTiersFromStorage() {
  try {
    const settings = JSON.parse(localStorage.getItem(LOCAL_SETTINGS_KEY) || '{}');
    if (Array.isArray(settings.fee_tiers) && settings.fee_tiers.length) {
      return settings.fee_tiers;
    }
  } catch {}
  return DEFAULT_FEE_TIERS.slice();
}

let feeTiers = loadFeeTiersFromStorage();

function sortTiers(tiers) {
  return tiers.slice().sort((a, b) => {
    if (a.shift !== b.shift) return a.shift.localeCompare(b.shift);
    if (a.gender !== b.gender) return a.gender.localeCompare(b.gender);
    return a.months - b.months;
  });
}

function feeTierRow(tier, idx, deletable = true) {
  return `
    <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 16px; background:var(--bg2); border:1px solid var(--border); border-radius:var(--radius-sm);">
      <div>
        <span class="status-pill badge-purple" style="font-size:10px; margin-right:8px;">${tier.shift}</span>
        <span style="font-weight:600; font-size:14px;">${tier.gender} - ${tier.months} Month${tier.months > 1 ? 's' : ''}</span>
        <span style="color:var(--text3); margin:0 8px;">-</span>
        <span style="color:var(--green); font-weight:500;">${formatCurrency(tier.fee)}</span>
      </div>
      ${deletable ? `
        <button class="icon-btn" onclick="window.SwamiAbhyasika.removeFeeTier(${idx})" style="color:var(--red)">
          <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
        </button>` : ''}
    </div>
  `;
}

export async function setTheme(themeName) {
  localStorage.setItem(SELECTED_THEME_KEY, themeName);
  applyTheme(themeName);

  try {
    await api.put('/settings', { key: 'theme', value: themeName });
    showToast(`Theme switched to ${themeName}`, 'green');
  } catch (err) {
    console.warn('Could not save remote theme setting, using local preference.', err);
    showToast('Theme saved locally', 'green');
  }
}

export function toggleTheme() {
  const currentTheme = localStorage.getItem(SELECTED_THEME_KEY) || 'default';
  const lightThemes = ['light', 'sepia'];
  setTheme(lightThemes.includes(currentTheme) ? 'default' : 'light');
}

export function applyTheme(themeName) {
  applyBodyTheme(themeName);
  highlightActiveTheme(themeName);
}

function highlightActiveTheme(themeName) {
  const activeTheme = themeName || 'default';
  document.querySelectorAll('.theme-option').forEach(opt => {
    const isActive = opt.dataset.theme === activeTheme;
    opt.style.borderColor = isActive ? 'var(--accent)' : 'var(--border)';
    opt.style.background = isActive ? 'var(--bg3)' : 'transparent';
  });
}

export function renderThemeOptions(themes = DEFAULT_THEMES) {
  const container = document.getElementById('theme-options-container');
  if (!container) return;

  const saved = localStorage.getItem(SELECTED_THEME_KEY) || 'default';
  container.innerHTML = themes.map(t => `
    <div class="theme-option" data-theme="${t.id}" onclick="window.SwamiAbhyasika.setTheme('${t.id}')" style="cursor:pointer; border:2px solid var(--border); border-radius:var(--radius); padding:12px; text-align:center; transition: all 0.2s;">
      <div style="width:100%; height:60px; background:${t.bg}; border-radius:var(--radius-sm); margin-bottom:8px; border:1px solid rgba(128,128,128,0.25)"></div>
      <div style="font-size:13px; font-weight:600;">${t.label}</div>
    </div>
  `).join('');
  highlightActiveTheme(saved);
}

export async function renderSettings() {
  const list = document.getElementById('fee-tiers-list');
  const themeContainer = document.getElementById('theme-options-container');
  if (!list && !themeContainer) return;

  renderThemeOptions(DEFAULT_THEMES);

  try {
    const settings = await api.get('/settings');
    renderThemeOptions(settings.themes?.length ? settings.themes : DEFAULT_THEMES);

    if (Array.isArray(settings.fee_tiers) && settings.fee_tiers.length) {
      feeTiers = settings.fee_tiers;
    }
    if (Array.isArray(settings.courses) && settings.courses.length) {
      courseList = settings.courses;
    }

    const savedTheme = localStorage.getItem(SELECTED_THEME_KEY) || settings.theme || 'default';
    localStorage.setItem(SELECTED_THEME_KEY, savedTheme);
    applyTheme(savedTheme);
  } catch (err) {
    console.warn('Could not load remote settings, using local/defaults.', err);
    applyTheme(localStorage.getItem(SELECTED_THEME_KEY) || 'default');
  }

  loadSeatConfig();
  renderCourses();
  populateCourseSelect();

  // Admin-only sections (staff accounts, backup/restore).
  const isAdmin = (api.getUser()?.role === 'admin');
  document.querySelectorAll('.admin-only').forEach(el => { el.style.display = isAdmin ? '' : 'none'; });
  if (isAdmin) renderUsers();

  if (!list) return;
  list.innerHTML = sortTiers(feeTiers).map((tier, idx) => feeTierRow(tier, idx)).join('');
}

export async function addFeeTier() {
  const gender = document.getElementById('new-tier-gender').value;
  const shift = document.getElementById('new-tier-shift').value;
  const months = parseInt(document.getElementById('new-tier-months').value);
  const fee = parseFloat(document.getElementById('new-tier-fee').value);

  if (!months || months < 1 || !Number.isInteger(months) || !fee || fee <= 0) {
    showToast('Please enter valid months (whole number >= 1) and fee (> 0)', 'red');
    return;
  }

  const existingIdx = feeTiers.findIndex(t => t.gender === gender && t.shift === shift && t.months === months);
  if (existingIdx > -1) {
    feeTiers[existingIdx].fee = fee;
  } else {
    feeTiers.push({ gender, shift, months, fee });
  }

  try {
    await api.put('/settings', { key: 'fee_tiers', value: feeTiers });
    showToast('Fee rule updated', 'green');
    document.getElementById('new-tier-months').value = '';
    document.getElementById('new-tier-fee').value = '';
    renderSettings();
  } catch (err) {
    showToast('Failed to save setting', 'red');
  }
}

export async function removeFeeTier(idx) {
  const sorted = sortTiers(feeTiers);
  const tier = sorted[idx];
  if (!tier) return;

  if (tier.months === 1 && tier.gender === 'Male' && tier.shift === 'Day') {
    showToast('Base rate (Male/Day/1m) cannot be removed', 'red');
    return;
  }

  sorted.splice(idx, 1);
  feeTiers = sorted;

  try {
    await api.put('/settings', { key: 'fee_tiers', value: feeTiers });
    showToast('Rule removed', 'green');
    renderSettings();
  } catch (err) {
    showToast('Failed to save setting', 'red');
  }
}

export function getFeeForMonths(months, gender = 'Male', shift = 'Day') {
  if (!months || months < 1) return 0;

  const exact = feeTiers.find(t => t.months === months && t.gender === gender && t.shift === shift);
  if (exact) return exact.fee;

  const baseRate = feeTiers.find(t => t.months === 1 && t.gender === gender && t.shift === shift);
  if (baseRate) return baseRate.fee * months;

  const universalBase = feeTiers.find(t => t.months === 1) || { fee: 1000 };
  return universalBase.fee * months;
}

/* ---------- Library Layout (configurable seat grid) ---------- */
let seatFloors = null;

function escapeAttr(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function slugify(s, fallback) {
  const out = String(s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return out || fallback;
}

export async function loadSeatConfig() {
  try {
    const data = await api.get('/seats');
    seatFloors = (data.floors || []).map(f => ({ id: f.id, label: f.label, seats: f.seats, cols: f.cols || 10 }));
  } catch {
    seatFloors = [
      { id: 'basement', label: 'Basement', seats: 90, cols: 10 },
      { id: 'floor2', label: 'Floor 2', seats: 90, cols: 10 },
    ];
  }
  if (!seatFloors.length) seatFloors = [{ id: 'basement', label: 'Basement', seats: 90, cols: 10 }];
  renderSeatConfig();
}

function seatFloorRow(f, idx, removable) {
  return `
    <div style="display:flex; flex-wrap:wrap; gap:10px; align-items:flex-end; padding:12px 16px; background:var(--bg2); border:1px solid var(--border); border-radius:var(--radius-sm);">
      <div class="form-group" style="flex:2; min-width:140px;"><label>Floor / Room name</label>
        <input type="text" value="${escapeAttr(f.label)}" oninput="window.SwamiAbhyasika.updateFloorField(${idx},'label',this.value)"></div>
      <div class="form-group" style="flex:1; min-width:90px;"><label>Seats</label>
        <input type="number" min="1" max="1000" value="${f.seats}" oninput="window.SwamiAbhyasika.updateFloorField(${idx},'seats',this.value)"></div>
      <div class="form-group" style="flex:1; min-width:90px;"><label>Columns</label>
        <input type="number" min="1" max="30" value="${f.cols}" oninput="window.SwamiAbhyasika.updateFloorField(${idx},'cols',this.value)"></div>
      ${removable ? `<button class="icon-btn" title="Remove floor" style="color:var(--red); height:42px; width:42px;" onclick="window.SwamiAbhyasika.removeFloor(${idx})">
        <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></button>` : ''}
    </div>`;
}

function renderSeatConfig() {
  const list = document.getElementById('seat-config-list');
  if (!list || !seatFloors) return;
  list.innerHTML = seatFloors.map((f, i) => seatFloorRow(f, i, seatFloors.length > 1)).join('');
}

export function updateFloorField(idx, field, value) {
  if (!seatFloors || !seatFloors[idx]) return;
  seatFloors[idx][field] = (field === 'seats' || field === 'cols') ? (parseInt(value) || 0) : value;
}

export function addFloor() {
  if (!seatFloors) seatFloors = [];
  seatFloors.push({ id: '', label: 'New Floor', seats: 30, cols: 10 });
  renderSeatConfig();
}

export function removeFloor(idx) {
  if (!seatFloors || seatFloors.length <= 1) { showToast('At least one floor is required', 'amber'); return; }
  seatFloors.splice(idx, 1);
  renderSeatConfig();
}

export async function saveSeatConfig() {
  if (!seatFloors || !seatFloors.length) { showToast('Add at least one floor', 'red'); return; }
  const used = new Set();
  const floors = [];
  for (const f of seatFloors) {
    const label = String(f.label || '').trim();
    const seats = parseInt(f.seats);
    const cols = parseInt(f.cols);
    if (!label) { showToast('Every floor needs a name', 'red'); return; }
    if (!Number.isInteger(seats) || seats < 1 || seats > 1000) { showToast(`"${label}": seats must be 1–1000`, 'red'); return; }
    if (!Number.isInteger(cols) || cols < 1 || cols > 30) { showToast(`"${label}": columns must be 1–30`, 'red'); return; }
    let id = slugify(f.id || label, 'floor');
    const base = id; let n = 2;
    while (used.has(id)) { id = `${base}-${n++}`; }
    used.add(id);
    floors.push({ id, label, seats, cols });
  }
  try {
    await api.put('/settings', { key: 'seat_config', value: { floors } });
    seatFloors = floors;
    renderSeatConfig();
    showToast('Library layout saved', 'green');
  } catch (err) {
    showToast(err.data?.message || err.message || 'Failed to save layout', 'red');
  }
}

/* ---------- Data Backup / Restore ---------- */
export async function downloadBackup() {
  try {
    const data = await api.get('/backup');
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `swami-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    showToast('Backup downloaded', 'green');
  } catch (err) {
    showToast(err.message || 'Backup failed', 'red');
  }
}

export function triggerRestore() {
  document.getElementById('restore-file')?.click();
}

export async function restoreBackup(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  const ok = await window.SwamiAbhyasika.customConfirm(
    'Restoring REPLACES all current data with the contents of this backup file. This cannot be undone. Continue?',
    'Restore Backup', 'Restore', 'var(--red)');
  e.target.value = '';
  if (!ok) return;
  try {
    const payload = JSON.parse(await file.text());
    await api.post('/backup/restore', payload);
    showToast('Backup restored. Reloading…', 'green');
    setTimeout(() => window.location.reload(), 1200);
  } catch (err) {
    showToast(err.data?.message || err.message || 'Restore failed', 'red');
  }
}

/* ---------- Staff Accounts (user management) ---------- */
export async function renderUsers() {
  const list = document.getElementById('users-list');
  if (!list) return;
  try {
    const { users } = await api.get('/auth/users');
    list.innerHTML = users.map(u => `
      <div style="display:flex; align-items:center; gap:10px; padding:12px 16px; background:var(--bg2); border:1px solid var(--border); border-radius:var(--radius-sm); flex-wrap:wrap;">
        <div class="avatar" style="background:var(--accent-bg); color:var(--accent)">${escapeAttr((u.username || '?').slice(0, 2).toUpperCase())}</div>
        <div style="flex:1; min-width:120px;">
          <div style="font-weight:600; font-size:13px;">${escapeAttr(u.username)} ${u.is_active ? '' : '<span style="color:var(--text3); font-weight:400;">(inactive)</span>'}</div>
          <div style="font-size:11px; color:var(--text3);">${escapeAttr(u.email || '')}</div>
        </div>
        <select onchange="window.SwamiAbhyasika.changeUserRole('${u.id}', this.value)" style="width:auto;">
          ${['admin', 'teacher', 'accountant'].map(r => `<option value="${r}" ${u.role === r ? 'selected' : ''}>${r}</option>`).join('')}
        </select>
        <button class="btn btn-ghost" style="font-size:11px; padding:5px 10px;" onclick="window.SwamiAbhyasika.setUserActive('${u.id}', ${u.is_active ? 0 : 1})">${u.is_active ? 'Deactivate' : 'Activate'}</button>
        <button class="icon-btn" style="color:var(--red)" title="Delete" onclick="window.SwamiAbhyasika.deleteUser('${u.id}')"><svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></button>
      </div>`).join('');
  } catch (err) {
    list.innerHTML = `<div style="color:var(--red); font-size:13px;">${escapeAttr(err.message || 'Failed to load users')}</div>`;
  }
}

export async function addUser() {
  const username = document.getElementById('new-user-name').value.trim();
  const email = document.getElementById('new-user-email').value.trim();
  const password = document.getElementById('new-user-password').value;
  const role = document.getElementById('new-user-role').value;
  if (username.length < 3) { showToast('Username must be at least 3 characters', 'red'); return; }
  if (!email) { showToast('Email is required', 'red'); return; }
  if (!password || password.length < 8) { showToast('Password must be at least 8 characters', 'red'); return; }
  try {
    await api.post('/auth/register', { username, email, password, role });
    showToast('User created', 'green');
    document.getElementById('new-user-name').value = '';
    document.getElementById('new-user-email').value = '';
    document.getElementById('new-user-password').value = '';
    renderUsers();
  } catch (err) {
    showToast(err.data?.errors?.[0]?.message || err.data?.message || err.message || 'Failed to create user', 'red');
  }
}

export async function changeUserRole(id, role) {
  try { await api.put(`/auth/users/${id}`, { role }); showToast('Role updated', 'green'); }
  catch (err) { showToast(err.data?.message || err.message || 'Failed', 'red'); }
  renderUsers();
}

export async function setUserActive(id, active) {
  try { await api.put(`/auth/users/${id}`, { is_active: !!active }); showToast('Updated', 'green'); renderUsers(); }
  catch (err) { showToast(err.data?.message || err.message || 'Failed', 'red'); }
}

export async function deleteUser(id) {
  const ok = await window.SwamiAbhyasika.customConfirm('Delete this user account?', 'Delete User', 'Delete', 'var(--red)');
  if (!ok) return;
  try { await api.delete(`/auth/users/${id}`); showToast('User deleted', 'green'); renderUsers(); }
  catch (err) { showToast(err.data?.message || err.message || 'Failed', 'red'); }
}

/* ---------- Courses (configurable) ---------- */
export function setCourseList(list) {
  if (Array.isArray(list) && list.length) courseList = list.slice();
  renderCourses();
  populateCourseSelect();
}

function renderCourses() {
  const wrap = document.getElementById('courses-list');
  if (!wrap) return;
  wrap.innerHTML = courseList.map((c, i) => `
    <span class="status-pill badge-purple" style="display:inline-flex;align-items:center;gap:6px;font-size:12px;padding:4px 10px;">
      ${escapeAttr(c)}
      <button class="icon-btn" style="width:18px;height:18px;background:none;color:var(--red)" title="Remove" onclick="window.SwamiAbhyasika.removeCourse(${i})">✕</button>
    </span>`).join('');
}

// Fill the admission form's course dropdown from the configured list.
export function populateCourseSelect() {
  const sel = document.getElementById('f-course');
  if (!sel) return;
  const cur = sel.value;
  const list = courseList.slice();
  if (cur && !list.includes(cur)) list.unshift(cur); // keep an existing student's course even if delisted
  sel.innerHTML = '<option value="">Select Course</option>' +
    list.map(c => `<option ${c === cur ? 'selected' : ''}>${escapeAttr(c)}</option>`).join('');
}

export async function addCourse() {
  const input = document.getElementById('new-course');
  const name = (input?.value || '').trim();
  if (!name) { showToast('Enter a course name', 'red'); return; }
  if (courseList.some(c => c.toLowerCase() === name.toLowerCase())) { showToast('Course already exists', 'amber'); return; }
  courseList.push(name);
  if (input) input.value = '';
  await saveCourses();
}

export async function removeCourse(idx) {
  if (courseList.length <= 1) { showToast('At least one course is required', 'amber'); return; }
  courseList.splice(idx, 1);
  await saveCourses();
}

async function saveCourses() {
  try {
    await api.put('/settings', { key: 'courses', value: courseList });
    showToast('Courses updated', 'green');
  } catch (err) {
    showToast(err.data?.message || err.message || 'Failed to save courses', 'red');
  }
  renderCourses();
  populateCourseSelect();
}

export async function initSettings() {
  renderThemeOptions(DEFAULT_THEMES);
  const savedTheme = localStorage.getItem(SELECTED_THEME_KEY) || 'default';
  applyTheme(savedTheme);

  try {
    const settings = await api.get('/settings');
    renderThemeOptions(settings.themes?.length ? settings.themes : DEFAULT_THEMES);

    if (Array.isArray(settings.fee_tiers) && settings.fee_tiers.length) {
      feeTiers = settings.fee_tiers;
    }
    if (Array.isArray(settings.courses) && settings.courses.length) {
      courseList = settings.courses;
    }
    populateCourseSelect();

    const theme = localStorage.getItem(SELECTED_THEME_KEY) || settings.theme || 'default';
    localStorage.setItem(SELECTED_THEME_KEY, theme);
    applyTheme(theme);
  } catch (err) {
    console.warn('Settings init failed, using defaults.', err);
  }
}
