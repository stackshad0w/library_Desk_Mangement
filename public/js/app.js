import { requireAuth, setupAuthUI, logout } from './modules/auth.js';
import { renderDashboard } from './modules/dashboard.js';
import { renderStudentTable, submitAdmission, resetForm, calcRemaining, deleteStudent, editStudent, goToPage, setFilter, debouncedSearch, showStudentDetails, toggleStudentStatus } from './modules/students.js';
import { renderFeeTable, openPaymentModal, closeModal, savePayment, calcNextDueDate } from './modules/fees.js';
import { customConfirm, closeConfirm } from './utils/helpers.js';
import { renderReminders } from './modules/reminders.js';
import { exportCSV, exportExcel, exportPDF } from './modules/export.js';
import { renderSettings, addFeeTier, removeFeeTier, initSettings } from './modules/settings.js';
import { initToast, showToast } from './utils/toast.js';

// Guard — redirect to login if not authenticated
if (!requireAuth()) throw new Error('Not authenticated');

initToast();
setupAuthUI();
initSettings();

// Page navigation
const titles = {
  reminders: 'Reminders', export: 'Export Data', statistics: 'Statistics',
  settings: 'Settings'
};

function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const pageEl = document.getElementById('page-' + id);
  if (pageEl) pageEl.classList.add('active');

  // Find and activate nav item
  document.querySelectorAll('.nav-item').forEach(n => {
    if (n.dataset.page === id) n.classList.add('active');
  });

  document.getElementById('page-title').textContent = titles[id] || id;

  // Close mobile sidebar
  document.querySelector('.sidebar')?.classList.remove('open');

  // Load page data
  if (id === 'statistics') renderDashboard();
  if (id === 'admissions') renderStudentTable();
  if (id === 'fees') renderFeeTable();
  if (id === 'reminders') renderReminders();
  if (id === 'settings') renderSettings();
  if (id === 'admission-form') {
    document.getElementById('f-admission-date').value = new Date().toISOString().split('T')[0];
    window.SwamiAbhyasika._editingId = null;
  }
}

// Mobile sidebar toggle
document.getElementById('menu-toggle')?.addEventListener('click', () => {
  document.querySelector('.sidebar')?.classList.toggle('open');
});

// Search
const searchInput = document.getElementById('global-search');
if (searchInput) {
  searchInput.addEventListener('input', (e) => debouncedSearch(e.target.value));
}

// Expose functions globally for onclick handlers in dynamic HTML
window.SwamiAbhyasika = {
  showPage,
  submitAdmission,
  resetForm,
  calcRemaining,
  deleteStudent,
  editStudent,
  showStudentDetails,
  toggleStudentStatus,
  openPaymentModal,
  closeModal,
  savePayment,
  calcNextDueDate,
  exportPDF,
  goToPage,
  setFilter,
  logout,
  customConfirm,
  closeConfirm,
  addFeeTier,
  removeFeeTier,
  autoUpdateAdmissionFee,
  _editingId: null,
};

// Wire up navigation
document.querySelectorAll('.nav-item[data-page]').forEach(item => {
  item.addEventListener('click', () => showPage(item.dataset.page));
});

// Wire up filter dropdowns
document.getElementById('filter-course')?.addEventListener('change', (e) => setFilter('course', e.target.value));
document.getElementById('filter-status')?.addEventListener('change', (e) => setFilter('status', e.target.value));
document.getElementById('fee-filter')?.addEventListener('change', () => renderFeeTable());

// Initial page load
showPage('dashboard');
