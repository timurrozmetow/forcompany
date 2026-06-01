'use strict';

const { queryOne, execute } = require('../db/pool');
const { verifyPassword } = require('../utils/password');
const { signToken } = require('../utils/jwt');
const AppError = require('../utils/AppError');
const activityLog = require('./activityLog.service');

function publicUser(u) {
  return {
    id: u.id,
    username: u.username,
    role: u.role,
    isActive: !!u.is_active,
    createdAt: u.created_at,
    lastLoginAt: u.last_login_at ?? null,
  };
}

async function login({ username, password, context }) {
  // Generic error message to avoid user enumeration.
  const invalid = AppError.unauthorized('Invalid username or password', 'BAD_CREDENTIALS');

  const user = await queryOne(
    'SELECT id, username, password_hash, role, is_active, created_at, last_login_at FROM users WHERE username = ? LIMIT 1',
    [username]
  );
  if (!user) {
    // Still run a comparison-equivalent delay? bcrypt.compare on a dummy hash:
    await verifyPassword(password, '$2a$12$0000000000000000000000000000000000000000000000000000');
    throw invalid;
  }

  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) throw invalid;

  if (!user.is_active) {
    throw AppError.forbidden('Account is blocked', 'BLOCKED');
  }

  await execute('UPDATE users SET last_login_at = NOW() WHERE id = ?', [user.id]);

  const token = signToken({ sub: user.id, role: user.role, username: user.username });

  await activityLog.log({
    userId: user.id,
    action: activityLog.ACTIONS.LOGIN,
    targetType: 'auth',
    context,
  });

  return { token, user: publicUser(user) };
}

async function getMe(userId) {
  const user = await queryOne(
    'SELECT id, username, role, is_active, created_at, last_login_at FROM users WHERE id = ? LIMIT 1',
    [userId]
  );
  if (!user) throw AppError.notFound('User not found');
  return publicUser(user);
}

async function logout({ userId, context }) {
  await activityLog.log({
    userId,
    action: activityLog.ACTIONS.LOGOUT,
    targetType: 'auth',
    context,
  });
}

module.exports = { login, getMe, logout, publicUser };
