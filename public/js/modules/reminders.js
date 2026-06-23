import { api } from './api.js';
import { showToast } from '../utils/toast.js';
import { formatCurrency, escapeHtml } from '../utils/helpers.js';
import { sendReminderWA } from './whatsapp.js';

let currentReminders = [];

export async function renderReminders() {
  const list = document.getElementById('reminders-list');
  list.innerHTML = '<div style="text-align:center;padding:30px"><div class="spinner" style="margin:0 auto"></div></div>';
  try {
    const data = await api.get('/dashboard/reminders');
    currentReminders = data.reminders || [];
    const badge = document.getElementById('reminder-badge');
    if (badge) badge.textContent = data.count;
    const bulkBtn = document.getElementById('bulk-remind-btn');
    if (bulkBtn) bulkBtn.style.display = currentReminders.length ? '' : 'none';
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
          <div style="font-weight:500;cursor:pointer" onclick="window.SwamiAbhyasika.showStudentDetails('${s.id}')" title="View student details">${escapeHtml(s.name)} <span style="color:var(--text3);font-size:12px">${escapeHtml(s.id)}</span></div>
          <div style="font-size:12px;color:var(--text3)">${msg}</div>
          <div style="font-size:11px;color:var(--text3)">${escapeHtml(s.phone)} · ${escapeHtml(s.course)}</div>
        </div>
        <div style="display:flex;align-items:center;gap:10px;flex-shrink:0">
          <span class="status-pill" style="background:${bg};color:${color}">${isOverdue ? 'Overdue' : 'Due Soon'}</span>
          <button class="btn btn-success wa-btn" style="font-size:11px;padding:6px 10px" onclick="window.SwamiAbhyasika.sendReminderWhatsApp('${s.id}')" title="Send WhatsApp reminder">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.945C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 018.413 3.488 11.824 11.824 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 001.519 5.26l-.999 3.648 3.97-1.607zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z"/></svg>
            WhatsApp
          </button>
        </div>
      </div>`;
    }).join('');
  } catch { list.innerHTML = '<div class="empty-state"><p>Failed to load reminders</p></div>'; }
}

export function sendReminderWhatsApp(id) {
  const s = currentReminders.find(r => r.id === id);
  if (s) sendReminderWA(s);
  else showToast('Reminder not found', 'red');
}

export function getCurrentReminders() {
  return currentReminders;
}

/* ---------- Bulk WhatsApp send ---------- */
let bulkRunning = false;
let bulkIndex = 0;

export function openBulkReminder() {
  if (!currentReminders.length) { showToast('No reminders to send', 'amber'); return; }
  const listEl = document.getElementById('bulk-list');
  listEl.innerHTML = currentReminders.map((s, i) => `
    <div class="bulk-row" id="bulk-row-${i}" style="display:flex;align-items:center;gap:10px;padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius-sm)">
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:500">${escapeHtml(s.name)}</div>
        <div style="font-size:11px;color:var(--text3)">${escapeHtml(s.phone)} · ${escapeHtml(s.course || '')}</div>
      </div>
      <span id="bulk-status-${i}" style="font-size:11px;color:var(--text3);flex-shrink:0">Queued</span>
    </div>`).join('');

  document.getElementById('bulk-progress-wrap').style.display = 'none';
  document.getElementById('bulk-progress-bar').style.width = '0%';
  document.getElementById('bulk-progress-label').textContent = 'Ready';
  document.getElementById('bulk-progress-eta').textContent = '';
  document.getElementById('bulk-footer-note').textContent = `${currentReminders.length} student(s) queued`;
  const sendBtn = document.getElementById('bulk-send-btn');
  sendBtn.disabled = false;
  sendBtn.textContent = 'Start Sending';
  sendBtn.style.background = '';
  sendBtn.style.borderColor = '';
  document.getElementById('bulk-reminder-modal').classList.add('open');
}

export function startBulkSend() {
  if (bulkRunning || !currentReminders.length) return;
  bulkRunning = true;
  bulkIndex = 0;
  const sendBtn = document.getElementById('bulk-send-btn');
  sendBtn.disabled = true;
  sendBtn.textContent = 'Sending…';
  document.getElementById('bulk-progress-wrap').style.display = '';
  bulkStep();
}

function bulkStep() {
  if (!bulkRunning) return;
  const list = currentReminders;
  const idx = bulkIndex;
  if (idx >= list.length) {
    const sendBtn = document.getElementById('bulk-send-btn');
    sendBtn.textContent = 'All Sent ✓';
    sendBtn.style.background = 'var(--green)';
    sendBtn.style.borderColor = 'var(--green)';
    document.getElementById('bulk-footer-note').textContent = `All ${list.length} reminders opened`;
    document.getElementById('bulk-progress-eta').textContent = '';
    bulkRunning = false;
    showToast(`Opened ${list.length} WhatsApp reminders`, 'green');
    return;
  }

  const s = list[idx];
  const rowEl = document.getElementById('bulk-row-' + idx);
  const statusEl = document.getElementById('bulk-status-' + idx);
  if (rowEl) rowEl.style.borderColor = 'var(--accent)';
  if (statusEl) { statusEl.textContent = 'Opening…'; statusEl.style.color = 'var(--accent2)'; }

  sendReminderWA(s);

  const done = idx + 1, total = list.length;
  document.getElementById('bulk-progress-bar').style.width = Math.round((done / total) * 100) + '%';
  document.getElementById('bulk-progress-label').textContent = `Sent ${done} / ${total}`;
  document.getElementById('bulk-progress-eta').textContent = (total - done) > 0 ? `${total - done} remaining` : '';

  setTimeout(() => {
    if (rowEl) rowEl.style.borderColor = 'var(--green)';
    if (statusEl) { statusEl.textContent = 'Sent ✓'; statusEl.style.color = 'var(--green)'; }
  }, 400);

  bulkIndex = idx + 1;
  setTimeout(bulkStep, 3000); // gap lets the operator press Send in each chat
}

export function closeBulkModal() {
  bulkRunning = false;
  document.getElementById('bulk-reminder-modal')?.classList.remove('open');
}
