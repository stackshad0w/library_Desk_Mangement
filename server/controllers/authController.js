const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../config/database');
const { getJwtSecret } = require('../config/runtime');
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
  const token = jwt.sign({ userId: user.id, role: user.role }, getJwtSecret(), {
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  });

  const refreshToken = jwt.sign({ userId: user.id, type: 'refresh' }, getJwtSecret(), {
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
    const decoded = jwt.verify(rToken, getJwtSecret());
    if (decoded.type !== 'refresh') {
      return res.status(400).json({ message: 'Invalid refresh token' });
    }

    const user = db.prepare('SELECT id, username, email, role, is_active FROM users WHERE id = ?')
      .get(decoded.userId);

    if (!user || !user.is_active) {
      return res.status(401).json({ message: 'User not found or inactive' });
    }

    const newToken = jwt.sign({ userId: user.id, role: user.role }, getJwtSecret(), {
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

/**
 * GET /api/auth/users — list all staff accounts (admin only).
 */
function listUsers(req, res) {
  const users = db.prepare(
    'SELECT id, username, email, role, is_active, last_login, created_at FROM users ORDER BY created_at'
  ).all();
  res.json({ users });
}

/**
 * PUT /api/auth/users/:id — change a user's role or active flag (admin only).
 */
function updateUser(req, res) {
  const { id } = req.params;
  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!target) return res.status(404).json({ message: 'User not found' });

  const { role, is_active } = req.body;
  const validRoles = ['admin', 'teacher', 'accountant'];
  if (role !== undefined && !validRoles.includes(role)) {
    return res.status(400).json({ message: 'Invalid role' });
  }

  const willBeActive = is_active !== undefined ? (is_active ? 1 : 0) : target.is_active;
  const willBeRole = role !== undefined ? role : target.role;

  // Never strand the system without an admin.
  if (target.role === 'admin') {
    const activeAdmins = db.prepare("SELECT COUNT(*) c FROM users WHERE role='admin' AND is_active=1").get().c;
    const stillAdmin = willBeRole === 'admin' && willBeActive === 1;
    if (activeAdmins <= 1 && !stillAdmin) {
      return res.status(400).json({ message: 'Cannot demote or deactivate the last active admin' });
    }
  }
  if (id === req.user.id && willBeActive === 0) {
    return res.status(400).json({ message: 'You cannot deactivate your own account' });
  }

  db.prepare("UPDATE users SET role = COALESCE(?, role), is_active = COALESCE(?, is_active), updated_at = datetime('now') WHERE id = ?")
    .run(role || null, is_active !== undefined ? (is_active ? 1 : 0) : null, id);
  logger.info('User updated', { userId: id, by: req.user.username });
  res.json({ message: 'User updated' });
}

/**
 * DELETE /api/auth/users/:id — remove a staff account (admin only).
 */
function deleteUser(req, res) {
  const { id } = req.params;
  if (id === req.user.id) return res.status(400).json({ message: 'You cannot delete your own account' });

  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!target) return res.status(404).json({ message: 'User not found' });

  if (target.role === 'admin') {
    const activeAdmins = db.prepare("SELECT COUNT(*) c FROM users WHERE role='admin' AND is_active=1").get().c;
    if (activeAdmins <= 1) return res.status(400).json({ message: 'Cannot delete the last active admin' });
  }

  try {
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
  } catch {
    return res.status(409).json({ message: 'This user has created records. Deactivate them instead of deleting.' });
  }
  logger.info('User deleted', { userId: id, by: req.user.username });
  res.json({ message: 'User deleted' });
}

module.exports = { register, login, logout, refreshToken, getMe, listUsers, updateUser, deleteUser };
