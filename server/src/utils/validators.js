'use strict';

const AppError = require('./AppError');

const USERNAME_RE = /^[a-zA-Z0-9_.-]{3,64}$/;
// Control chars (0x00-0x1f), path separators, and reserved Windows-ish chars.
// eslint-disable-next-line no-control-regex
const INVALID_NAME_RE = /[\x00-\x1f/\\<>:"|?*]/;

/**
 * Validate and normalize a folder/file display name. Rejects path separators,
 * control chars, reserved names. This name is ONLY stored in the DB; it never
 * touches the filesystem path (which uses UUIDs).
 */
function cleanEntityName(raw, label = 'Name') {
  if (typeof raw !== 'string') throw AppError.badRequest(`${label} is required`);
  const name = raw.trim();
  if (!name) throw AppError.badRequest(`${label} cannot be empty`);
  if (name.length > 255) throw AppError.badRequest(`${label} is too long (max 255)`);
  if (INVALID_NAME_RE.test(name)) {
    throw AppError.badRequest(`${label} contains invalid characters`);
  }
  if (name === '.' || name === '..') {
    throw AppError.badRequest(`${label} is reserved`);
  }
  return name;
}

function cleanUsername(raw) {
  if (typeof raw !== 'string') throw AppError.badRequest('Username is required');
  const username = raw.trim();
  if (!USERNAME_RE.test(username)) {
    throw AppError.badRequest('Username must be 3-64 chars: letters, digits, . _ -');
  }
  return username;
}

function checkPasswordStrength(raw) {
  if (typeof raw !== 'string' || raw.length < 8) {
    throw AppError.badRequest('Password must be at least 8 characters');
  }
  if (raw.length > 200) {
    throw AppError.badRequest('Password is too long');
  }
  return raw;
}

function parseRole(raw) {
  if (raw === undefined || raw === null) return 'user';
  if (raw !== 'admin' && raw !== 'user') {
    throw AppError.badRequest("Role must be 'admin' or 'user'");
  }
  return raw;
}

/**
 * Parse an optional id param: returns null for empty/"null"/"root", a positive
 * integer otherwise, or throws on garbage.
 */
function parseOptionalId(raw) {
  if (raw === undefined || raw === null || raw === '' || raw === 'null' || raw === 'root') {
    return null;
  }
  return parseId(raw);
}

function parseId(raw) {
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) {
    throw AppError.badRequest('Invalid id');
  }
  return n;
}

module.exports = {
  cleanEntityName,
  cleanUsername,
  checkPasswordStrength,
  parseRole,
  parseOptionalId,
  parseId,
};
