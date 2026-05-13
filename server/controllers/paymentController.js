const { db } = require('../config/database');
const { generateId, generateReceiptNumber, getFeeStatus } = require('../utils/helpers');
const logger = require('../utils/logger');

/**
 * POST /api/payments
 */
function recordPayment(req, res) {
  const { student_id, amount, payment_date, payment_method, notes, new_due_date, from_date } = req.body;

  const student = db.prepare('SELECT * FROM students WHERE id = ?').get(student_id);
  if (!student) {
    return res.status(404).json({ message: 'Student not found' });
  }

  const paymentId = generateId();
  const receiptNumber = generateReceiptNumber();

  db.prepare(`
    INSERT INTO payments (id, student_id, amount, payment_date, payment_method, notes, receipt_number, processed_by, from_date, till_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(paymentId, student_id, amount, payment_date, payment_method, notes || '', receiptNumber, req.user.id, from_date || null, new_due_date || null);

  // Update student:
  // If it's a renewal (new_due_date provided), we increase total_fees (the bill) and paid_fees.
  // If it's just paying off debt, we ONLY increase paid_fees.
  if (new_due_date) {
    db.prepare('UPDATE students SET total_fees = total_fees + ?, paid_fees = paid_fees + ?, due_date = ?, status = \'active\', updated_at = datetime(\'now\') WHERE id = ?')
      .run(amount, amount, new_due_date, student_id);
  } else {
    db.prepare('UPDATE students SET paid_fees = paid_fees + ?, status = \'active\', updated_at = datetime(\'now\') WHERE id = ?')
      .run(amount, student_id);
  }

  // Audit log
  db.prepare(`
    INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, new_value, ip_address)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(generateId(), req.user.id, 'PAYMENT', 'payment', paymentId, JSON.stringify({ student_id, amount, payment_method }), req.ip);

  logger.info('Payment recorded', { paymentId, studentId: student_id, amount, by: req.user.username });

  // Return updated student + receipt info
  const updatedStudent = db.prepare('SELECT * FROM students WHERE id = ?').get(student_id);

  res.status(201).json({
    message: 'Payment recorded successfully',
    payment: {
      id: paymentId,
      student_id,
      amount,
      payment_date,
      payment_method,
      notes,
      receipt_number: receiptNumber,
      processed_by: req.user.id,
    },
    receipt: {
      receiptNumber,
      studentName: updatedStudent.name,
      studentId: updatedStudent.id,
      course: updatedStudent.course,
      amount,
      date: payment_date,
      method: payment_method,
      notes,
      totalPaid: updatedStudent.paid_fees,
      remaining: Math.max(0, updatedStudent.total_fees - updatedStudent.paid_fees),
      totalFees: updatedStudent.total_fees,
    },
    student: {
      ...updatedStudent,
      fee_status: getFeeStatus(updatedStudent),
      remaining_fees: Math.max(0, updatedStudent.total_fees - updatedStudent.paid_fees),
    },
  });
}

/**
 * GET /api/payments/:studentId
 */
function getStudentPayments(req, res) {
  const student = db.prepare('SELECT * FROM students WHERE id = ?').get(req.params.studentId);
  if (!student) {
    return res.status(404).json({ message: 'Student not found' });
  }

  const payments = db.prepare(
    'SELECT * FROM payments WHERE student_id = ? ORDER BY payment_date DESC'
  ).all(req.params.studentId);

  res.json({
    student: {
      id: student.id,
      name: student.name,
      course: student.course,
      total_fees: student.total_fees,
      paid_fees: student.paid_fees,
      remaining: Math.max(0, student.total_fees - student.paid_fees),
    },
    payments,
  });
}

/**
 * DELETE /api/payments/:id
 */
function deletePayment(req, res) {
  const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(req.params.id);
  if (!payment) {
    return res.status(404).json({ message: 'Payment not found' });
  }

  // Reverse the payment from student
  // We need to know if this payment originally increased total_fees.
  // Payments with till_date (new_due_date) are renewals.
  if (payment.till_date) {
    db.prepare('UPDATE students SET total_fees = total_fees - ?, paid_fees = paid_fees - ?, updated_at = datetime(\'now\') WHERE id = ?')
      .run(payment.amount, payment.amount, payment.student_id);
  } else {
    db.prepare('UPDATE students SET paid_fees = paid_fees - ?, updated_at = datetime(\'now\') WHERE id = ?')
      .run(payment.amount, payment.student_id);
  }

  db.prepare('DELETE FROM payments WHERE id = ?').run(req.params.id);

  // Audit log
  db.prepare(`
    INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, old_value, ip_address)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(generateId(), req.user.id, 'DELETE_PAYMENT', 'payment', req.params.id, JSON.stringify(payment), req.ip);

  logger.info('Payment deleted', { paymentId: req.params.id, by: req.user.username });
  res.json({ message: 'Payment deleted and reversed successfully' });
}

module.exports = { recordPayment, getStudentPayments, deletePayment };
