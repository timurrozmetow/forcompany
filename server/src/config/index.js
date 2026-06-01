'use strict';

const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

function required(name, fallback) {
  const val = process.env[name];
  if (val === undefined || val === '') {
    if (fallback !== undefined) return fallback;
    // eslint-disable-next-line no-console
    console.error(`[config] Missing required env var: ${name}`);
    process.exit(1);
  }
  return val;
}

function bool(name, fallback = false) {
  const v = process.env[name];
  if (v === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase());
}

function int(name, fallback) {
  const v = process.env[name];
  if (v === undefined || v === '') return fallback;
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? fallback : n;
}

const maxFileSizeGb = parseFloat(process.env.MAX_FILE_SIZE_GB || '10');

const config = {
  env: process.env.NODE_ENV || 'development',
  isProd: (process.env.NODE_ENV || 'development') === 'production',
  port: int('PORT', 5000),
  trustProxy: bool('TRUST_PROXY', false),

  db: {
    host: required('DB_HOST', 'localhost'),
    port: int('DB_PORT', 3306),
    user: required('DB_USER', 'root'),
    password: process.env.DB_PASSWORD || '',
    database: required('DB_NAME', 'company_drive'),
    connectionLimit: int('DB_CONNECTION_LIMIT', 10),
  },

  jwt: {
    secret: required('JWT_SECRET'),
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  bcryptRounds: int('BCRYPT_ROUNDS', 12),

  storage: {
    dir: path.resolve(required('STORAGE_DIR', path.join(process.cwd(), 'storage'))),
    maxFileSizeBytes: Math.floor(maxFileSizeGb * 1024 * 1024 * 1024),
    maxFileSizeGb,
  },

  cors: {
    // Comma separated allowlist. "*" disables origin checking (dev only).
    origins: (process.env.CORS_ORIGIN || '*')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  },

  // Warn (banner) when free disk drops below this fraction of total.
  lowSpaceWarnRatio: parseFloat(process.env.LOW_SPACE_WARN_RATIO || '0.1'),

  // Max bytes of extracted text stored per file for full-text search.
  fulltextMaxChars: int('FULLTEXT_MAX_CHARS', 200000),

  notify: {
    // Which activity actions trigger a notification (comma separated).
    events: (process.env.NOTIFY_EVENTS ||
      'create_user,delete_user,block_user,permanent_delete_file,permanent_delete_folder')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    telegram: {
      token: process.env.TELEGRAM_BOT_TOKEN || '',
      chatId: process.env.TELEGRAM_CHAT_ID || '',
    },
    email: {
      host: process.env.SMTP_HOST || '',
      port: int('SMTP_PORT', 587),
      secure: bool('SMTP_SECURE', false),
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || '',
      from: process.env.NOTIFY_EMAIL_FROM || process.env.SMTP_USER || '',
      to: process.env.NOTIFY_EMAIL_TO || '',
    },
  },
};

module.exports = config;
