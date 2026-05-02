const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../config/database');
const { generateId } = require('../utils/helpers');
const logger = require('../utils/logger');

const LOCKOUT_ATTEMPTS = parseInt(process.env.LOCKOUT_ATTEMPTS) || 5;
const LOCKOUT_MINUTES = parseInt(process.env.LOCKOUT_DURATION_MINUTES) || 15;

/**
 * POST /api/auth/register
 */
function register(req, res) {
  const { username, email, password, role } = req.body;

  const existing = db.prepare(
    'SELECT id FROM users WHERE username = ? OR email = ?'
  ).get(username, email);

  if (existing) {
    return res.status(409).json({ message: 'Username or email already exists' });
  }

  const rounds = parseInt(process.env.BCRYPT_ROUNDS) || 10;
  const passwordHash = bcrypt.hashSync(password, rounds);
  const id = generateId();

  db.prepare(`
    INSERT INTO users (id, username, email, password_hash, role)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, username, email, passwordHash, role || 'teacher');

  logger.info('User registered', { userId: id, username, role: role || 'teacher' });

  res.status(201).json({
    message: 'User registered successfully',
    user: { id, username, email, role: role || 'teacher' },
  });
}

/**
 * POST /api/auth/login
 */
function login(req, res) {
  const { username, password } = req.body;

  const user = db.prepare(
    'SELECT * FROM users WHERE username = ? OR email = ?'
  ).get(username, username);

  if (!user) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  // Check lockout
  if (user.locked_until) {
    const lockUntil = new Date(user.locked_until);
    if (lockUntil > new Date()) {
      const mins = Math.ceil((lockUntil - new Date()) / 60000);
      return res.status(423).json({
        message: `Account locked. Try again in ${mins} minute(s).`,
      });
    }
    // Lockout expired, reset
    db.prepare('UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = ?').run(user.id);
    user.failed_attempts = 0;
    user.locked_until = null;
  }

  if (!user.is_active) {
    return res.status(403).json({ message: 'Account is deactivated' });
  }

  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) {
    const attempts = (user.failed_attempts || 0) + 1;
    if (attempts >= LOCKOUT_ATTEMPTS) {
      const lockUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60000).toISOString();
      db.prepare('UPDATE users SET failed_attempts = ?, locked_until = ? WHERE id = ?')
        .run(attempts, lockUntil, user.id);
      logger.warn('Account locked due to failed attempts', { userId: user.id, username: user.username });
      return res.status(423).json({
        message: `Account locked for ${LOCKOUT_MINUTES} minutes due to too many failed attempts.`,
      });
    }
    db.prepare('UPDATE users SET failed_attempts = ? WHERE id = ?').run(attempts, user.id);
    return res.status(401).json({
      message: 'Invalid credentials',
      attemptsRemaining: LOCKOUT_ATTEMPTS - attempts,
    });
  }

  // Successful login — reset failed attempts
  db.prepare('UPDATE users SET failed_attempts = 0, locked_until = NULL, last_login = datetime(\'now\') WHERE id = ?')
    .run(user.id);

  // Generate tokens
  const token = jwt.sign({ userId: user.id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  });

  const refreshToken = jwt.sign({ userId: user.id, type: 'refresh' }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  });

  // Store session
  const sessionId = generateId();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  db.prepare(`
    INSERT INTO sessions (id, user_id, token, ip_address, user_agent, expires_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(sessionId, user.id, token, req.ip, req.get('User-Agent'), expiresAt);

  logger.info('User logged in', { userId: user.id, username: user.username });

  res.json({
    message: 'Login successful',
    token,
    refreshToken,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
    },
  });
}

/**
 * POST /api/auth/logout
 */
function logout(req, res) {
  db.prepare('DELETE FROM sessions WHERE token = ?').run(req.token);
  logger.info('User logged out', { userId: req.user.id });
  res.json({ message: 'Logged out successfully' });
}

/**
 * POST /api/auth/refresh-token
 */
function refreshToken(req, res) {
  const { refreshToken: rToken } = req.body;
  if (!rToken) {
    return res.status(400).json({ message: 'Refresh token required' });
  }

  try {
    const decoded = jwt.verify(rToken, process.env.JWT_SECRET);
    if (decoded.type !== 'refresh') {
      return res.status(400).json({ message: 'Invalid refresh token' });
    }

    const user = db.prepare('SELECT id, username, email, role, is_active FROM users WHERE id = ?')
      .get(decoded.userId);

    if (!user || !user.is_active) {
      return res.status(401).json({ message: 'User not found or inactive' });
    }

    const newToken = jwt.sign({ userId: user.id, role: user.role }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    });

    // Update session
    const sessionId = generateId();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    db.prepare(`
      INSERT INTO sessions (id, user_id, token, ip_address, user_agent, expires_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(sessionId, user.id, newToken, req.ip, req.get('User-Agent'), expiresAt);

    res.json({ token: newToken, user });
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired refresh token' });
  }
}

/**
 * GET /api/auth/me
 */
function getMe(req, res) {
  res.json({ user: req.user });
}

module.exports = { register, login, logout, refreshToken, getMe };
