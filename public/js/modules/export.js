import { api } from './api.js';
import { showToast } from '../utils/toast.js';

// Names/addresses are stored HTML-escaped on the server; decode them so files
// show "A & Sons", not "A &amp; Sons".
function decode(str) {
  const t = document.createElement('textarea');
  t.innerHTML = String(str ?? '');
  return t.value;
}

// Quote/escape a CSV cell and neutralise spreadsheet formula injection.
function csvEscape(value) {
  let s = decode(value);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

export async function exportCSV() {
  try {
    const data = await api.get('/export/students');
    if (!data.students.length) { showToast('No data to export', 'red'); return; }
    const headers = ['ID','Name','Parent','Phone','Email','Course','Gender','Shift','Admission Date','Total Fees','Paid','Remaining','Due Date','Status'];
    const rows = data.students.map(s => [s.id,s.name,s.parent_name,s.phone,s.email,s.course,s.gender||'Male',s.shift||'Day',s.admission_date,s.total_fees,s.paid_fees,s.remaining_fees,s.due_date,s.status]);
    const csv = [headers, ...rows].map(r => r.map(csvEscape).join(',')).join('\r\n');
    downloadFile('﻿' + csv, 'students.csv', 'text/csv');
    showToast('CSV exported!', 'green');
  } catch { showToast('Export failed', 'red'); }
}

export async function exportExcel() {
  try {
    const data = await api.get('/export/students');
    if (!data.students.length) { showToast('No data to export', 'red'); return; }
    const mapped = data.students.map(s => ({ ID: s.id, Name: decode(s.name), Parent: decode(s.parent_name), Phone: s.phone, Email: s.email, Course: decode(s.course), Gender: s.gender||'Male', Shift: s.shift||'Day', 'Admission Date': s.admission_date, 'Total Fees': s.total_fees, 'Paid Fees': s.paid_fees, Remaining: s.remaining_fees, 'Due Date': s.due_date, Status: s.status }));
    const ws = XLSX.utils.json_to_sheet(mapped);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Students');
    XLSX.writeFile(wb, 'SwamiAbhyasika_Students.xlsx');
    showToast('Excel exported!', 'green');
  } catch { showToast('Export failed', 'red'); }
}

export async function exportPDF() {
  try {
    const data = await api.get('/export/students');
    if (!data.students.length) { showToast('No data to export', 'red'); return; }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(18); doc.text('Swami Abhyasika — Student Report', 14, 18);
    doc.setFontSize(10); doc.text('Generated: ' + new Date().toLocaleDateString(), 14, 25);
    let y = 35;
    const headers = ['ID','Name','Course','Gender','Shift','Phone','Total','Paid','Rem','Status'];
    const colWidths = [24,36,38,18,16,32,22,22,22,18];
    doc.setFillColor(40,40,60); doc.rect(10, y-6, 277, 10, 'F');
    doc.setTextColor(255,255,255);
    let x = 14;
    headers.forEach((h,i) => { doc.text(h, x, y); x += colWidths[i]; });
    y += 6; doc.setTextColor(30,30,30);
    data.students.forEach((s, idx) => {
      if (y > 185) { doc.addPage(); y = 20; }
      if (idx%2===0) { doc.setFillColor(245,245,250); doc.rect(10,y-5,277,9,'F'); }
      const row = [s.id, decode(s.name).slice(0,18), decode(s.course).slice(0,18), s.gender||'M', s.shift||'Day', s.phone, '₹'+s.total_fees, '₹'+s.paid_fees, '₹'+s.remaining_fees, s.status];
      x = 14; row.forEach((cell,i) => { doc.text(String(cell), x, y); x += colWidths[i]; }); y += 9;
    });
    doc.save('SwamiAbhyasika_Report.pdf');
    showToast('PDF exported!', 'green');
  } catch { showToast('Export failed', 'red'); }
}

function downloadFile(content, filename, type) {
  const a = document.createElement('a');
  a.href = 'data:' + type + ';charset=utf-8,' + encodeURIComponent(content);
  a.download = filename; a.click();
}
