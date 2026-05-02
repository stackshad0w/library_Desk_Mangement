import { TOAST_DURATION } from './constants.js';

let toastEl, toastDot, toastMsg;

export function initToast() {
  // Create toast element if not exists
  if (!document.getElementById('toast')) {
    const html = `<div class="toast" id="toast"><div class="toast-dot" id="toast-dot"></div><span id="toast-msg"></span></div>`;
    document.body.insertAdjacentHTML('beforeend', html);
  }
  toastEl = document.getElementById('toast');
  toastDot = document.getElementById('toast-dot');
  toastMsg = document.getElementById('toast-msg');
}

const colors = { green: '#22c55e', red: '#ef4444', amber: '#f59e0b', blue: '#38bdf8' };

export function showToast(msg, type = 'green') {
  if (!toastEl) initToast();
  toastMsg.textContent = msg;
  toastDot.style.background = colors[type] || colors.green;
  toastEl.classList.add('show');
  setTimeout(() => toastEl.classList.remove('show'), TOAST_DURATION);
}
