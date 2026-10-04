const fs = require('fs');
const path = require('path');
const winston = require('winston');
require('winston-daily-rotate-file');

const logDir = path.resolve(process.cwd(), 'logs');

// Ensure log directory exists
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Sensitive fields to sanitize/redact from logs to prevent PII exposure (NFR-007)
const SENSITIVE_KEYS = [
  'password',
  'confirmPassword',
  'token',
  'refreshToken',
  'accessToken',
  'cvv',
  'creditCard',
];

const sanitizeMetadata = winston.format((info) => {
  const sanitize = (obj) => {
    if (!obj || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(sanitize);

    const copy = { ...obj };
    for (const key of Object.keys(copy)) {
      if (SENSITIVE_KEYS.some((sensitive) => key.toLowerCase().includes(sensitive.toLowerCase()))) {
        copy[key] = '[REDACTED]';
      } else if (typeof copy[key] === 'object') {
        copy[key] = sanitize(copy[key]);
      }
    }
    return copy;
  };

  return sanitize(info);
});

// Custom JSON format with ISO timestamp
const jsonFormat = winston.format.combine(
  sanitizeMetadata(),
  winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Colorized human-readable format for developer console
const consoleFormat = winston.format.combine(
  sanitizeMetadata(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(({ level, message, timestamp, stack }) => {
    return `[${timestamp}] ${level}: ${stack || message}`;
  })
);

// File transport for all combined logs (info, warn, error)
const combinedFileTransport = new winston.transports.DailyRotateFile({
  filename: path.join(logDir, 'combined-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '14d',
  format: jsonFormat,
  level: 'info',
});

// File transport dedicated to errors
const errorFileTransport = new winston.transports.DailyRotateFile({
  filename: path.join(logDir, 'error-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '30d',
  format: jsonFormat,
  level: 'error',
});

const transports = [combinedFileTransport, errorFileTransport];

// Add console transport (suppressed in test environment if needed)
if (process.env.NODE_ENV !== 'test') {
  transports.push(
    new winston.transports.Console({
      format: consoleFormat,
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    })
  );
} else {
  // Keep lightweight console in test to capture explicit warnings/errors if any
  transports.push(
    new winston.transports.Console({
      format: jsonFormat,
      level: 'error',
      silent: true,
    })
  );
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: jsonFormat,
  defaultMeta: { service: 'stackstorm-backend' },
  transports,
});

module.exports = {
  logger,
};
