import { requireAuth, setupAuthUI, logout } from './modules/auth.js';
import { renderDashboard } from './modules/dashboard.js';
import { renderStudentTable, submitAdmission, resetForm, calcRemaining, deleteStudent, editStudent, goToPage, setFilter, debouncedSearch, showStudentDetails, toggleStudentStatus, autoUpdateAdmissionFee, onPhotoSelected, restoreStudent } from './modules/students.js';
import { renderFeeTable, openPaymentModal, closeModal, savePayment, calcNextDueDate, setPayMonths, sendReceiptWhatsApp, goToFeePage, filterFeeTable } from './modules/fees.js';
import { customConfirm, closeConfirm } from './utils/helpers.js';
import { renderReminders, sendReminderWhatsApp, openBulkReminder, startBulkSend, closeBulkModal } from './modules/reminders.js';
import { exportCSV, exportExcel, exportPDF } from './modules/export.js';
import { renderSettings, addFeeTier, removeFeeTier, initSettings, getFeeForMonths, setTheme, toggleTheme as toggleThemeSettings, addFloor, removeFloor, updateFloorField, saveSeatConfig, downloadBackup, triggerRestore, restoreBackup, renderUsers, addUser, changeUserRole, setUserActive, deleteUser, addCourse, removeCourse, populateCourseSelect, saveTemplates, resetTemplates } from './modules/settings.js';
import { initToast, showToast } from './utils/toast.js';
import { initTheme, toggleTheme as toggleThemeUtil } from './utils/theme.js';
import { initCommandPalette, openCommandPalette, closeCommandPalette } from './modules/command-palette.js';
import { initSeatMap, renderSeatMap, closeSeatModal } from './modules/seats.js';
import { initTooltips } from './utils/tooltip.js';

// Guard — redirect to login if not authenticated
if (!requireAuth()) throw new Error('Not authenticated');

initToast();
initTheme();
setupAuthUI();
initSettings();
initCommandPalette();
initSeatMap();
initTooltips();

// Page navigation
const titles = {
  dashboard: 'Dashboard', reminders: 'Reminders', export: 'Export Data',
  settings: 'Settings', seats: 'Library Seats'
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
  if (id === 'dashboard') renderDashboard();
  if (id === 'admissions') renderStudentTable();
  if (id === 'fees') renderFeeTable();
  if (id === 'reminders') renderReminders();
  if (id === 'settings') renderSettings();
  if (id === 'seats') renderSeatMap();
  if (id === 'admission-form') populateCourseSelect();
}

// "+ New" dropdown menu in the top bar.
function toggleNewMenu(e) {
  if (e) e.stopPropagation();
  document.getElementById('new-menu')?.classList.toggle('open');
}
function newAction(kind) {
  document.getElementById('new-menu')?.classList.remove('open');
  if (kind === 'student') {
    resetForm();
    window.SwamiAbhyasika._editingId = null;
    showPage('admission-form');
  } else if (kind === 'payment') {
    showPage('fees');
  } else if (kind === 'seat') {
    showPage('seats');
  }
}
// Close the menu when clicking anywhere else.
document.addEventListener('click', () => document.getElementById('new-menu')?.classList.remove('open'));

// Jump from the Library Seats page to the layout editor in Settings.
function editSeatLayout() {
  showPage('settings');
  setTimeout(() => {
    document.getElementById('seat-config-list')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 300);
}

// Mobile sidebar toggle
document.getElementById('menu-toggle')?.addEventListener('click', () => {
  document.querySelector('.sidebar')?.classList.toggle('open');
});

// Search
const searchInput = document.getElementById('global-search');
if (searchInput) {
  searchInput.addEventListener('input', (e) => {
    // Jump to the Students list so results are actually visible while typing.
    if (e.target.value.trim() && !document.getElementById('page-admissions')?.classList.contains('active')) {
      showPage('admissions');
    }
    debouncedSearch(e.target.value);
  });
}

// Expose functions globally for onclick handlers in dynamic HTML
window.SwamiAbhyasika = {
  showPage,
  editSeatLayout,
  toggleNewMenu,
  newAction,
  submitAdmission,
  resetForm,
  calcRemaining,
  deleteStudent,
  editStudent,
  showStudentDetails,
  toggleStudentStatus,
  restoreStudent,
  openPaymentModal,
  closeModal,
  savePayment,
  calcNextDueDate,
  setPayMonths,
  goToFeePage,
  exportPDF,
  exportCSV,
  exportExcel,
  goToPage,
  setFilter,
  logout,
  customConfirm,
  closeConfirm,
  addFeeTier,
  removeFeeTier,
  addFloor,
  removeFloor,
  updateFloorField,
  saveSeatConfig,
  downloadBackup,
  triggerRestore,
  restoreBackup,
  renderUsers,
  addUser,
  changeUserRole,
  setUserActive,
  deleteUser,
  addCourse,
  removeCourse,
  saveTemplates,
  resetTemplates,
  setTheme,
  toggleTheme: toggleThemeUtil,
  autoUpdateAdmissionFee,
  onPhotoSelected,
  getFeeForMonths,
  openCommandPalette,
  closeCommandPalette,
  sendReceiptWhatsApp,
  sendReminderWhatsApp,
  openBulkReminder,
  startBulkSend,
  closeBulkModal,
  _editingId: null,
};

// Command palette triggers
document.getElementById('cmd-trigger')?.addEventListener('click', () => openCommandPalette());
document.getElementById('cmd-close-btn')?.addEventListener('click', () => closeCommandPalette());

// Wire up navigation
document.querySelectorAll('.nav-item[data-page]').forEach(item => {
  item.addEventListener('click', () => {
    const page = item.dataset.page;
    if (page === 'admission-form') {
      resetForm();
      window.SwamiAbhyasika._editingId = null;
    }
    showPage(page);
  });
});

// Wire up filter dropdowns
document.getElementById('filter-course')?.addEventListener('change', (e) => setFilter('course', e.target.value));
document.getElementById('filter-status')?.addEventListener('change', (e) => setFilter('status', e.target.value));
document.getElementById('fee-filter')?.addEventListener('change', () => filterFeeTable());

// Initial page load
showPage('dashboard');
