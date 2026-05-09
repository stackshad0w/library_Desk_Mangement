const crypto = require('crypto');
const os = require('os');
const path = require('path');

const isVercel = Boolean(process.env.VERCEL);
const fallbackJwtSecret = crypto.randomBytes(32).toString('hex');

function resolveWritablePath(configuredPath, localPath, tmpName) {
  if (configuredPath) {
    return path.resolve(configuredPath);
  }

  if (isVercel) {
    return path.join(os.tmpdir(), tmpName);
  }

  return path.resolve(localPath);
}

function getJwtSecret() {
  if (process.env.JWT_SECRET) {
    return process.env.JWT_SECRET;
  }

  if (process.env.NODE_ENV === 'production') {
    console.warn('JWT_SECRET is not set; using an ephemeral runtime secret.');
  }

  return fallbackJwtSecret;
}

module.exports = {
  isVercel,
  resolveWritablePath,
  getJwtSecret,
};
