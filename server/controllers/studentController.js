const { db } = require('../config/database');
const { generateId, generateStudentId, getFeeStatus, paginate, sanitize } = require('../utils/helpers');
const logger = require('../utils/logger');

/**
 * GET /api/students
 */
function getAll(req, res) {
  const { page, limit, offset } = paginate(req.query);
  const { course, status, search, sort, order } = req.query;

  let where = [];
  let params = [];

  if (course) {
    where.push('course = ?');
    params.push(course);
  }
  if (search) {
    where.push('(name LIKE ? OR phone LIKE ? OR id LIKE ? OR email LIKE ?)');
    const q = `%${search}%`;
    params.push(q, q, q, q);
  }

  const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

  // Get total count
  const countRow = db.prepare(`SELECT COUNT(*) as total FROM students ${whereClause}`).get(...params);
  const total = countRow.total;

  // Validate sort column
  const validSorts = ['name', 'course', 'admission_date', 'total_fees', 'paid_fees', 'created_at'];
  const sortCol = validSorts.includes(sort) ? sort : 'created_at';
  const sortOrder = order === 'asc' ? 'ASC' : 'DESC';

  const rows = db.prepare(
    `SELECT * FROM students ${whereClause} ORDER BY ${sortCol} ${sortOrder} LIMIT ? OFFSET ?`
  ).all(...params, limit, offset);

  // Enrich with fee status and filter by status if needed
  let enriched = rows.map(s => ({
    ...s,
    fee_status: getFeeStatus(s),
    remaining_fees: Math.max(0, s.total_fees - s.paid_fees),
  }));

  if (status) {
    enriched = enriched.filter(s => s.fee_status === status);
  }

  // Push Inactive to the end
  enriched.sort((a, b) => {
    if (a.fee_status === 'Inactive' && b.fee_status !== 'Inactive') return 1;
    if (a.fee_status !== 'Inactive' && b.fee_status === 'Inactive') return -1;
    return 0;
  });

  res.json({
    students: enriched,
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
  const { name, parent_name, phone, email, address, course, admission_date, due_date, total_fees, paid_fees, gender, shift } = req.body;

  const count = db.prepare('SELECT COUNT(*) as cnt FROM students').get().cnt;
  const id = generateStudentId(count);

  db.prepare(`
    INSERT INTO students (id, name, parent_name, phone, email, address, course, admission_date, due_date, total_fees, paid_fees, gender, shift, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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

  const { name, parent_name, phone, email, address, course, admission_date, due_date, total_fees, status, gender, shift } = req.body;

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
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    name ? sanitize(name) : null,
    parent_name ? sanitize(parent_name) : null,
    phone || null,
    email || null,
    address ? sanitize(address) : null,
    course || null,
    admission_date || null,
    due_date || null,
    total_fees || null,
    status || null,
    gender || null,
    shift || null,
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

  db.prepare('DELETE FROM students WHERE id = ?').run(req.params.id);

  // Audit log
  db.prepare(`
    INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, old_value, ip_address)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(generateId(), req.user.id, 'DELETE', 'student', req.params.id, JSON.stringify(existing), req.ip);

  logger.info('Student deleted', { studentId: req.params.id, by: req.user.username });
  res.json({ message: 'Student deleted successfully' });
}

/**
 * GET /api/students/courses
 */
function getCourses(req, res) {
  const courses = db.prepare('SELECT DISTINCT course FROM students ORDER BY course').all();
  res.json(courses.map(c => c.course));
}

module.exports = { getAll, getById, create, update, remove, getCourses };
