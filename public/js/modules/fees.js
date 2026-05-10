import { api } from './api.js';
import { showToast } from '../utils/toast.js';
import { formatCurrency, getInitials, getColor, statusBadgeClass } from '../utils/helpers.js';
import { PAYMENT_METHODS } from '../utils/constants.js';

let payingStudentId = null;

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
      const rem = Math.max(0, s.total_fees - s.paid_fees);
      const pct = s.total_fees > 0 ? Math.round((s.paid_fees / s.total_fees) * 100) : 0;
      const barColor = s.fee_status === 'Paid' ? 'var(--green)' : s.fee_status === 'Overdue' ? 'var(--red)' : 'var(--amber)';
      return `<tr>
        <td><div class="student-cell">
          <div class="avatar" style="background:${getColor(i)}20;color:${getColor(i)}">${getInitials(s.name)}</div>
          <div><div class="student-name">${s.name}</div><div class="student-id">${s.id}</div></div>
        </div></td>
        <td style="font-size:12px;color:var(--text2)">${s.course}</td>
        <td>${formatCurrency(s.total_fees)}</td>
        <td style="color:var(--green)">${formatCurrency(s.paid_fees)}</td>
        <td style="color:var(--amber)">${formatCurrency(rem)}</td>
        <td style="min-width:100px"><div class="progress-bar"><div class="progress-fill" style="width:${pct}%;background:${barColor}"></div></div><div style="font-size:11px;color:var(--text3);margin-top:3px">${pct}%</div></td>
        <td style="font-size:12px;color:var(--text3)">${s.due_date || '—'}</td>
        <td><span class="status-pill ${statusBadgeClass(s.fee_status)}">${s.fee_status}</span></td>
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
    const rem = Math.max(0, s.total_fees - s.paid_fees);
    document.getElementById('payment-student-info').innerHTML =
      `<strong>${s.name}</strong> (${s.id}) · ${s.course}<br>Total: ${formatCurrency(s.total_fees)} · Paid: ${formatCurrency(s.paid_fees)} · <span style="color:var(--amber)">Remaining: ${formatCurrency(rem)}</span>`;
    document.getElementById('pay-amount').value = '';
    document.getElementById('pay-date').value = new Date().toISOString().split('T')[0];
    const nextDue = document.getElementById('pay-next-due-date');
    if (nextDue) nextDue.value = s.due_date || '';
    const fromDate = document.getElementById('pay-from-date');
    if (fromDate) fromDate.value = '';
    document.getElementById('pay-notes').value = '';
    document.getElementById('receipt-area').innerHTML = '';
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
  if (!amount || amount <= 0) { showToast('Enter a valid amount', 'red'); return; }

  try {
    const payload = {
      student_id: payingStudentId,
      amount,
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

    showToast('Payment recorded!', 'green');
    generateReceipt(data.receipt);
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
    </div>`;
}
