const jwt = require('jsonwebtoken');
const { db } = require('../config/database');
const { getJwtSecret } = require('../config/runtime');
const logger = require('../utils/logger');

/**
 * JWT authentication middleware.
 * Verifies the token from Authorization header and attaches user to req.
 */
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, getJwtSecret());

    // Check if session exists and is not expired
    const session = db.prepare(
      'SELECT * FROM sessions WHERE token = ? AND expires_at > datetime(\'now\')'
    ).get(token);

    if (!session) {
      return res.status(401).json({ message: 'Session expired or invalid' });
    }

    // Get user
    const user = db.prepare(
      'SELECT id, username, email, role, is_active FROM users WHERE id = ?'
    ).get(decoded.userId);

    if (!user || !user.is_active) {
      return res.status(401).json({ message: 'Account is inactive or not found' });
    }

    req.user = user;
    req.token = token;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' });
    }
    logger.error('Auth middleware error', { error: err.message });
    return res.status(401).json({ message: 'Invalid token' });
  }
}

module.exports = { authenticate };
