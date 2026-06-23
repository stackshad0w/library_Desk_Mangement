import { showToast } from '../utils/toast.js';
import { getTemplates, fillTemplate } from './settings.js';

/**
 * WhatsApp integration — payment receipts and fee reminders via wa.me deep links.
 * Ported from the single-file V16 build. Opens the user's WhatsApp (web/app) with a
 * pre-filled message; no message is sent automatically — the operator presses send.
 */

const INR = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');

/** Normalise an Indian phone number to wa.me digits.
 *  Handles bare 10-digit numbers, a leading trunk 0 (0XXXXXXXXXX), and
 *  numbers already carrying the 91 / +91 country code. */
export function waNumber(phone) {
  let clean = String(phone || '').replace(/\D/g, '');
  if (!clean) return null;
  if (clean.length === 11 && clean.startsWith('0')) clean = clean.slice(1); // drop trunk 0
  if (clean.length === 10) clean = '91' + clean;
  return clean;
}

function openWa(num, text) {
  if (!num) { showToast('No valid phone number for this student', 'red'); return false; }
  window.open('https://wa.me/' + num + '?text=' + encodeURIComponent(text), '_blank');
  return true;
}

/**
 * Build the reminder message body from the configurable templates
 * (Settings → WhatsApp Message Templates). Overdue/today use the "overdue"
 * template; future due dates use the "due soon" template.
 */
export function reminderMessage(name, fromDate, dueDate, remaining, diffDays, course = '') {
  const t = getTemplates();
  const overdue = diffDays === null || diffDays === undefined || diffDays <= 0;
  const tpl = overdue ? t.reminder_overdue : t.reminder_due;
  return fillTemplate(tpl, {
    name: name || '',
    course: course || '',
    fromDate: fromDate || '—',
    dueDate: dueDate || '—',
    pending: INR(remaining),
    days: Math.abs(diffDays ?? 0),
  });
}

/** Derive the days-until-due figure from a student/reminder object. */
export function daysUntilDue(s) {
  if (s.days_until_due !== undefined && s.days_until_due !== null) return s.days_until_due;
  const dueDate = s.due_date || s.dueDate;
  if (!dueDate) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate); due.setHours(0, 0, 0, 0);
  return Math.round((due - today) / 86400000);
}

/** Send a payment receipt using the configurable receipt template.
 *  `r` is the receipt object plus { phone, fromDate, dueDate }. */
export function sendReceiptWA(r) {
  const num = waNumber(r.phone);
  const msg = fillTemplate(getTemplates().receipt, {
    name: r.name || r.studentName || '',
    receiptNumber: r.receiptNumber || '—',
    date: r.date || '—',
    fromDate: r.fromDate || '—',
    dueDate: r.dueDate || '—',
    course: r.course || '—',
    method: r.method || '—',
    amount: INR(r.amount),
  });
  return openWa(num, msg);
}

/** Send a fee reminder for a student/reminder object (snake_case or camelCase). */
export function sendReminderWA(s) {
  const name = s.name || '';
  const course = s.course || s.student_course || '';
  const dueDate = s.due_date || s.dueDate || '';
  const fromDate = s.from_date || s.fromDate || s.admission_date || s.admissionDate || '';
  const remaining = Number(
    s.remaining_fees ?? s.remaining ?? Math.max(0, Number(s.total_fees || 0) - Number(s.paid_fees || 0))
  );
  const num = waNumber(s.phone);
  return openWa(num, reminderMessage(name, fromDate, dueDate, remaining, daysUntilDue(s), course));
}
