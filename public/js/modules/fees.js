import { api } from './api.js';
import { showToast } from '../utils/toast.js';
import { formatCurrency, getInitials, getColor, statusBadgeClass, getSubscriptionBalance } from '../utils/helpers.js';
import { PAYMENT_METHODS } from '../utils/constants.js';
import { getFeeForMonths } from './settings.js';
import { sendReceiptWA } from './whatsapp.js';

let payingStudentId = null;
let payingStudentGender = 'Male';
let payingStudentOriginalShift = 'Day';
let payingStudentPhone = '';
let payingStudentName = '';
let lastReceipt = null;

export async function renderFeeTable() {
  const filter = document.getElementById('fee-filter')?.value || '';
  const tbody = document.getElementById('fee-table');
  tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:30px"><div class="spinner" style="margin:0 auto"></div></td></tr>';

  try {
    const params = new URLSearchParams({ limit: 100 });
    if (filter) params.set('status', filter);
    const data = await api.get(`/students?${params}`);

    if (!data.students.length) {
      tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:30px;color:var(--text3)">No records found.</td></tr>';
      return;
    }

    tbody.innerHTML = data.students.map((s, i) => {
      const { balance, pct } = getSubscriptionBalance(s);
      const usagePct = pct;
      const statusLabel = s.fee_status === 'Paid' ? 'Active' : s.fee_status;
      const barColor = s.fee_status === 'Paid' ? 'var(--green)' : s.fee_status === 'Overdue' ? 'var(--red)' : 'var(--amber)';
      return `<tr>
        <td><div class="student-cell">
          <div class="avatar" style="background:${getColor(i)}20;color:${getColor(i)}">${getInitials(s.name)}</div>
          <div><div class="student-name">${s.name}</div><div class="student-id">${s.id}</div></div>
        </div></td>
        <td style="font-size:12px;color:var(--text2)">${s.course}</td>
        <td>${formatCurrency(s.total_fees)}</td>
        <td style="color:${balance > 0 ? 'var(--amber)' : 'var(--green)'}">${formatCurrency(balance)}</td>
        <td style="min-width:100px"><div class="progress-bar"><div class="progress-fill" style="width:${usagePct}%;background:${barColor}"></div></div><div style="font-size:11px;color:var(--text3);margin-top:3px">${usagePct}% used</div></td>
        <td style="font-size:12px;color:var(--text3)">${s.due_date || '—'}</td>
        <td><span class="status-pill ${statusBadgeClass(s.fee_status)}">${statusLabel}</span></td>
        <td><button class="btn btn-ghost" style="font-size:11px;padding:5px 10px" onclick="window.SwamiAbhyasika.openPaymentModal('${s.id}')">Pay</button></td>
      </tr>`;
    }).join('');
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:30px;color:var(--red)">Failed to load fee data</td></tr>';
  }
}

export async function openPaymentModal(id) {
  payingStudentId = id;
  try {
    const s = await api.get(`/students/${id}`);
    const { balance } = getSubscriptionBalance(s);
    document.getElementById('payment-student-info').innerHTML =
      `<strong>${s.name}</strong> (${s.id}) · ${s.course}<br>Total Fees: ${formatCurrency(s.total_fees)} · <span style="color:${balance > 0 ? 'var(--amber)' : 'var(--green)'}">Pending: ${formatCurrency(balance)}</span>`;
    document.getElementById('pay-amount').value = '';
    const periodFeeEl = document.getElementById('pay-period-fee');
    if (periodFeeEl) periodFeeEl.value = '';
    document.getElementById('pay-date').value = new Date().toISOString().split('T')[0];
    const nextDue = document.getElementById('pay-next-due-date');
    if (nextDue) nextDue.value = s.due_date || '';
    const fromDate = document.getElementById('pay-from-date');
    if (fromDate) fromDate.value = s.due_date || new Date().toISOString().split('T')[0];
    const months = document.getElementById('pay-months');
    if (months) months.value = '';
    document.querySelectorAll('#pay-month-chips .chip').forEach(c => c.classList.remove('active'));
    document.getElementById('pay-notes').value = '';
    document.getElementById('receipt-area').innerHTML = '';
    const shiftEl = document.getElementById('pay-shift');
    if (shiftEl) shiftEl.value = s.shift || 'Day';
    payingStudentGender = s.gender || 'Male';
    payingStudentOriginalShift = s.shift || 'Day';
    payingStudentPhone = s.phone || '';
    payingStudentName = s.name || '';

    document.getElementById('payment-modal').classList.add('open');
  } catch (err) {
    showToast('Failed to load student info', 'red');
  }
}

export function closeModal(id) {
  document.getElementById(id)?.classList.remove('open');
}

export async function savePayment() {
  const amount = parseFloat(document.getElementById('pay-amount').value);
  const periodFee = parseFloat(document.getElementById('pay-period-fee')?.value);
  const nextDueInput = document.getElementById('pay-next-due-date');
  const shift = document.getElementById('pay-shift')?.value;

  if (!amount || amount <= 0) { showToast('Enter a valid amount paid', 'red'); return; }
  if (!nextDueInput || !nextDueInput.value) {
    showToast('Please specify Next Due Date or Months', 'red');
    return;
  }
  if (!periodFee || periodFee <= 0) {
    showToast('Enter the subscription fee for this period', 'red');
    return;
  }

  try {
    // 1. Update student shift only if changed
    if (shift && shift !== payingStudentOriginalShift) {
      await api.put(`/students/${payingStudentId}`, { shift });
    }

    const payload = {
      student_id: payingStudentId,
      amount,
      period_fee: periodFee,
      payment_date: document.getElementById('pay-date').value,
      payment_method: document.getElementById('pay-method').value,
      notes: document.getElementById('pay-notes').value,
    };

    const nextDue = document.getElementById('pay-next-due-date');
    if (nextDue && nextDue.value) {
      payload.new_due_date = nextDue.value;
    }
    const fromDate = document.getElementById('pay-from-date');
    if (fromDate && fromDate.value) {
      payload.from_date = fromDate.value;
    }

    const data = await api.post('/payments', payload);

    lastReceipt = {
      ...data.receipt,
      phone: payingStudentPhone,
      name: payingStudentName || data.receipt?.studentName,
      fromDate: payload.from_date || null,
      dueDate: payload.new_due_date || null,
    };

    showToast('Payment recorded!', 'green');
    generateReceipt(lastReceipt);
    renderFeeTable();
  } catch (err) {
    showToast(err.message || 'Failed to record payment', 'red');
  }
}

function generateReceipt(r) {
  document.getElementById('receipt-area').innerHTML = `
    <div class="receipt">
      <div class="receipt-header">
        <div><div class="receipt-logo">Swami Abhyasika</div><div class="receipt-title">Fee Receipt</div></div>
        <div style="text-align:right;font-size:12px;color:var(--text3)">
          <div style="font-weight:600;color:var(--text)">${r.receiptNumber}</div>
          <div>${r.date}</div>
        </div>
      </div>
      <div class="receipt-row"><span style="color:var(--text3)">Student Name</span><span>${r.studentName}</span></div>
      <div class="receipt-row"><span style="color:var(--text3)">Student ID</span><span>${r.studentId}</span></div>
      <div class="receipt-row"><span style="color:var(--text3)">Course</span><span>${r.course}</span></div>
      <div class="receipt-row"><span style="color:var(--text3)">Payment Method</span><span>${r.method}</span></div>
      ${r.notes ? `<div class="receipt-row"><span style="color:var(--text3)">Notes</span><span>${r.notes}</span></div>` : ''}
      <div class="receipt-row"><span style="color:var(--text3)">Amount Paid</span><span style="color:var(--green)">${formatCurrency(r.amount)}</span></div>
      <div class="receipt-row"><span style="color:var(--text3)">Total Paid So Far</span><span>${formatCurrency(r.totalPaid)}</span></div>
      <div class="receipt-row total"><span>Remaining Balance</span><span>${formatCurrency(r.remaining)}</span></div>
    </div>
    <button class="btn btn-success wa-btn" style="width:100%;margin-top:12px" onclick="window.SwamiAbhyasika.sendReceiptWhatsApp()">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.945C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 018.413 3.488 11.824 11.824 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 001.519 5.26l-.999 3.648 3.97-1.607zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z"/></svg>
      Send Receipt on WhatsApp
    </button>`;
}

export function sendReceiptWhatsApp() {
  if (lastReceipt) sendReceiptWA(lastReceipt);
}

export function calcNextDueDate() {
  const fromDateVal = document.getElementById('pay-from-date')?.value;
  const monthsVal = parseInt(document.getElementById('pay-months')?.value);
  if (fromDateVal && !isNaN(monthsVal) && monthsVal > 0) {
    const date = new Date(fromDateVal);
    date.setMonth(date.getMonth() + monthsVal);
    document.getElementById('pay-next-due-date').value = date.toISOString().split('T')[0];

    // AUTO-CALCULATE FEE: fill the subscription fee for the period, and default the
    // amount paid to the full fee (the operator can lower it for a partial payment).
    const shift = document.getElementById('pay-shift')?.value || 'Day';
    const suggestedFee = getFeeForMonths(monthsVal, payingStudentGender, shift);
    const periodFeeInput = document.getElementById('pay-period-fee');
    if (periodFeeInput) periodFeeInput.value = suggestedFee;
    const amountInput = document.getElementById('pay-amount');
    if (amountInput) amountInput.value = suggestedFee;
  }
}

/** Quick-pick handler for the month chips in the payment modal. */
export function setPayMonths(n) {
  const monthsEl = document.getElementById('pay-months');
  if (monthsEl) monthsEl.value = n;
  document.querySelectorAll('#pay-month-chips .chip').forEach(c =>
    c.classList.toggle('active', Number(c.dataset.months) === Number(n)));
  calcNextDueDate();
}
