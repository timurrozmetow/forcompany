'use strict';

const { verifyToken } = require('../utils/jwt');
const { queryOne } = require('../db/pool');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

function extractToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) {
    return header.slice(7).trim();
  }
  // Fallback for media tags that cannot set headers: ?token= for preview/download.
  if (req.query && typeof req.query.token === 'string' && req.query.token) {
    return req.query.token;
  }
  return null;
}

/**
 * Requires a valid JWT AND that the user still exists and is active.
 * Populates req.user = { id, username, role }.
 */
const authenticate = asyncHandler(async (req, res, next) => {
  const token = extractToken(req);
  if (!token) {
    throw AppError.unauthorized('Authentication required', 'NO_TOKEN');
  }

  let payload;
  try {
    payload = verifyToken(token);
  } catch (err) {
    throw AppError.unauthorized('Invalid or expired token', 'BAD_TOKEN');
  }

  const user = await queryOne(
    'SELECT id, username, role, is_active FROM users WHERE id = ? LIMIT 1',
    [payload.sub]
  );
  if (!user) throw AppError.unauthorized('User no longer exists', 'NO_USER');
  if (!user.is_active) throw AppError.forbidden('Account is blocked', 'BLOCKED');

  req.user = { id: user.id, username: user.username, role: user.role };
  next();
});

/**
 * Must run after authenticate. Rejects non-admin users.
 */
function requireAdmin(req, res, next) {
  if (!req.user) return next(AppError.unauthorized('Authentication required'));
  if (req.user.role !== 'admin') {
    return next(AppError.forbidden('Admin privileges required', 'NOT_ADMIN'));
  }
  next();
}

module.exports = { authenticate, requireAdmin, extractToken };
