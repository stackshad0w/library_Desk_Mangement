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
  const map = { Paid: 'badge-green', Pending: 'badge-amber', Overdue: 'badge-red' };
  return map[status] || 'badge-amber';
}
