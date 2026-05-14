const { v4: uuidv4 } = require('uuid');

/**
 * Sanitize a string to prevent XSS
 */
function sanitize(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * Generate a unique receipt number
 */
function generateReceiptNumber() {
  return 'RCP-' + Date.now().toString().slice(-6) + '-' + Math.random().toString(36).slice(2, 5).toUpperCase();
}

/**
 * Generate a new student ID based on current count
 */
function generateStudentId(currentCount) {
  return 'STU-' + String(currentCount + 1).padStart(4, '0');
}

/**
 * Generate UUID
 */
function generateId() {
  return uuidv4();
}

/**
 * Calculate fee status for a student
 */
function getFeeStatus(student) {
  if (student.status === 'inactive') return 'Inactive';

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Check for overdue first
  if (student.due_date) {
    const due = new Date(student.due_date);
    due.setHours(0, 0, 0, 0);
    if (due < today) {
      const diffDays = (today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24);
      if (diffDays > 60) return 'Inactive';
      return 'Overdue';
    }
  }

  // Then check for debt
  const remaining = Math.round((student.total_fees - (student.paid_fees || 0)) * 100) / 100;
  if (remaining <= 0) return 'Paid';
  
  return 'Pending';
}

/**
 * Pagination helper — returns offset and sanitized page/limit
 */
function paginate(query) {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 20));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

module.exports = {
  sanitize,
  generateReceiptNumber,
  generateStudentId,
  generateId,
  getFeeStatus,
  paginate,
};
