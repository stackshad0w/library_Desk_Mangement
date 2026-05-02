import { api } from './api.js';
import { showToast } from '../utils/toast.js';
import { formatCurrency } from '../utils/helpers.js';

export async function renderReminders() {
  const list = document.getElementById('reminders-list');
  list.innerHTML = '<div style="text-align:center;padding:30px"><div class="spinner" style="margin:0 auto"></div></div>';
  try {
    const data = await api.get('/dashboard/reminders');
    const badge = document.getElementById('reminder-badge');
    if (badge) badge.textContent = data.count;
    if (!data.reminders.length) {
      list.innerHTML = '<div class="empty-state"><p>No reminders needed. All fees are up to date!</p></div>';
      return;
    }
    list.innerHTML = data.reminders.map(s => {
      const isOverdue = s.fee_status === 'Overdue';
      const msg = isOverdue ? `Overdue! ${formatCurrency(s.remaining_fees)} pending.`
        : s.days_until_due !== null ? `Due in ${s.days_until_due} day(s). ${formatCurrency(s.remaining_fees)} remaining.`
        : `Pending: ${formatCurrency(s.remaining_fees)}`;
      const color = isOverdue ? 'var(--red)' : 'var(--amber)';
      const bg = isOverdue ? 'var(--red-bg)' : 'var(--amber-bg)';
      return `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);padding:20px;margin-bottom:12px;display:flex;align-items:center;gap:14px">
        <div style="width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center;background:${bg}">
          <svg width="20" height="20" fill="${color}" viewBox="0 0 24 24"><path d="M12 22c1.1 0 2-.9 2-2h-4a2 2 0 002 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4a1.5 1.5 0 00-3 0v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/></svg>
        </div>
        <div style="flex:1">
          <div style="font-weight:500">${s.name} <span style="color:var(--text3);font-size:12px">${s.id}</span></div>
          <div style="font-size:12px;color:var(--text3)">${msg}</div>
          <div style="font-size:11px;color:var(--text3)">${s.phone} · ${s.course}</div>
        </div>
        <span class="status-pill" style="background:${bg};color:${color}">${isOverdue ? 'Overdue' : 'Due Soon'}</span>
      </div>`;
    }).join('');
  } catch { list.innerHTML = '<div class="empty-state"><p>Failed to load reminders</p></div>'; }
}
