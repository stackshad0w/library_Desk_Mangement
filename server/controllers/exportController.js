const { db } = require('../config/database');
const { getFeeStatus } = require('../utils/helpers');

/**
 * GET /api/export/students?format=csv|xlsx|json
 * Returns data in JSON — frontend handles file generation using jsPDF/XLSX
 */
function exportStudents(req, res) {
  const students = db.prepare('SELECT * FROM students WHERE archived = 0 ORDER BY created_at DESC').all();

  const data = students.map(s => ({
    id: s.id,
    name: s.name,
    parent_name: s.parent_name,
    phone: s.phone,
    email: s.email,
    course: s.course,
    gender: s.gender,
    shift: s.shift,
    admission_date: s.admission_date,
    total_fees: s.total_fees,
    paid_fees: s.paid_fees,
    remaining_fees: Math.max(0, s.total_fees - s.paid_fees),
    due_date: s.due_date,
    status: getFeeStatus(s),
  }));

  res.json({ students: data, exportedAt: new Date().toISOString() });
}

/**
 * GET /api/export/payments
 */
function exportPayments(req, res) {
  const payments = db.prepare(`
    SELECT p.*, s.name as student_name, s.course
    FROM payments p
    JOIN students s ON p.student_id = s.id
    ORDER BY p.payment_date DESC
  `).all();

  res.json({ payments, exportedAt: new Date().toISOString() });
}

module.exports = { exportStudents, exportPayments };
