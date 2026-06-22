const { db } = require('../config/database');
const { generateId, generateStudentId, getFeeStatus, paginate, sanitize } = require('../utils/helpers');
const logger = require('../utils/logger');

/**
 * GET /api/students
 */
function getAll(req, res) {
  const { page, limit, offset } = paginate(req.query);
  const { course, status, search, sort, order } = req.query;

  // Compute fee status in SQL so the status filter and pagination counts are correct
  // even past the first page (it mirrors helpers.getFeeStatus). `?` is bound to today.
  const today = new Date().toISOString().split('T')[0];
  const feeStatusSql = `CASE
      WHEN status = 'inactive' THEN 'Inactive'
      WHEN (total_fees - paid_fees) <= 0 THEN 'Paid'
      WHEN due_date IS NOT NULL AND due_date < ? THEN 'Overdue'
      ELSE 'Pending' END`;

  const archived = req.query.archived === '1' ? 1 : 0; // view active (0) or archived (1) students
  const inner = [`archived = ${archived}`];
  const innerParams = [];
  if (course) { inner.push('course = ?'); innerParams.push(course); }
  if (search) {
    inner.push('(name LIKE ? OR phone LIKE ? OR id LIKE ? OR email LIKE ?)');
    const q = `%${search}%`;
    innerParams.push(q, q, q, q);
  }
  const baseSubquery = `SELECT *, ${feeStatusSql} AS fee_status FROM students WHERE ${inner.join(' AND ')}`;
  const outerWhere = status ? 'WHERE fee_status = ?' : '';

  const validSorts = ['name', 'course', 'admission_date', 'total_fees', 'paid_fees', 'created_at'];
  const sortCol = validSorts.includes(sort) ? sort : 'created_at';
  const sortOrder = order === 'asc' ? 'ASC' : 'DESC';

  // The CASE (with its `today` param) is in the SELECT list, so `today` binds first.
  const filterParams = [today, ...innerParams, ...(status ? [status] : [])];

  const total = db.prepare(`SELECT COUNT(*) AS total FROM (${baseSubquery}) ${outerWhere}`).get(...filterParams).total;

  const rows = db.prepare(
    `SELECT * FROM (${baseSubquery}) ${outerWhere}
     ORDER BY (CASE WHEN status = 'inactive' THEN 1 ELSE 0 END), ${sortCol} ${sortOrder}
     LIMIT ? OFFSET ?`
  ).all(...filterParams, limit, offset);

  const students = rows.map(s => ({
    ...s,
    remaining_fees: Math.max(0, s.total_fees - s.paid_fees),
  }));

  res.json({
    students,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}

/**
 * GET /api/students/:id
 */
function getById(req, res) {
  const student = db.prepare('SELECT * FROM students WHERE id = ?').get(req.params.id);
  if (!student) {
    return res.status(404).json({ message: 'Student not found' });
  }

  const payments = db.prepare(
    'SELECT * FROM payments WHERE student_id = ? ORDER BY payment_date DESC'
  ).all(req.params.id);

  res.json({
    ...student,
    fee_status: getFeeStatus(student),
    remaining_fees: Math.max(0, student.total_fees - student.paid_fees),
    payments,
  });
}

/**
 * POST /api/students
 */
function create(req, res) {
  const { name, parent_name, phone, email, address, course, admission_date, due_date, total_fees, paid_fees, gender, shift, photo } = req.body;

  const validGenders = ['Male', 'Female', 'Other'];
  const validShifts = ['Day', 'Night', 'Both'];
  if (gender && !validGenders.includes(gender)) return res.status(400).json({ message: 'Invalid gender value' });
  if (shift && !validShifts.includes(shift)) return res.status(400).json({ message: 'Invalid shift value' });

  const lastIdRow = db.prepare("SELECT id FROM students WHERE id LIKE 'STU-%' ORDER BY CAST(SUBSTR(id, 5) AS INTEGER) DESC LIMIT 1").get();
  const id = generateStudentId(lastIdRow ? lastIdRow.id : null);

  db.prepare(`
    INSERT INTO students (id, name, parent_name, phone, email, address, course, admission_date, due_date, total_fees, paid_fees, gender, shift, photo, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    sanitize(name),
    sanitize(parent_name || ''),
    phone,
    email || '',
    sanitize(address || ''),
    course,
    admission_date || new Date().toISOString().split('T')[0],
    due_date || null,
    total_fees,
    paid_fees || 0,
    gender || 'Male',
    shift || 'Day',
    photo || null,
    req.user.id
  );

  // If initial payment, create a payment record
  if (paid_fees && paid_fees > 0) {
    const paymentId = generateId();
    const receiptNo = 'RCP-' + Date.now().toString().slice(-6);
    db.prepare(`
      INSERT INTO payments (id, student_id, amount, payment_date, payment_method, notes, receipt_number, processed_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(paymentId, id, paid_fees, admission_date || new Date().toISOString().split('T')[0], 'cash', 'Initial admission payment', receiptNo, req.user.id);
  }

  // Audit log
  db.prepare(`
    INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, new_value, ip_address)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(generateId(), req.user.id, 'CREATE', 'student', id, JSON.stringify({ name, course, total_fees }), req.ip);

  logger.info('Student created', { studentId: id, by: req.user.username });

  const student = db.prepare('SELECT * FROM students WHERE id = ?').get(id);
  res.status(201).json({
    message: 'Student added successfully',
    student: { ...student, fee_status: getFeeStatus(student) },
  });
}

/**
 * PUT /api/students/:id
 */
function update(req, res) {
  const existing = db.prepare('SELECT * FROM students WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ message: 'Student not found' });
  }

  const { name, parent_name, phone, email, address, course, admission_date, due_date, total_fees, status, gender, shift, photo } = req.body;

  const validGenders = ['Male', 'Female', 'Other'];
  const validShifts = ['Day', 'Night', 'Both'];
  if (gender && !validGenders.includes(gender)) return res.status(400).json({ message: 'Invalid gender value' });
  if (shift && !validShifts.includes(shift)) return res.status(400).json({ message: 'Invalid shift value' });

  db.prepare(`
    UPDATE students SET
      name = COALESCE(?, name),
      parent_name = COALESCE(?, parent_name),
      phone = COALESCE(?, phone),
      email = COALESCE(?, email),
      address = COALESCE(?, address),
      course = COALESCE(?, course),
      admission_date = COALESCE(?, admission_date),
      due_date = COALESCE(?, due_date),
      total_fees = COALESCE(?, total_fees),
      status = COALESCE(?, status),
      gender = COALESCE(?, gender),
      shift = COALESCE(?, shift),
      photo = COALESCE(?, photo),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    name ? sanitize(name) : null,
    parent_name ? sanitize(parent_name) : null,
    phone || null,
    email !== undefined ? email : null,
    address ? sanitize(address) : null,
    course || null,
    admission_date || null,
    due_date !== undefined ? due_date : null,
    total_fees !== undefined && total_fees !== null ? total_fees : null,
    status || null,
    gender || null,
    shift || null,
    photo !== undefined ? photo : null,
    req.params.id
  );

  // Audit log
  db.prepare(`
    INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, old_value, new_value, ip_address)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(generateId(), req.user.id, 'UPDATE', 'student', req.params.id, JSON.stringify(existing), JSON.stringify(req.body), req.ip);

  const updated = db.prepare('SELECT * FROM students WHERE id = ?').get(req.params.id);
  res.json({
    message: 'Student updated successfully',
    student: { ...updated, fee_status: getFeeStatus(updated) },
  });
}

/**
 * DELETE /api/students/:id
 */
function remove(req, res) {
  const existing = db.prepare('SELECT * FROM students WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ message: 'Student not found' });
  }

  // Soft-delete: archive the student so payment/receipt history is preserved
  // (a hard DELETE would cascade and wipe their financial records).
  db.prepare("UPDATE students SET archived = 1, status = 'inactive', updated_at = datetime('now') WHERE id = ?").run(req.params.id);

  // Audit log
  db.prepare(`
    INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, old_value, ip_address)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(generateId(), req.user.id, 'ARCHIVE', 'student', req.params.id, JSON.stringify(existing), req.ip);

  logger.info('Student archived', { studentId: req.params.id, by: req.user.username });
  res.json({ message: 'Student archived (records preserved)' });
}

/**
 * POST /api/students/:id/restore — un-archive a previously removed student.
 */
function restore(req, res) {
  const existing = db.prepare('SELECT id FROM students WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ message: 'Student not found' });
  }

  db.prepare("UPDATE students SET archived = 0, status = 'active', updated_at = datetime('now') WHERE id = ?").run(req.params.id);

  db.prepare(`
    INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, ip_address)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(generateId(), req.user.id, 'RESTORE', 'student', req.params.id, req.ip);

  logger.info('Student restored', { studentId: req.params.id, by: req.user.username });
  res.json({ message: 'Student restored' });
}

/**
 * GET /api/students/courses
 */
function getCourses(req, res) {
  const courses = db.prepare('SELECT DISTINCT course FROM students WHERE archived = 0 ORDER BY course').all();
  res.json(courses.map(c => c.course));
}

module.exports = { getAll, getById, create, update, remove, restore, getCourses };
