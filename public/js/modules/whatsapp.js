import { showToast } from '../utils/toast.js';

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
 * Build the reminder message body (exposed so the bulk sender can reuse it).
 */
export function reminderMessage(name, fromDate, dueDate, remaining, diffDays) {
  const periodLine = fromDate
    ? '🗓 Subscription Period: *' + fromDate + '* → *' + (dueDate || '—') + '*'
    : '🗓 Due Date: *' + (dueDate || '—') + '*';

  let statusLine;
  if (diffDays === null || diffDays === undefined) {
    statusLine = 'Your membership due date is not set. Please visit us to update your records.';
  } else if (diffDays < 0) {
    const n = Math.abs(diffDays);
    statusLine = '⚠️ Your membership has *expired ' + n + ' day' + (n !== 1 ? 's' : '') + ' ago*.';
  } else if (diffDays === 0) {
    statusLine = '⚠️ Your membership *expires TODAY*. Please renew immediately.';
  } else {
    statusLine = '⏳ Your membership is expiring in *' + diffDays + ' day' + (diffDays !== 1 ? 's' : '') + '*.';
  }

  const feeNote = remaining > 0
    ? '\n\n💰 *Pending Fees: ' + INR(remaining) + '*\nKindly clear your dues at the earliest to continue enjoying our facilities.'
    : '\n✅ Your fees are up to date.';

  return '🙏 Namaste *' + (name || '') + '*!\n\n' +
    'This is a gentle reminder from *Swami Abhyasika*.\n\n' +
    periodLine + '\n' + statusLine + feeNote + '\n\n' +
    'Please renew your membership or visit us to avoid any interruption in services.\n\n' +
    'Thank you 🙏\n*Swami Abhyasika — Center for Learning*';
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

/** Send a payment receipt. `r` is the receipt object plus { phone, fromDate, dueDate }. */
export function sendReceiptWA(r) {
  const num = waNumber(r.phone);
  const msg =
    '🙏 Namaste *' + (r.name || r.studentName || '') + '*!\n\n' +
    '🧾 *Fee Receipt — Swami Abhyasika*\n' +
    '━━━━━━━━━━━━━━━━━━\n' +
    '🧾 Receipt No: *' + (r.receiptNumber || '—') + '*\n' +
    '📅 Payment Date: *' + (r.date || '—') + '*\n' +
    (r.fromDate ? '📆 From Date: *' + r.fromDate + '*\n' : '') +
    (r.dueDate ? '📆 Valid Until: *' + r.dueDate + '*\n' : '') +
    '📚 Course: *' + (r.course || '—') + '*\n' +
    '💳 Payment Method: *' + (r.method || '—') + '*\n' +
    '💰 Amount Paid: *' + INR(r.amount) + '*\n \n' +
    '━━━━━━━━━━━━━━━━━━\n' +
    'Thank you for your payment! 🙏\n' +
    '*Swami Abhyasika — Center For Learning*';
  return openWa(num, msg);
}

/** Send a fee reminder for a student/reminder object (snake_case or camelCase). */
export function sendReminderWA(s) {
  const name = s.name || '';
  const dueDate = s.due_date || s.dueDate || '';
  const fromDate = s.from_date || s.fromDate || s.admission_date || s.admissionDate || '';
  const remaining = Number(
    s.remaining_fees ?? s.remaining ?? Math.max(0, Number(s.total_fees || 0) - Number(s.paid_fees || 0))
  );
  const num = waNumber(s.phone);
  return openWa(num, reminderMessage(name, fromDate, dueDate, remaining, daysUntilDue(s)));
}
