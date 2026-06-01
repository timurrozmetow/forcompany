'use strict';

const { execute, query } = require('../db/pool');
const logger = require('../utils/logger');

/**
 * Canonical action names. Kept in one place so controllers can't typo them.
 */
const ACTIONS = {
  LOGIN: 'login',
  LOGOUT: 'logout',
  UPLOAD_FILE: 'upload_file',
  DOWNLOAD_FILE: 'download_file',
  PREVIEW_FILE: 'preview_file',
  CREATE_FOLDER: 'create_folder',
  RENAME_FILE: 'rename_file',
  RENAME_FOLDER: 'rename_folder',
  MOVE_FILE: 'move_file',
  MOVE_FOLDER: 'move_folder',
  TRASH_FILE: 'trash_file',
  TRASH_FOLDER: 'trash_folder',
  RESTORE_FILE: 'restore_file',
  RESTORE_FOLDER: 'restore_folder',
  PERMANENT_DELETE_FILE: 'permanent_delete_file',
  PERMANENT_DELETE_FOLDER: 'permanent_delete_folder',
  CREATE_USER: 'create_user',
  UPDATE_USER: 'update_user',
  BLOCK_USER: 'block_user',
  DELETE_USER: 'delete_user',
};

function toJson(value) {
  if (value === undefined || value === null) return null;
  try {
    return JSON.stringify(value);
  } catch (_) {
    return null;
  }
}

/**
 * Records an activity entry. Designed to never throw into the request flow —
 * a logging failure must not break the user's action.
 *
 * @param {object} p
 * @param {number|null} p.userId
 * @param {string} p.action
 * @param {'file'|'folder'|'user'|'auth'|'system'} p.targetType
 * @param {number|null} [p.targetId]
 * @param {object|null} [p.oldValue]
 * @param {object|null} [p.newValue]
 * @param {object} [p.context] { ip, userAgent }
 */
async function log(p) {
  try {
    await execute(
      `INSERT INTO activity_logs
         (user_id, action, target_type, target_id, old_value, new_value, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        p.userId ?? null,
        p.action,
        p.targetType || 'system',
        p.targetId ?? null,
        toJson(p.oldValue),
        toJson(p.newValue),
        p.context?.ip ?? null,
        p.context?.userAgent ?? null,
      ]
    );
  } catch (err) {
    logger.error('Failed to write activity log:', err.message);
  }
}

/**
 * Paginated activity log listing with joined username, for the admin panel.
 */
async function list({ limit = 50, offset = 0, userId, action } = {}) {
  const where = [];
  const params = [];
  if (userId) {
    where.push('al.user_id = ?');
    params.push(userId);
  }
  if (action) {
    where.push('al.action = ?');
    params.push(action);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
  const safeOffset = Math.max(parseInt(offset, 10) || 0, 0);

  const rows = await query(
    `SELECT al.id, al.user_id, u.username, al.action, al.target_type, al.target_id,
            al.old_value, al.new_value, al.ip_address, al.user_agent, al.created_at
       FROM activity_logs al
       LEFT JOIN users u ON u.id = al.user_id
       ${whereSql}
       ORDER BY al.id DESC
       LIMIT ${safeLimit} OFFSET ${safeOffset}`,
    params
  );

  const countRow = await query(
    `SELECT COUNT(*) AS total FROM activity_logs al ${whereSql}`,
    params
  );

  return {
    items: rows.map(normalizeLogRow),
    total: Number(countRow[0]?.total || 0),
    limit: safeLimit,
    offset: safeOffset,
  };
}

function normalizeLogRow(r) {
  return {
    id: r.id,
    userId: r.user_id,
    username: r.username,
    action: r.action,
    targetType: r.target_type,
    targetId: r.target_id,
    oldValue: parseMaybeJson(r.old_value),
    newValue: parseMaybeJson(r.new_value),
    ipAddress: r.ip_address,
    userAgent: r.user_agent,
    createdAt: r.created_at,
  };
}

function parseMaybeJson(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'object') return v; // mysql2 may already parse JSON columns
  try {
    return JSON.parse(v);
  } catch (_) {
    return v;
  }
}

module.exports = { ACTIONS, log, list };
