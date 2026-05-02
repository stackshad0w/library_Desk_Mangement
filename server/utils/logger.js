const fs = require('fs');
const path = require('path');

const LOG_DIR = path.resolve('./data/logs');
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
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

  const logFile = path.join(LOG_DIR, `${new Date().toISOString().split('T')[0]}.log`);
  fs.appendFileSync(logFile, line + '\n');
}

const logger = {
  debug: (msg, meta) => writeLog('DEBUG', msg, meta),
  info: (msg, meta) => writeLog('INFO', msg, meta),
  warn: (msg, meta) => writeLog('WARN', msg, meta),
  error: (msg, meta) => writeLog('ERROR', msg, meta),
};

module.exports = logger;
