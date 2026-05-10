import { AVATAR_COLORS } from './constants.js';

export function getInitials(name) {
  return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
}

export function getColor(i) {
  return AVATAR_COLORS[i % AVATAR_COLORS.length];
}

export function formatCurrency(amount) {
  return '₹' + Number(amount || 0).toLocaleString('en-IN');
}

export function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

export function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

export function statusBadgeClass(status) {
  const map = { Paid: 'badge-green', Pending: 'badge-amber', Overdue: 'badge-red', Inactive: 'badge-gray' };
  return map[status] || 'badge-amber';
}

export function customConfirm(message, title = 'Confirm Action', btnText = 'Confirm', btnColor = 'var(--primary)') {
  return new Promise((resolve) => {
    window._confirmResolve = resolve;
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-message').textContent = message;
    
    const confirmBtn = document.getElementById('confirm-btn');
    confirmBtn.textContent = btnText;
    confirmBtn.style.background = btnColor;
    confirmBtn.style.borderColor = btnColor;
    
    document.getElementById('confirm-modal').classList.add('open');
  });
}

export function closeConfirm(result) {
  document.getElementById('confirm-modal').classList.remove('open');
  if (window._confirmResolve) {
    window._confirmResolve(result);
    window._confirmResolve = null;
  }
}

export function getSubscriptionBalance(s) {
  const admDate = s.admission_date || s.admissionDate;
  const dueDate = s.due_date || s.dueDate;
  const totalFees = s.total_fees || s.totalFees || 0;
  if (!admDate || !dueDate || !totalFees) return { balance: totalFees, elapsed: 0, totalMonths: 1, pct: 0, perMonth: totalFees };
  const start = new Date(admDate);
  const end = new Date(dueDate);
  const today = new Date();
  const totalMonths = Math.max(1, Math.round((end - start) / (30.44 * 24 * 60 * 60 * 1000)));
  const perMonth = totalFees / totalMonths;
  const msElapsed = Math.max(0, today - start);
  const monthsElapsed = Math.min(totalMonths, Math.floor(msElapsed / (30.44 * 24 * 60 * 60 * 1000)));
  const used = monthsElapsed * perMonth;
  const balance = Math.max(0, Math.round(totalFees - used));
  const pct = Math.min(100, Math.round((monthsElapsed / totalMonths) * 100));
  return { balance, elapsed: monthsElapsed, totalMonths, pct, perMonth: Math.round(perMonth) };
}
