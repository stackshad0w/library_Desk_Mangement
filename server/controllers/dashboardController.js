const { db } = require('../config/database');
const { getFeeStatus } = require('../utils/helpers');

/**
 * GET /api/dashboard/stats
 */
function getStats(req, res) {
  const totalStudents = db.prepare('SELECT COUNT(*) as cnt FROM students').get().cnt;

  // New this month
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const newThisMonth = db.prepare(
    'SELECT COUNT(*) as cnt FROM students WHERE admission_date >= ?'
  ).get(monthStart).cnt;

  // Fee totals
  const fees = db.prepare(
    'SELECT COALESCE(SUM(total_fees), 0) as total, COALESCE(SUM(paid_fees), 0) as collected FROM students'
  ).get();

  const pending = Math.max(0, fees.total - fees.collected);

  // Status breakdown
  const students = db.prepare('SELECT total_fees, paid_fees, due_date, status FROM students').all();
  let paidCount = 0, pendingCount = 0, overdueCount = 0;
  students.forEach(s => {
    const status = getFeeStatus(s);
    if (status === 'Paid') paidCount++;
    else if (status === 'Overdue') overdueCount++;
    else pendingCount++;
  });

  // Course distribution
  const courseData = db.prepare(
    'SELECT course, COUNT(*) as count FROM students GROUP BY course ORDER BY count DESC'
  ).all();

  // Recent admissions
  const recent = db.prepare(
    'SELECT id, name, course, admission_date, total_fees, paid_fees, due_date FROM students ORDER BY created_at DESC LIMIT 5'
  ).all().map(s => ({ ...s, fee_status: getFeeStatus(s) }));

  // Monthly revenue (last 6 months)
  const monthlyRevenue = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const start = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    const endStr = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;
    const rev = db.prepare(
      'SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE payment_date >= ? AND payment_date <= ?'
    ).get(start, endStr);
    monthlyRevenue.push({
      month: d.toLocaleString('default', { month: 'short', year: 'numeric' }),
      revenue: rev.total,
    });
  }

  res.json({
    totalStudents,
    newThisMonth,
    feesCollected: fees.collected,
    feesPending: pending,
    statusBreakdown: { paid: paidCount, pending: pendingCount, overdue: overdueCount },
    courseDistribution: courseData,
    recentAdmissions: recent,
    monthlyRevenue,
  });
}

/**
 * GET /api/reminders
 */
function getReminders(req, res) {
  const students = db.prepare('SELECT * FROM students').all();
  const today = new Date();
  const soon = new Date();
  soon.setDate(today.getDate() + 5);

  const reminders = students.filter(s => {
    const status = getFeeStatus(s);
    if (status === 'Paid') return false;
    if (!s.due_date) return status === 'Overdue';
    return new Date(s.due_date) <= soon;
  }).map(s => {
    const status = getFeeStatus(s);
    const remaining = Math.max(0, s.total_fees - s.paid_fees);
    const daysLeft = s.due_date ? Math.ceil((new Date(s.due_date) - today) / 86400000) : null;
    return { ...s, fee_status: status, remaining_fees: remaining, days_until_due: daysLeft };
  });

  res.json({ reminders, count: reminders.length });
}

module.exports = { getStats, getReminders };
