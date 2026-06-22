const { db } = require('../config/database');
const { generateId } = require('../utils/helpers');
const logger = require('../utils/logger');

// Default layout (used until the owner customises it in Settings → Library Layout).
const DEFAULT_SEAT_CONFIG = {
  floors: [
    { id: 'basement', label: 'Basement', seats: 90, cols: 10 },
    { id: 'floor2', label: 'Floor 2', seats: 90, cols: 10 },
  ],
};

/** Read the configurable seat layout from settings, falling back to the default. */
function getSeatConfig() {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('seat_config');
  if (row) {
    try {
      const cfg = JSON.parse(row.value);
      if (cfg && Array.isArray(cfg.floors) && cfg.floors.length) return cfg;
    } catch { /* fall through to default */ }
  }
  return DEFAULT_SEAT_CONFIG;
}

/** Resolve a requested floor id to a configured floor (defaults to the first). */
function getFloorConfig(value) {
  const cfg = getSeatConfig();
  return cfg.floors.find(f => f.id === value) || cfg.floors[0];
}

function today() {
  return new Date().toISOString().split('T')[0];
}

/**
 * GET /api/seats?floor=basement&date=YYYY-MM-DD
 * Returns the active bookings for a floor (enriched with student info) plus occupancy counts.
 */
function getAll(req, res) {
  const cfg = getSeatConfig();
  const floorCfg = getFloorConfig(req.query.floor);
  const floor = floorCfg.id;
  const seatsOnFloor = floorCfg.seats;
  const date = req.query.date || today();

  // Auto-expire bookings whose subscription period has ended.
  db.prepare(
    `UPDATE seat_bookings SET status = 'expired'
     WHERE status = 'active' AND due_date IS NOT NULL AND due_date < ?`
  ).run(date);

  const bookings = db.prepare(`
    SELECT sb.*, s.name AS student_name, s.phone AS student_phone, s.course AS student_course
    FROM seat_bookings sb
    LEFT JOIN students s ON s.id = sb.student_id
    WHERE sb.floor = ? AND sb.status = 'active'
      AND sb.seat_number <= ?
      AND (sb.from_date IS NULL OR sb.from_date <= ?)
      AND (sb.due_date IS NULL OR sb.due_date >= ?)
    ORDER BY sb.seat_number
  `).all(floor, seatsOnFloor, date, date);

  res.json({
    floor,
    date,
    total: seatsOnFloor,
    cols: floorCfg.cols || 10,
    occupied: bookings.length,
    available: seatsOnFloor - bookings.length,
    bookings,
    floors: cfg.floors.map(f => ({ id: f.id, label: f.label, seats: f.seats, cols: f.cols || 10 })),
  });
}

/**
 * POST /api/seats — assign a seat to a student.
 */
function create(req, res) {
  const cfg = getSeatConfig();
  const floorCfg = cfg.floors.find(f => f.id === req.body.floor);
  if (!floorCfg) {
    return res.status(400).json({ message: 'Unknown floor' });
  }
  const floor = floorCfg.id;
  const seat_number = parseInt(req.body.seat_number, 10);
  const { student_id, slot, from_date, due_date } = req.body;

  if (!seat_number || seat_number < 1 || seat_number > floorCfg.seats) {
    return res.status(400).json({ message: `Invalid seat number (1–${floorCfg.seats} on ${floorCfg.label})` });
  }

  const student = db.prepare('SELECT id, name FROM students WHERE id = ?').get(student_id);
  if (!student) return res.status(404).json({ message: 'Student not found' });

  const periodStart = from_date || today();

  // Reject if the seat is already actively held over the requested period.
  const clash = db.prepare(`
    SELECT id FROM seat_bookings
    WHERE floor = ? AND seat_number = ? AND status = 'active'
      AND (due_date IS NULL OR due_date >= ?)
  `).get(floor, seat_number, periodStart);
  if (clash) return res.status(409).json({ message: `Seat ${seat_number} is already occupied` });

  // A student holds at most one active seat — release any previous one.
  db.prepare(`UPDATE seat_bookings SET status = 'cancelled' WHERE student_id = ? AND status = 'active'`).run(student_id);

  const id = generateId();
  db.prepare(`
    INSERT INTO seat_bookings (id, floor, seat_number, student_id, slot, from_date, due_date, status, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?)
  `).run(id, floor, seat_number, student_id, slot || 'Full Day', from_date || null, due_date || null, req.user.id);

  db.prepare(`
    INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, new_value, ip_address)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(generateId(), req.user.id, 'CREATE', 'seat_booking', id, JSON.stringify({ floor, seat_number, student_id }), req.ip);

  logger.info('Seat booked', { floor, seat: seat_number, student: student_id, by: req.user.username });

  const booking = db.prepare(`
    SELECT sb.*, s.name AS student_name, s.phone AS student_phone, s.course AS student_course
    FROM seat_bookings sb LEFT JOIN students s ON s.id = sb.student_id WHERE sb.id = ?
  `).get(id);
  res.status(201).json({ message: `Seat ${seat_number} booked for ${student.name}`, booking });
}

/**
 * DELETE /api/seats/:id — release (cancel) a booking.
 */
function remove(req, res) {
  const existing = db.prepare('SELECT * FROM seat_bookings WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ message: 'Booking not found' });

  db.prepare(`UPDATE seat_bookings SET status = 'cancelled' WHERE id = ?`).run(req.params.id);

  db.prepare(`
    INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, ip_address)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(generateId(), req.user.id, 'CANCEL', 'seat_booking', req.params.id, req.ip);

  logger.info('Seat released', { id: req.params.id, by: req.user.username });
  res.json({ message: 'Seat released' });
}

module.exports = { getAll, create, remove };
