const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const { DatabaseSync } = require('node:sqlite');
const bcrypt = require('bcryptjs');
const { resolveWritablePath } = require('./runtime');

const DB_PATH = process.env.DB_PATH === ':memory:'
  ? ':memory:'
  : resolveWritablePath(process.env.DB_PATH, './data/edutrack.db', 'edutrack.db');
const dbDir = DB_PATH === ':memory:' ? null : path.dirname(DB_PATH);

if (dbDir && !fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

class AppDatabase {
  constructor(dbPath) {
    this.connection = new DatabaseSync(dbPath);
  }

  prepare(sql) {
    return this.connection.prepare(sql);
  }

  exec(sql) {
    return this.connection.exec(sql);
  }

  pragma(sql) {
    return this.exec(`PRAGMA ${sql}`);
  }

  transaction(fn) {
    return (...args) => {
      this.exec('BEGIN');
      try {
        const result = fn(...args);
        this.exec('COMMIT');
        return result;
      } catch (err) {
        this.exec('ROLLBACK');
        throw err;
      }
    };
  }
}

const db = new AppDatabase(DB_PATH);

// Enable WAL mode for better concurrent performance.
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initialize(options = {}) {
  const { seedDefaultAdmin = true } = options;

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT CHECK(role IN ('admin','teacher','accountant')) NOT NULL DEFAULT 'admin',
      is_active INTEGER DEFAULT 1,
      failed_attempts INTEGER DEFAULT 0,
      locked_until TEXT,
      last_login TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS students (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      parent_name TEXT,
      phone TEXT NOT NULL,
      email TEXT,
      address TEXT,
      course TEXT NOT NULL,
      admission_date TEXT NOT NULL,
      due_date TEXT,
      total_fees REAL NOT NULL,
      paid_fees REAL DEFAULT 0,
      status TEXT CHECK(status IN ('active','inactive','graduated')) DEFAULT 'active',
      created_by TEXT REFERENCES users(id),
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      student_id TEXT REFERENCES students(id) ON DELETE CASCADE,
      amount REAL NOT NULL,
      payment_date TEXT NOT NULL,
      payment_method TEXT CHECK(payment_method IN ('cash','online_transfer','cheque','upi','dd')) NOT NULL,
      notes TEXT,
      receipt_number TEXT UNIQUE,
      processed_by TEXT REFERENCES users(id),
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id),
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      old_value TEXT,
      new_value TEXT,
      ip_address TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      token TEXT UNIQUE NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_students_course ON students(course);
    CREATE INDEX IF NOT EXISTS idx_students_status ON students(status);
    CREATE INDEX IF NOT EXISTS idx_students_name ON students(name);
    CREATE INDEX IF NOT EXISTS idx_payments_student ON payments(student_id);
    CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date);
    CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
    CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
  `);

  return seedDefaultAdmin ? ensureDefaultAdmin() : false;
}

function ensureDefaultAdmin() {
  if (process.env.SEED_DEFAULT_ADMIN === 'false') {
    return false;
  }

  const existing = db.prepare('SELECT id FROM users LIMIT 1').get();
  if (existing) {
    return false;
  }

  const rounds = parseInt(process.env.BCRYPT_ROUNDS, 10) || 10;
  const username = process.env.ADMIN_USERNAME || 'admin';
  const email = process.env.ADMIN_EMAIL || 'admin@edutrack.local';
  const password = process.env.ADMIN_PASSWORD || 'admin123';
  const passwordHash = bcrypt.hashSync(password, rounds);

  db.prepare(`
    INSERT INTO users (id, username, email, password_hash, role)
    VALUES (?, ?, ?, ?, ?)
  `).run(randomUUID(), username, email, passwordHash, 'admin');

  if (!process.env.ADMIN_PASSWORD && process.env.NODE_ENV === 'production') {
    console.warn('Default admin password is active; set ADMIN_PASSWORD in production.');
  }

  return true;
}

module.exports = { db, initialize, ensureDefaultAdmin };
