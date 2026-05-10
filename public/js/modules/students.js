import { api } from './api.js';
import { showToast } from '../utils/toast.js';
import { formatCurrency, getInitials, getColor, statusBadgeClass, debounce, getSubscriptionBalance } from '../utils/helpers.js';
import { ITEMS_PER_PAGE, COURSES } from '../utils/constants.js';
import { validateRequired, validatePhone, validateEmail, validatePositiveNumber, showFieldError, clearAllErrors } from '../utils/validation.js';

let currentPage = 1;
let currentSort = 'created_at';
let currentOrder = 'desc';
let currentCourse = '';
let currentStatus = '';
let currentSearch = '';

export async function renderStudentTable() {
  const tbody = document.getElementById('student-table');
  tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:30px"><div class="spinner" style="margin:0 auto"></div></td></tr>';

  try {
    const params = new URLSearchParams({
      page: currentPage, limit: ITEMS_PER_PAGE,
      sort: currentSort, order: currentOrder,
    });
    if (currentCourse) params.set('course', currentCourse);
    if (currentStatus) params.set('status', currentStatus);
    if (currentSearch) params.set('search', currentSearch);

    const data = await api.get(`/students?${params}`);
    const { students, pagination } = data;

    // Update course filter
    updateCourseFilter();

    if (!students.length) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:30px;color:var(--text3)">No students found.</td></tr>';
      renderPagination(pagination);
      return;
    }

    tbody.innerHTML = students.map((s, i) => {
      const statusLabel = s.fee_status === 'Paid' ? 'Active' : s.fee_status;
      return `<tr onclick="window.SwamiAbhyasika.showStudentDetails('${s.id}')" style="cursor:pointer">
        <td><div class="student-cell">
          <div class="avatar" style="background:${getColor(i)}20;color:${getColor(i)}">${getInitials(s.name)}</div>
          <div><div class="student-name">${s.name}</div><div class="student-id">${s.id}</div></div>
        </div></td>
        <td style="color:var(--text2)">${s.phone}</td>
        <td><span class="status-pill badge-purple">${s.course}</span></td>
        <td>${formatCurrency(s.total_fees)}</td>
        <td><span class="status-pill ${statusBadgeClass(s.fee_status)}">${statusLabel}</span></td>
        <td><div class="action-btns">
          <button class="icon-btn" onclick="event.stopPropagation(); window.SwamiAbhyasika.openPaymentModal('${s.id}')" title="Record Payment">
            <svg fill="currentColor" viewBox="0 0 24 24"><path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"/></svg>
          </button>
          <button class="icon-btn" onclick="event.stopPropagation(); window.SwamiAbhyasika.editStudent('${s.id}')" title="Edit">
            <svg fill="currentColor" viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
          </button>
          ${s.status === 'inactive' 
            ? `<button class="icon-btn" onclick="event.stopPropagation(); window.SwamiAbhyasika.toggleStudentStatus('${s.id}', 'active')" title="Reactivate" style="color:var(--green)"><svg fill="currentColor" viewBox="0 0 24 24"><path d="M13 3h-2v10h2V3zm4.83 2.17l-1.42 1.42C17.99 7.86 19 9.81 19 12c0 3.87-3.13 7-7 7s-7-3.13-7-7c0-2.19 1.01-4.14 2.58-5.42L6.17 5.17C4.23 6.82 3 9.26 3 12c0 4.97 4.03 9 9 9s9-4.03 9-9c0-2.74-1.23-5.18-3.17-6.83z"/></svg></button>`
            : `<button class="icon-btn" onclick="event.stopPropagation(); window.SwamiAbhyasika.toggleStudentStatus('${s.id}', 'inactive')" title="Deactivate" style="color:var(--amber)"><svg fill="currentColor" viewBox="0 0 24 24"><path d="M13 3h-2v10h2V3zm4.83 2.17l-1.42 1.42C17.99 7.86 19 9.81 19 12c0 3.87-3.13 7-7 7s-7-3.13-7-7c0-2.19 1.01-4.14 2.58-5.42L6.17 5.17C4.23 6.82 3 9.26 3 12c0 4.97 4.03 9 9 9s9-4.03 9-9c0-2.74-1.23-5.18-3.17-6.83z"/></svg></button>`
          }
          <button class="icon-btn" onclick="event.stopPropagation(); window.SwamiAbhyasika.deleteStudent('${s.id}')" title="Delete" style="color:var(--red)">
            <svg fill="currentColor" viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
          </button>
        </div></td>
      </tr>`;
    }).join('');

    renderPagination(pagination);
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:30px;color:var(--red)">Failed to load students</td></tr>';
    showToast('Failed to load students', 'red');
  }
}

async function updateCourseFilter() {
  try {
    const courses = await api.get('/students/courses');
    const sel = document.getElementById('filter-course');
    if (!sel) return;
    const cur = sel.value;
    sel.innerHTML = '<option value="">All Courses</option>' + courses.map(c => `<option ${c === cur ? 'selected' : ''}>${c}</option>`).join('');
  } catch {}
}

function renderPagination(pagination) {
  const container = document.getElementById('pagination');
  if (!container || !pagination) return;
  const { page, totalPages, total } = pagination;
  if (totalPages <= 1) { container.innerHTML = ''; return; }

  let html = `<button ${page <= 1 ? 'disabled' : ''} onclick="window.SwamiAbhyasika.goToPage(${page - 1})">← Prev</button>`;
  for (let i = 1; i <= Math.min(totalPages, 5); i++) {
    html += `<button class="${i === page ? 'active' : ''}" onclick="window.SwamiAbhyasika.goToPage(${i})">${i}</button>`;
  }
  if (totalPages > 5) html += `<span class="pagination-info">... ${totalPages}</span>`;
  html += `<button ${page >= totalPages ? 'disabled' : ''} onclick="window.SwamiAbhyasika.goToPage(${page + 1})">Next →</button>`;
  html += `<span class="pagination-info">${total} total</span>`;
  container.innerHTML = html;
}

export function goToPage(page) { currentPage = page; renderStudentTable(); }
export function setFilter(type, value) {
  if (type === 'course') currentCourse = value;
  if (type === 'status') currentStatus = value;
  currentPage = 1;
  renderStudentTable();
}
export function setSearch(value) {
  currentSearch = value;
  currentPage = 1;
  renderStudentTable();
}
export const debouncedSearch = debounce(setSearch, 300);

export async function submitAdmission() {
  const nameEl = document.getElementById('f-name');
  const phoneEl = document.getElementById('f-phone');
  const emailEl = document.getElementById('f-email');
  const courseEl = document.getElementById('f-course');
  const totalEl = document.getElementById('f-total-fees');
  const form = document.querySelector('.form-card');
  clearAllErrors(form);

  const errors = [];
  let err;
  if (err = validateRequired(nameEl.value, 'Name')) { showFieldError(nameEl, err); errors.push(err); }
  if (err = validatePhone(phoneEl.value)) { showFieldError(phoneEl, err); errors.push(err); }
  if (err = validateEmail(emailEl.value)) { showFieldError(emailEl, err); errors.push(err); }
  if (err = validateRequired(courseEl.value, 'Course')) { showFieldError(courseEl, err); errors.push(err); }
  if (err = validatePositiveNumber(totalEl.value, 'Total Fees')) { showFieldError(totalEl, err); errors.push(err); }
  if (!totalEl.value || parseFloat(totalEl.value) <= 0) { showFieldError(totalEl, 'Total fees required'); errors.push('fees'); }
  if (errors.length) return;

  try {
    const payload = {
      name: nameEl.value.trim(),
      parent_name: document.getElementById('f-parent').value.trim(),
      phone: phoneEl.value.trim(),
      email: emailEl.value.trim(),
      address: document.getElementById('f-address').value.trim(),
      course: courseEl.value,
      total_fees: parseFloat(totalEl.value),
      paid_fees: parseFloat(totalEl.value) || 0, // Fully paid subscription upfront
      gender: document.getElementById('f-gender').value,
      shift: document.getElementById('f-shift').value,
      admission_date: document.getElementById('f-admission-date').value || new Date().toISOString().split('T')[0],
      due_date: document.getElementById('f-due-date').value || null,
    };

    const editingId = window.SwamiAbhyasika._editingId;
    if (editingId) {
      await api.put(`/students/${editingId}`, payload);
      showToast('Student updated successfully!', 'green');
    } else {
      await api.post('/students', payload);
      showToast('Student admitted successfully!', 'green');
    }
    resetForm();
    window.SwamiAbhyasika._editingId = null;
    window.SwamiAbhyasika.showPage('admissions');
  } catch (err) {
    if (err.data?.errors) {
      err.data.errors.forEach(e => showToast(`${e.field}: ${e.message}`, 'red'));
    } else {
      showToast(err.message || 'Failed to save student', 'red');
    }
  }
}

export function resetForm() {
  ['f-name','f-parent','f-phone','f-email','f-address','f-total-fees','f-paid','f-remaining','f-payment-date','f-due-date','f-gender','f-shift'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = (id === 'f-gender') ? 'Male' : (id === 'f-shift' ? 'Day' : '');
  });
  const courseEl = document.getElementById('f-course');
  if (courseEl) courseEl.value = '';
  const monthsEl = document.getElementById('f-months');
  if (monthsEl) monthsEl.value = '1';
  document.getElementById('f-admission-date').value = new Date().toISOString().split('T')[0];
  setTimeout(() => window.SwamiAbhyasika.autoUpdateAdmissionFee(), 50);
}

export function calcRemaining() {
  // No-op: subscription model no longer tracks paid/remaining at admission
}

export async function deleteStudent(id) {
  const result = await window.SwamiAbhyasika.customConfirm('Delete this student? This action cannot be undone.', 'Delete Student', 'Delete', 'var(--red)');
  if (!result) return;
  try {
    await api.delete(`/students/${id}`);
    showToast('Student deleted', 'red');
    renderStudentTable();
  } catch (err) {
    showToast(err.message || 'Failed to delete', 'red');
  }
}

export async function editStudent(id) {
  try {
    document.getElementById('student-details-modal')?.classList.remove('active');
    const s = await api.get(`/students/${id}`);
    document.getElementById('f-name').value = s.name;
    document.getElementById('f-parent').value = s.parent_name || '';
    document.getElementById('f-phone').value = s.phone;
    document.getElementById('f-email').value = s.email || '';
    document.getElementById('f-address').value = s.address || '';
    document.getElementById('f-course').value = s.course;
    document.getElementById('f-total-fees').value = s.total_fees;
    document.getElementById('f-admission-date').value = s.admission_date;
    document.getElementById('f-due-date').value = s.due_date || '';
    document.getElementById('f-gender').value = s.gender || 'Male';
    document.getElementById('f-shift').value = s.shift || 'Day';
    document.getElementById('new-id').textContent = s.id;
    window.SwamiAbhyasika._editingId = id;
    window.SwamiAbhyasika.showPage('admission-form');
  } catch (err) {
    showToast('Failed to load student data', 'red');
  }
}

export async function showStudentDetails(id) {
  try {
    const s = await api.get(`/students/${id}`);
    const content = document.getElementById('student-details-content');
    const { balance, elapsed, totalMonths, perMonth } = getSubscriptionBalance(s);
    
    let avatarHtml = `<div class="avatar" style="width:64px;height:64px;font-size:24px;background:var(--accent-bg);color:var(--accent)">${getInitials(s.name)}</div>`;
    if (s.photo) {
      avatarHtml = `<img src="${s.photo}" style="width:64px;height:64px;border-radius:50%;object-fit:cover;" />`;
    }

    content.innerHTML = `
      <div style="display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:20px;">
        <div style="display:flex; align-items:center; gap:16px;">
          ${avatarHtml}
          <div>
            <h3 style="margin:0;font-size:18px;">${s.name}</h3>
            <p style="margin:2px 0;color:var(--text2)">${s.id}</p>
            <span class="status-pill ${statusBadgeClass(s.fee_status)}">${s.fee_status}</span>
          </div>
        </div>
        <div style="display:flex; gap: 8px;">
          <button class="btn btn-ghost" onclick="window.SwamiAbhyasika.editStudent('${s.id}')">Edit</button>
          ${s.status === 'inactive' 
            ? `<button class="btn btn-primary" onclick="window.SwamiAbhyasika.toggleStudentStatus('${s.id}', 'active')">Reactivate</button>`
            : `<button class="btn btn-ghost" style="color:var(--red);border:1px solid var(--red-bg)" onclick="window.SwamiAbhyasika.toggleStudentStatus('${s.id}', 'inactive')">Deactivate</button>`
          }
        </div>
      </div>
      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
        <div><strong>Gender:</strong> ${s.gender || 'Male'}</div>
        <div><strong>Study Shift:</strong> <span class="status-pill badge-purple">${s.shift || 'Day'}</span></div>
        <div><strong>Course:</strong> ${s.course}</div>
        <div><strong>Phone:</strong> ${s.phone}</div>
        <div><strong>Email:</strong> ${s.email || 'N/A'}</div>
        <div><strong>Admission Date:</strong> ${s.admission_date}</div>
        <div><strong>Conditions:</strong> ${s.conditions || s.parent_name || 'N/A'}</div>
        <div><strong>Address:</strong> ${s.address || 'N/A'}</div>
        <div><strong>Subscription:</strong> ${formatCurrency(s.total_fees)}</div>
        <div><strong>Monthly Rate:</strong> ${formatCurrency(perMonth)}/mo</div>
        <div><strong>Balance:</strong> <span style="color:${balance > 0 ? 'var(--green)' : 'var(--amber)'}">${formatCurrency(balance)}</span></div>
        <div><strong>Used:</strong> ${elapsed} of ${totalMonths} months</div>
        <div><strong>Due Date:</strong> ${s.due_date || 'N/A'}</div>
      </div>
      <div style="margin-top:24px;">
        <h4 style="margin:0 0 12px 0;font-size:14px;color:var(--text);border-bottom:1px solid var(--border);padding-bottom:8px;">Payment History</h4>
        ${(!s.payments || s.payments.length === 0) 
          ? '<div style="color:var(--text3);font-size:13px;text-align:center;padding:12px;background:var(--bg3);border-radius:var(--radius);">No payments recorded yet.</div>' 
          : `<div style="overflow-x:auto;"><table style="width:100%;font-size:13px;border-collapse:collapse;">
              <thead>
                <tr style="text-align:left;color:var(--text2);border-bottom:1px solid var(--border);">
                  <th style="padding:8px 4px;font-weight:500;">Date</th>
                  <th style="padding:8px 4px;font-weight:500;">Amount</th>
                  <th style="padding:8px 4px;font-weight:500;">Method</th>
                  <th style="padding:8px 4px;font-weight:500;">Notes</th>
                </tr>
              </thead>
              <tbody>
                ${s.payments.map(p => `
                  <tr style="border-bottom:1px solid var(--border);">
                    <td style="padding:8px 4px;">${p.payment_date || p.date}</td>
                    <td style="padding:8px 4px;color:var(--green);font-weight:500;">${formatCurrency(p.amount)}</td>
                    <td style="padding:8px 4px;">${p.payment_method || p.method}</td>
                    <td style="padding:8px 4px;color:var(--text3);">${p.notes || '-'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table></div>`
        }
      </div>
    `;
    document.getElementById('student-details-modal').classList.add('open');
  } catch (err) {
    showToast('Failed to load student details', 'red');
  }
}

export async function toggleStudentStatus(id, status) {
  const result = await window.SwamiAbhyasika.customConfirm(`Are you sure you want to mark this student as ${status}?`, 'Change Status', status === 'active' ? 'Reactivate' : 'Deactivate', status === 'active' ? 'var(--green)' : 'var(--amber)');
  if (!result) return;
  try {
    await api.put(`/students/${id}`, { status });
    showToast(`Student marked as ${status}`, 'green');
    document.getElementById('student-details-modal')?.classList.remove('open');
    renderStudentTable();
  } catch (err) {
    showToast('Failed to update status', 'red');
  }
}

export function autoUpdateAdmissionFee() {
  try {
    const monthsEl = document.getElementById('f-months');
    const months = monthsEl ? parseInt(monthsEl.value) || 1 : 1;
    const gender = document.getElementById('f-gender')?.value || 'Male';
    const shift = document.getElementById('f-shift')?.value || 'Day';
    
    if (window.SwamiAbhyasika.getFeeForMonths) {
      const fee = window.SwamiAbhyasika.getFeeForMonths(months, gender, shift);
      const totalEl = document.getElementById('f-total-fees');
      if (totalEl) {
        totalEl.value = fee;
        calcRemaining();
      }
      // Auto-calculate due date from admission date + months
      const admDateEl = document.getElementById('f-admission-date');
      const dueDateEl = document.getElementById('f-due-date');
      if (dueDateEl) {
        const admValue = (admDateEl && admDateEl.value) ? admDateEl.value : new Date().toISOString().split('T')[0];
        const dueDate = new Date(admValue);
        dueDate.setMonth(dueDate.getMonth() + months);
        dueDateEl.value = dueDate.toISOString().split('T')[0];
      }
    }
  } catch(e) {
    console.error('autoUpdateAdmissionFee error:', e);
  }
}

