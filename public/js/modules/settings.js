import { api } from './api.js';
import { showToast } from '../utils/toast.js';
import { formatCurrency } from '../utils/helpers.js';

export const DEFAULT_THEMES = [
  { id: 'default', label: 'Dark Default', bg: '#1a1a2e' },
  { id: 'warm', label: 'Warm Retro', bg: '#2a2010' },
  { id: 'light', label: 'Standard Light', bg: '#ffffff' },
  { id: 'sepia', label: 'Soft Sepia', bg: '#f5f0e8' },
  { id: 'cool', label: 'Cool Blue', bg: '#0d1b2a' },
];

const SELECTED_THEME_KEY = 'selectedTheme';
let feeTiers = [];

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
  const currentTheme = document.body.className.split(' ')
    .find(c => c.startsWith('theme-'))?.replace('theme-', '') || 'default';

  const lightThemes = ['light', 'sepia'];
  const darkThemes = ['default', 'warm', 'cool'];

  let newTheme;
  if (lightThemes.includes(currentTheme)) {
    newTheme = 'default'; // Switch to default dark
  } else {
    newTheme = 'light'; // Switch to standard light
  }

  setTheme(newTheme);
}

export function applyTheme(themeName) {
  // Remove all theme classes robustly
  document.body.className = document.body.className.split(' ')
    .filter(c => !c.startsWith('theme-'))
    .join(' ');

  if (themeName && themeName !== 'default') {
    document.body.classList.add(`theme-${themeName}`);
  }

  // Update toggle icon
  const lightIcon = document.getElementById('theme-toggle-light-icon');
  const darkIcon = document.getElementById('theme-toggle-dark-icon');

  if (lightIcon && darkIcon) {
    const isLight = ['light', 'sepia'].includes(themeName);
    if (isLight) {
      lightIcon.classList.add('hidden');
      darkIcon.classList.remove('hidden');
    } else {
      lightIcon.classList.remove('hidden');
      darkIcon.classList.add('hidden');
    }
  }

  highlightActiveTheme(themeName);
}

function highlightActiveTheme(themeName) {
  const activeTheme = themeName || 'default';
  document.querySelectorAll('.theme-option').forEach(opt => {
    const cardTheme = opt.dataset.theme;
    if (cardTheme === activeTheme) {
      opt.style.borderColor = 'var(--accent)';
      opt.style.background = 'var(--bg3)';
    } else {
      opt.style.borderColor = 'var(--border)';
      opt.style.background = 'transparent';
    }
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
  if (!list && !document.getElementById('theme-options-container')) return;

  renderThemeOptions(DEFAULT_THEMES);

  try {
    const settings = await api.get('/settings');
    const themes = settings.themes?.length ? settings.themes : DEFAULT_THEMES;
    renderThemeOptions(themes);
    feeTiers = settings.fee_tiers || [{ gender: 'Male', shift: 'Day', months: 1, fee: 1000 }];
    const savedTheme = localStorage.getItem(SELECTED_THEME_KEY) || settings.theme || 'default';
    localStorage.setItem(SELECTED_THEME_KEY, savedTheme);
    applyTheme(savedTheme);
    
    // Sort by shift, then gender, then months
    feeTiers.sort((a, b) => {
      if (a.shift !== b.shift) return a.shift.localeCompare(b.shift);
      if (a.gender !== b.gender) return a.gender.localeCompare(b.gender);
      return a.months - b.months;
    });

    if (!list) return;
    list.innerHTML = feeTiers.map((tier, idx) => `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 16px; background:var(--bg2); border:1px solid var(--border); border-radius:var(--radius-sm);">
        <div>
          <span class="status-pill badge-purple" style="font-size:10px; margin-right:8px;">${tier.shift}</span>
          <span style="font-weight:600; font-size:14px;">${tier.gender} · ${tier.months} Month${tier.months > 1 ? 's' : ''}</span>
          <span style="color:var(--text3); margin:0 8px;">·</span>
          <span style="color:var(--green); font-weight:500;">${formatCurrency(tier.fee)}</span>
        </div>
        <button class="icon-btn" onclick="window.SwamiAbhyasika.removeFeeTier(${idx})" style="color:var(--red)">
          <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
        </button>
      </div>
    `).join('');
  } catch (err) {
    feeTiers = [{ gender: 'Male', shift: 'Day', months: 1, fee: 1000 }];
    if (list) {
      list.innerHTML = feeTiers.map((tier, idx) => `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 16px; background:var(--bg2); border:1px solid var(--border); border-radius:var(--radius-sm);">
          <div>
            <span class="status-pill badge-purple" style="font-size:10px; margin-right:8px;">${tier.shift}</span>
            <span style="font-weight:600; font-size:14px;">${tier.gender} · ${tier.months} Month${tier.months > 1 ? 's' : ''}</span>
            <span style="color:var(--text3); margin:0 8px;">·</span>
            <span style="color:var(--green); font-weight:500;">${formatCurrency(tier.fee)}</span>
          </div>
        </div>
      `).join('');
    }
    console.warn('Could not load remote settings, using defaults.', err);
  }
}

export async function addFeeTier() {
  const gender = document.getElementById('new-tier-gender').value;
  const shift = document.getElementById('new-tier-shift').value;
  const months = parseInt(document.getElementById('new-tier-months').value);
  const fee = parseFloat(document.getElementById('new-tier-fee').value);

  if (!months || months < 1 || !Number.isInteger(months) || !fee || fee <= 0) {
    showToast('Please enter valid months (whole number ≥ 1) and fee (> 0)', 'red');
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
  if (feeTiers[idx].months === 1 && feeTiers[idx].gender === 'Male' && feeTiers[idx].shift === 'Day') {
    showToast('Base rate (Male/Day/1m) cannot be removed', 'red');
    return;
  }
  
  feeTiers.splice(idx, 1);
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
  
  // Try exact match (Gender + Shift + Months)
  let tier = feeTiers.find(t => t.months === months && t.gender === gender && t.shift === shift);
  if (tier) return tier.fee;

  // Fallback 1: Match Gender + Shift but use 1-month rate * months
  const baseRate = feeTiers.find(t => t.months === 1 && t.gender === gender && t.shift === shift);
  if (baseRate) return baseRate.fee * months;

  // Fallback 2: Universal 1-month base rate (Male/Day/1m) * months
  const universalBase = feeTiers.find(t => t.months === 1) || { fee: 1000 };
  return universalBase.fee * months;
}

export async function initSettings() {
  renderThemeOptions(DEFAULT_THEMES);
  const savedTheme = localStorage.getItem(SELECTED_THEME_KEY) || 'default';
  applyTheme(savedTheme);

  try {
    const settings = await api.get('/settings');
    renderThemeOptions(settings.themes?.length ? settings.themes : DEFAULT_THEMES);
    feeTiers = settings.fee_tiers || [{ gender: 'Male', shift: 'Day', months: 1, fee: 1000 }];
    const theme = localStorage.getItem(SELECTED_THEME_KEY) || settings.theme || 'default';
    localStorage.setItem(SELECTED_THEME_KEY, theme);
    applyTheme(theme);
  } catch (err) {
    feeTiers = [{ gender: 'Male', shift: 'Day', months: 1, fee: 1000 }];
    console.warn('Settings init failed, using defaults.', err);
  }
}
