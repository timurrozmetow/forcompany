'use strict';

const { query, queryOne, execute } = require('../db/pool');
const AppError = require('../utils/AppError');
const notification = require('./notification.service');

function publicComment(c) {
  return {
    id: c.id,
    fileId: c.file_id,
    userId: c.user_id,
    username: c.username || null,
    body: c.body,
    createdAt: c.created_at,
  };
}

async function listComments(fileId) {
  const rows = await query(
    `SELECT c.*, u.username
       FROM comments c LEFT JOIN users u ON u.id = c.user_id
      WHERE c.file_id = ? ORDER BY c.created_at ASC`,
    [fileId]
  );
  return rows.map(publicComment);
}

async function addComment({ fileId, body, actor }) {
  const file = await queryOne(
    'SELECT id, uploaded_by, original_name FROM files WHERE id = ? AND is_trashed = 0',
    [fileId]
  );
  if (!file) throw AppError.notFound('File not found');
  const text = String(body || '').trim();
  if (!text) throw AppError.badRequest('Comment cannot be empty');
  if (text.length > 2000) throw AppError.badRequest('Comment is too long (max 2000)');

  const r = await execute('INSERT INTO comments (file_id, user_id, body) VALUES (?, ?, ?)', [
    fileId,
    actor.id,
    text,
  ]);

  // Notify the file's owner (unless they commented on their own file).
  await notification.create({
    userId: file.uploaded_by,
    actorId: actor.id,
    type: 'comment_added',
    message: `${actor.username} прокомментировал ваш файл «${file.original_name}»`,
    fileId,
  });
  const row = await queryOne(
    `SELECT c.*, u.username FROM comments c LEFT JOIN users u ON u.id = c.user_id WHERE c.id = ?`,
    [r.insertId]
  );
  return publicComment(row);
}

async function deleteComment({ id, actor }) {
  const c = await queryOne('SELECT id, user_id FROM comments WHERE id = ?', [id]);
  if (!c) throw AppError.notFound('Comment not found');
  // Author or admin may delete.
  if (Number(c.user_id) !== Number(actor.id) && actor.role !== 'admin') {
    throw AppError.forbidden('You can only delete your own comments');
  }
  await execute('DELETE FROM comments WHERE id = ?', [id]);
  return { success: true };
}

module.exports = { listComments, addComment, deleteComment };
