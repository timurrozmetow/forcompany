'use strict';

const { query, queryOne, execute } = require('../db/pool');
const logger = require('../utils/logger');

/**
 * In-app notifications (the header "bell"). Separate from notify.service.js
 * which sends external Telegram/Email alerts to admins.
 */

function publicNotification(n) {
  return {
    id: n.id,
    type: n.type,
    message: n.message,
    actorId: n.actor_id,
    actorName: n.actor_name || null,
    fileId: n.file_id,
    folderId: n.folder_id,
    isRead: !!n.is_read,
    createdAt: n.created_at,
  };
}

/** Create a notification (no-op if recipient == actor or recipient missing). */
async function create({ userId, actorId, type, message, fileId = null, folderId = null }) {
  if (!userId || Number(userId) === Number(actorId)) return;
  try {
    await execute(
      `INSERT INTO notifications (user_id, actor_id, type, message, file_id, folder_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, actorId ?? null, type, String(message).slice(0, 512), fileId, folderId]
    );
  } catch (err) {
    logger.warn('notification create failed:', err.message);
  }
}

async function list(userId, { limit = 30, offset = 0 } = {}) {
  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 30, 1), 100);
  const safeOffset = Math.max(parseInt(offset, 10) || 0, 0);
  const rows = await query(
    `SELECT n.*, u.username AS actor_name
       FROM notifications n
       LEFT JOIN users u ON u.id = n.actor_id
      WHERE n.user_id = ?
      ORDER BY n.id DESC
      LIMIT ${safeLimit} OFFSET ${safeOffset}`,
    [userId]
  );
  return rows.map(publicNotification);
}

async function unreadCount(userId) {
  const row = await queryOne(
    'SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND is_read = 0',
    [userId]
  );
  return Number(row?.c || 0);
}

async function markRead(userId, id) {
  if (id) {
    await execute('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [id, userId]);
  } else {
    await execute('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0', [userId]);
  }
  return { success: true };
}

module.exports = { create, list, unreadCount, markRead };
