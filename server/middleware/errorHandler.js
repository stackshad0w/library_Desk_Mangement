const logger = require('../utils/logger');

/**
 * Global error handler middleware.
 * Sanitizes error messages in production — never leaks stack traces.
 */
function errorHandler(err, req, res, _next) {
  logger.error(err.message, {
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userId: req.user?.id,
  });

  if (err.name === 'ValidationError') {
    return res.status(400).json({ message: 'Validation error', errors: err.errors });
  }

  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({ message: 'Invalid token' });
  }

  if (err.code === 'SQLITE_CONSTRAINT') {
    return res.status(409).json({ message: 'A record with this data already exists' });
  }

  const statusCode = err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production'
    ? 'Internal server error'
    : err.message || 'Internal server error';

  res.status(statusCode).json({ message });
}

module.exports = { errorHandler };
