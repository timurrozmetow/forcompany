'use strict';

const { query, queryOne, execute } = require('../db/pool');
const { hashPassword } = require('../utils/password');
const { cleanUsername, checkPasswordStrength, parseRole } = require('../utils/validators');
const AppError = require('../utils/AppError');
const activityLog = require('./activityLog.service');
const { publicUser } = require('./auth.service');

async function listUsers() {
  const rows = await query(
    `SELECT id, username, role, is_active, created_at, updated_at, last_login_at
       FROM users ORDER BY created_at ASC`
  );
  return rows.map(publicUser);
}

async function getUser(id) {
  const u = await queryOne(
    `SELECT id, username, role, is_active, created_at, last_login_at FROM users WHERE id = ?`,
    [id]
  );
  if (!u) throw AppError.notFound('User not found');
  return publicUser(u);
}

async function createUser({ username, password, role, actor, context }) {
  const cleanName = cleanUsername(username);
  checkPasswordStrength(password);
  const cleanRole = parseRole(role);

  const existing = await queryOne('SELECT id FROM users WHERE username = ? LIMIT 1', [cleanName]);
  if (existing) throw AppError.conflict('Username already taken', 'USERNAME_TAKEN');

  const hash = await hashPassword(password);
  const result = await execute(
    'INSERT INTO users (username, password_hash, role, is_active) VALUES (?, ?, ?, 1)',
    [cleanName, hash, cleanRole]
  );

  await activityLog.log({
    userId: actor.id,
    action: activityLog.ACTIONS.CREATE_USER,
    targetType: 'user',
    targetId: result.insertId,
    newValue: { username: cleanName, role: cleanRole },
    context,
  });

  return getUser(result.insertId);
}

async function updateUser({ id, username, role, isActive, actor, context }) {
  const existing = await queryOne('SELECT id, username, role, is_active FROM users WHERE id = ?', [id]);
  if (!existing) throw AppError.notFound('User not found');

  const updates = [];
  const params = [];
  const newValue = {};

  if (username !== undefined) {
    const cleanName = cleanUsername(username);
    if (cleanName !== existing.username) {
      const dupe = await queryOne('SELECT id FROM users WHERE username = ? AND id <> ? LIMIT 1', [cleanName, id]);
      if (dupe) throw AppError.conflict('Username already taken', 'USERNAME_TAKEN');
    }
    updates.push('username = ?');
    params.push(cleanName);
    newValue.username = cleanName;
  }

  if (role !== undefined) {
    const cleanRole = parseRole(role);
    // Prevent removing the last admin.
    if (existing.role === 'admin' && cleanRole !== 'admin') {
      await assertNotLastAdmin(id);
    }
    updates.push('role = ?');
    params.push(cleanRole);
    newValue.role = cleanRole;
  }

  if (isActive !== undefined) {
    const active = isActive ? 1 : 0;
    if (!active && existing.role === 'admin') {
      await assertNotLastAdmin(id);
    }
    updates.push('is_active = ?');
    params.push(active);
    newValue.isActive = !!active;
  }

  if (!updates.length) return getUser(id);

  params.push(id);
  await execute(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);

  await activityLog.log({
    userId: actor.id,
    action: activityLog.ACTIONS.UPDATE_USER,
    targetType: 'user',
    targetId: id,
    oldValue: { username: existing.username, role: existing.role, isActive: !!existing.is_active },
    newValue,
    context,
  });

  return getUser(id);
}

async function changePassword({ id, password, actor, context }) {
  checkPasswordStrength(password);
  const existing = await queryOne('SELECT id FROM users WHERE id = ?', [id]);
  if (!existing) throw AppError.notFound('User not found');

  const hash = await hashPassword(password);
  await execute('UPDATE users SET password_hash = ? WHERE id = ?', [hash, id]);

  await activityLog.log({
    userId: actor.id,
    action: activityLog.ACTIONS.UPDATE_USER,
    targetType: 'user',
    targetId: id,
    newValue: { passwordChanged: true },
    context,
  });

  return { success: true };
}

async function setBlocked({ id, blocked, actor, context }) {
  const existing = await queryOne('SELECT id, role, is_active FROM users WHERE id = ?', [id]);
  if (!existing) throw AppError.notFound('User not found');

  const active = blocked ? 0 : 1;
  if (blocked && existing.role === 'admin') {
    await assertNotLastAdmin(id);
  }

  await execute('UPDATE users SET is_active = ? WHERE id = ?', [active, id]);

  await activityLog.log({
    userId: actor.id,
    action: activityLog.ACTIONS.BLOCK_USER,
    targetType: 'user',
    targetId: id,
    oldValue: { isActive: !!existing.is_active },
    newValue: { isActive: !!active },
    context,
  });

  return getUser(id);
}

async function deleteUser({ id, actor, context }) {
  const existing = await queryOne('SELECT id, username, role FROM users WHERE id = ?', [id]);
  if (!existing) throw AppError.notFound('User not found');
  if (Number(id) === Number(actor.id)) {
    throw AppError.badRequest('You cannot delete your own account', 'SELF_DELETE');
  }
  if (existing.role === 'admin') {
    await assertNotLastAdmin(id);
  }

  // files/folders have ON DELETE RESTRICT for creator/uploader -> block if owns data.
  const owns = await queryOne(
    `SELECT
        (SELECT COUNT(*) FROM files   WHERE uploaded_by = ?) AS files,
        (SELECT COUNT(*) FROM folders WHERE created_by  = ?) AS folders`,
    [id, id]
  );
  if (Number(owns.files) > 0 || Number(owns.folders) > 0) {
    throw AppError.conflict(
      'User owns files/folders. Reassign or remove that content first.',
      'USER_HAS_CONTENT'
    );
  }

  await execute('DELETE FROM users WHERE id = ?', [id]);

  await activityLog.log({
    userId: actor.id,
    action: activityLog.ACTIONS.DELETE_USER,
    targetType: 'user',
    targetId: id,
    oldValue: { username: existing.username, role: existing.role },
    context,
  });

  return { success: true };
}

async function assertNotLastAdmin(excludeId) {
  const row = await queryOne(
    "SELECT COUNT(*) AS cnt FROM users WHERE role = 'admin' AND is_active = 1 AND id <> ?",
    [excludeId]
  );
  if (Number(row.cnt) === 0) {
    throw AppError.badRequest('Cannot remove/disable the last active admin', 'LAST_ADMIN');
  }
}

module.exports = {
  listUsers,
  getUser,
  createUser,
  updateUser,
  changePassword,
  setBlocked,
  deleteUser,
};
