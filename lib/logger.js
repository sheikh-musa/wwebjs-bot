// lib/logger.js - Logging utilities
const util = require('util');

// Log levels
const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

// Current log level - default to INFO in production, DEBUG otherwise
const currentLevel = process.env.LOG_LEVEL
  ? LOG_LEVELS[process.env.LOG_LEVEL.toUpperCase()] || LOG_LEVELS.INFO
  : process.env.NODE_ENV === 'production' ? LOG_LEVELS.INFO : LOG_LEVELS.DEBUG;

// Format log messages
function formatMessage(level, message, meta = null) {
  const timestamp = new Date().toISOString();
  let formattedMessage = `[${timestamp}] [${level}] ${message}`;
  
  if (meta) {
    if (typeof meta === 'object') {
      formattedMessage += ' ' + util.inspect(meta, { depth: 4, colors: false });
    } else {
      formattedMessage += ' ' + meta;
    }
  }
  
  return formattedMessage;
}

// Log error messages
function error(message, meta) {
  if (currentLevel >= LOG_LEVELS.ERROR) {
    console.error(formatMessage('ERROR', message, meta));
  }
}

// Log warning messages
function warn(message, meta) {
  if (currentLevel >= LOG_LEVELS.WARN) {
    console.warn(formatMessage('WARN', message, meta));
  }
}

// Log info messages
function info(message, meta) {
  if (currentLevel >= LOG_LEVELS.INFO) {
    console.log(formatMessage('INFO', message, meta));
  }
}

// Log debug messages
function debug(message, meta) {
  if (currentLevel >= LOG_LEVELS.DEBUG) {
    console.log(formatMessage('DEBUG', message, meta));
  }
}

module.exports = {
  error,
  warn,
  info,
  debug,
  LOG_LEVELS
};