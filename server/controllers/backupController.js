const { db } = require('../config/database');
const logger = require('../utils/logger');

// Tables included in a full backup (sessions are auth tokens — not backed up/restored).
const BACKUP_TABLES = ['users', 'students', 'settings', 'payments', 'seat_bookings', 'audit_logs'];
// Delete in child→parent order to satisfy foreign keys when restoring.
const DELETE_ORDER = ['audit_logs', 'sessions', 'payments', 'seat_bookings', 'students', 'settings', 'users'];

function tableColumns(table) {
  return db.prepare(`PRAGMA table_info(${table})`).all().map(r => r.name);
}

/**
 * GET /api/backup — download a full JSON snapshot of the database.
 */
function exportData(req, res) {
  const data = {};
  BACKUP_TABLES.forEach(t => { data[t] = db.prepare(`SELECT * FROM ${t}`).all(); });
  logger.info('Backup exported', { by: req.user.username });
  res.json({ version: 1, app: 'swami-abhyasika', exportedAt: new Date().toISOString(), data });
}

/**
 * POST /api/backup/restore — replace all data with the contents of a backup file.
 * Destructive: wipes current data first, then re-inserts, all in one transaction.
 */
function importData(req, res) {
  const data = req.body && req.body.data;
  if (!data || typeof data !== 'object') {
    return res.status(400).json({ message: 'Invalid backup file' });
  }

  const restore = db.transaction(() => {
    DELETE_ORDER.forEach(t => db.exec(`DELETE FROM ${t}`));
    BACKUP_TABLES.forEach(t => {
      const rows = Array.isArray(data[t]) ? data[t] : [];
      const known = new Set(tableColumns(t));
      rows.forEach(row => {
        // Only accept columns that actually exist on the table (guards against tampered files).
        const cols = Object.keys(row).filter(c => known.has(c));
        if (!cols.length) return;
        const placeholders = cols.map(() => '?').join(', ');
        db.prepare(`INSERT INTO ${t} (${cols.join(', ')}) VALUES (${placeholders})`).run(...cols.map(c => row[c]));
      });
    });
  });

  try {
    restore();
  } catch (err) {
    logger.error('Restore failed', { error: err.message, by: req.user.username });
    return res.status(400).json({ message: 'Restore failed: ' + err.message });
  }

  logger.warn('Database restored from backup', { by: req.user.username });
  res.json({ message: 'Backup restored successfully' });
}

module.exports = { exportData, importData };
