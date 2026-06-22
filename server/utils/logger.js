const fs = require('fs');
const path = require('path');
const { resolveWritablePath } = require('../config/runtime');

const LOG_DIR = resolveWritablePath(process.env.LOG_DIR, './data/logs', 'edutrack-logs');
const LOG_RETENTION_DAYS = parseInt(process.env.LOG_RETENTION_DAYS, 10) || 30;
let fileLoggingEnabled = true;

// Delete daily log files older than the retention window so logs don't grow forever.
function pruneOldLogs() {
  const cutoff = Date.now() - LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  for (const file of fs.readdirSync(LOG_DIR)) {
    if (!file.endsWith('.log')) continue;
    try {
      if (fs.statSync(path.join(LOG_DIR, file)).mtimeMs < cutoff) {
        fs.unlinkSync(path.join(LOG_DIR, file));
      }
    } catch { /* ignore a file we can't stat/remove */ }
  }
}

try {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
  pruneOldLogs();
} catch (err) {
  fileLoggingEnabled = false;
  console.warn(`[WARN] File logging disabled: ${err.message}`);
}

const LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };
const currentLevel = LEVELS[process.env.LOG_LEVEL?.toUpperCase()] ?? LEVELS.INFO;

function formatTimestamp() {
  return new Date().toISOString();
}

function writeLog(level, message, meta = {}) {
  if (LEVELS[level] < currentLevel) return;

  const entry = {
    timestamp: formatTimestamp(),
    level,
    message,
    ...meta,
  };

  const line = JSON.stringify(entry);
  console.log(`[${level}] ${message}`);

  if (fileLoggingEnabled) {
    const logFile = path.join(LOG_DIR, `${new Date().toISOString().split('T')[0]}.log`);
    try {
      fs.appendFileSync(logFile, line + '\n');
    } catch (err) {
      fileLoggingEnabled = false;
      console.warn(`[WARN] File logging disabled: ${err.message}`);
    }
  }
}

const logger = {
  debug: (msg, meta) => writeLog('DEBUG', msg, meta),
  info: (msg, meta) => writeLog('INFO', msg, meta),
  warn: (msg, meta) => writeLog('WARN', msg, meta),
  error: (msg, meta) => writeLog('ERROR', msg, meta),
};

module.exports = logger;
