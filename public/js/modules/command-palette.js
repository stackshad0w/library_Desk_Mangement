import { api } from './api.js';
import { getInitials, formatCurrency, escapeHtml, debounce } from '../utils/helpers.js';

/**
 * Command Palette — keyboard-driven quick navigation + student search.
 * Ported from the single-file V16 build into the modular production app.
 * Open with Ctrl/Cmd-K (or the topbar chip). Arrow keys + Enter to act, Esc to close.
 */

const ACTIONS = [
  { icon: '➕', label: 'New Admission', sub: 'Add a new student',                  color: 'var(--accent2)', bg: 'var(--accent-bg)', page: 'admission-form' },
  { icon: '👥', label: 'Students',      sub: 'Browse all admitted students',        color: 'var(--accent2)', bg: 'var(--accent-bg)', page: 'admissions' },
  { icon: '💰', label: 'Fee Management', sub: 'Record payments & view dues',         color: 'var(--blue)',    bg: 'var(--blue-bg)',   page: 'fees' },
  { icon: '🔔', label: 'Reminders',     sub: 'Students with overdue or expiring fees', color: 'var(--red)',  bg: 'var(--red-bg)',    page: 'reminders' },
  { icon: '📊', label: 'Statistics',    sub: 'Fees, revenue & reports',             color: 'var(--green)',   bg: 'var(--green-bg)',  page: 'statistics' },
  { icon: '⬇️', label: 'Export Data',   sub: 'Download CSV, Excel or PDF',           color: 'var(--amber)',   bg: 'var(--amber-bg)',  page: 'export' },
  { icon: '⚙️', label: 'Settings',      sub: 'Fee tiers, theme & preferences',       color: 'var(--text2)',   bg: 'var(--bg4)',       page: 'settings' },
];

let _focusIdx = -1;
let _results = [];   // flat list mapping rendered .cmd-item -> { type, page|id }
let _seq = 0;        // guards against out-of-order async student results

function overlay() { return document.getElementById('cmd-overlay'); }
function isOpen() { return overlay()?.classList.contains('open'); }

export function openCommandPalette(prefill = '') {
  const ov = overlay();
  const input = document.getElementById('cmd-input');
  if (!ov || !input) return;
  ov.classList.add('open');
  input.value = prefill;
  _focusIdx = -1;
  runSearch(prefill);
  setTimeout(() => input.focus(), 50);
}

export function closeCommandPalette() {
  overlay()?.classList.remove('open');
  _focusIdx = -1;
  _results = [];
  _seq++; // invalidate any in-flight student fetch
}

function filterActions(ql) {
  return ql ? ACTIONS.filter(a => a.label.toLowerCase().includes(ql) || a.sub.toLowerCase().includes(ql)) : ACTIONS;
}

function highlighter(ql) {
  if (!ql) return (txt) => escapeHtml(String(txt ?? ''));
  const safe = ql.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp('(' + safe + ')', 'gi');
  return (txt) => escapeHtml(String(txt ?? '')).replace(re, '<mark class="cmd-mark">$1</mark>');
}

function render(q, students, loading) {
  const box = document.getElementById('cmd-results');
  if (!box) return;
  const ql = (q || '').toLowerCase().trim();
  const actions = filterActions(ql);
  const hl = highlighter(ql);
  _results = [];
  let html = '';

  if (actions.length) {
    html += `<div class="cmd-section-label">${ql ? 'Actions' : '⚡ Quick Actions'}</div>`;
    html += actions.map(a => {
      const idx = _results.push({ type: 'action', page: a.page }) - 1;
      return `<div class="cmd-item" data-idx="${idx}">
        <div class="cmd-item-icon" style="background:${a.bg};color:${a.color};">${a.icon}</div>
        <div class="cmd-item-main"><div class="cmd-item-title">${hl(a.label)}</div><div class="cmd-item-sub">${a.sub}</div></div>
      </div>`;
    }).join('');
  }

  html += `<div class="cmd-section-label">${ql ? 'Students' : '👥 Recent Students'}</div>`;
  if (loading) {
    html += '<div class="cmd-empty" style="padding:18px;">Searching…</div>';
  } else if (!students.length) {
    html += `<div class="cmd-empty">🔍 No students for <strong>"${escapeHtml(q)}"</strong></div>`;
  } else {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    html += students.map(s => {
      const idx = _results.push({ type: 'student', id: s.id }) - 1;
      const status = s.fee_status === 'Paid' ? 'Active' : (s.fee_status || 'Pending');
      const stColor = status === 'Active' ? 'var(--green)' : status === 'Overdue' ? 'var(--red)' : 'var(--amber)';
      const stBg = status === 'Active' ? 'var(--green-bg)' : status === 'Overdue' ? 'var(--red-bg)' : 'var(--amber-bg)';
      let dueText = 'No due date', dueOverdue = false;
      if (s.due_date) {
        const due = new Date(s.due_date); due.setHours(0, 0, 0, 0);
        const d = Math.round((due - today) / 86400000);
        dueOverdue = d < 0;
        dueText = d < 0 ? `${Math.abs(d)} days overdue` : d === 0 ? 'Expires today' : `${d} days left`;
      }
      const pending = Math.max(0, Number(s.total_fees || 0) - Number(s.paid_fees || 0));
      return `<div class="cmd-item" data-idx="${idx}">
        <div class="cmd-item-icon" style="background:var(--accent-bg);color:var(--accent2);font-size:13px;">${getInitials(s.name || '?')}</div>
        <div class="cmd-item-main">
          <div class="cmd-item-title" style="display:flex;align-items:center;gap:6px;">${hl(s.name)}<span class="cmd-id">${hl(s.id)}</span></div>
          <div class="cmd-item-sub">${hl(s.phone)} · ${hl(s.course || '')}</div>
        </div>
        <div style="text-align:right;flex-shrink:0;">
          <div class="cmd-item-badge" style="color:${stColor};background:${stBg};margin-bottom:3px;">${status}</div>
          <div style="font-size:10px;color:${dueOverdue ? 'var(--red)' : 'var(--text3)'};">${dueText}</div>
          ${pending > 0 ? `<div style="font-size:10px;color:var(--red);">${formatCurrency(pending)} due</div>` : ''}
        </div>
      </div>`;
    }).join('');
  }

  box.innerHTML = html;
}

const fetchStudents = debounce(async (q, seq) => {
  const ql = (q || '').toLowerCase().trim();
  const params = new URLSearchParams({ limit: ql ? 8 : 6 });
  if (ql) params.set('search', q.trim());
  try {
    const data = await api.get(`/students?${params}`);
    if (seq !== _seq) return; // a newer query superseded this one
    let students = data.students || [];
    if (!ql) students = students.filter(s => s.status !== 'inactive').slice(0, 6);
    render(q, students, false);
  } catch {
    if (seq !== _seq) return;
    render(q, [], false);
  }
}, 150);

function runSearch(q) {
  _focusIdx = -1;
  const seq = ++_seq;
  render(q, [], true);      // actions render instantly; students show a loader
  fetchStudents(q, seq);
}

function runResult(idx) {
  const r = _results[idx];
  if (!r) return;
  closeCommandPalette();
  if (r.type === 'action') window.SwamiAbhyasika.showPage(r.page);
  else if (r.type === 'student') window.SwamiAbhyasika.showStudentDetails(r.id);
}

function keyNav(e) {
  const items = document.querySelectorAll('.cmd-item');
  if (!items.length) return;
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    _focusIdx = Math.min(_focusIdx + 1, items.length - 1);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    _focusIdx = Math.max(_focusIdx - 1, 0);
  } else if (e.key === 'Enter') {
    e.preventDefault();
    const focused = document.querySelector('.cmd-item.focused');
    if (focused) focused.click();
    else if (items.length === 1) items[0].click();
    return;
  } else {
    return;
  }
  items.forEach((el, i) => el.classList.toggle('focused', i === _focusIdx));
  if (_focusIdx >= 0 && items[_focusIdx]) items[_focusIdx].scrollIntoView({ block: 'nearest' });
}

export function initCommandPalette() {
  const ov = overlay();
  const input = document.getElementById('cmd-input');
  const box = document.getElementById('cmd-results');
  if (!ov || !input || !box) return;

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      isOpen() ? closeCommandPalette() : openCommandPalette();
    } else if (e.key === 'Escape' && isOpen()) {
      closeCommandPalette();
    }
  });

  input.addEventListener('input', (e) => runSearch(e.target.value));
  input.addEventListener('keydown', keyNav);
  ov.addEventListener('click', (e) => { if (e.target === ov) closeCommandPalette(); });
  box.addEventListener('click', (e) => {
    const item = e.target.closest('.cmd-item');
    if (item && item.dataset.idx != null) runResult(Number(item.dataset.idx));
  });
}
