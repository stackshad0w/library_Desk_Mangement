import { api } from './api.js';
import { showToast } from '../utils/toast.js';
import { formatCurrency } from '../utils/helpers.js';

let feeTiers = [];

export async function renderSettings() {
  const list = document.getElementById('fee-tiers-list');
  if (!list) return;

  try {
    const settings = await api.get('/settings');
    feeTiers = settings.fee_tiers || [{ months: 1, fee: 1000 }];
    
    // Sort by months
    feeTiers.sort((a, b) => a.months - b.months);

    list.innerHTML = feeTiers.map((tier, idx) => `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 16px; background:var(--bg2); border:1px solid var(--border); border-radius:var(--radius-sm);">
        <div>
          <span style="font-weight:600; font-size:14px;">${tier.months} Month${tier.months > 1 ? 's' : ''}</span>
          <span style="color:var(--text3); margin:0 8px;">·</span>
          <span style="color:var(--green); font-weight:500;">${formatCurrency(tier.fee)}</span>
        </div>
        <button class="icon-btn" onclick="window.SwamiAbhyasika.removeFeeTier(${idx})" style="color:var(--red)">
          <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
        </button>
      </div>
    `).join('');
  } catch (err) {
    showToast('Failed to load settings', 'red');
  }
}

export async function addFeeTier() {
  const months = parseInt(document.getElementById('new-tier-months').value);
  const fee = parseFloat(document.getElementById('new-tier-fee').value);

  if (!months || !fee) {
    showToast('Please enter valid months and fee', 'red');
    return;
  }

  const existingIdx = feeTiers.findIndex(t => t.months === months);
  if (existingIdx > -1) {
    feeTiers[existingIdx].fee = fee;
  } else {
    feeTiers.push({ months, fee });
  }

  try {
    await api.put('/settings', { key: 'fee_tiers', value: feeTiers });
    showToast('Fee package added', 'green');
    document.getElementById('new-tier-months').value = '';
    document.getElementById('new-tier-fee').value = '';
    renderSettings();
  } catch (err) {
    showToast('Failed to save setting', 'red');
  }
}

export async function removeFeeTier(idx) {
  if (feeTiers[idx].months === 1) {
    showToast('1-month base rate cannot be removed', 'red');
    return;
  }
  
  feeTiers.splice(idx, 1);
  try {
    await api.put('/settings', { key: 'fee_tiers', value: feeTiers });
    showToast('Package removed', 'green');
    renderSettings();
  } catch (err) {
    showToast('Failed to save setting', 'red');
  }
}

export function getFeeForMonths(months) {
  if (!months || months < 1) return 0;
  
  // Try exact match
  const tier = feeTiers.find(t => t.months === months);
  if (tier) return tier.fee;

  // Fallback: 1-month rate * months
  const baseTier = feeTiers.find(t => t.months === 1) || { fee: 1000 };
  return baseTier.fee * months;
}

export async function initSettings() {
  try {
    const settings = await api.get('/settings');
    feeTiers = settings.fee_tiers || [{ months: 1, fee: 1000 }];
  } catch (err) {
    console.error('Settings init failed');
  }
}
