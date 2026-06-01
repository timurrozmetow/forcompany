'use strict';

const { query, queryOne, execute } = require('../db/pool');
const AppError = require('../utils/AppError');
const { publicFile } = require('./file.service');
const { publicFolder } = require('./folder.service');

/* ------------------------------ Favorites ------------------------------- */

async function listFavorites(userId) {
  const files = await query(
    `SELECT fi.*, u.username AS uploaded_by_name
       FROM favorites fa
       JOIN files fi ON fi.id = fa.file_id AND fi.is_trashed = 0
       LEFT JOIN users u ON u.id = fi.uploaded_by
      WHERE fa.user_id = ? AND fa.file_id IS NOT NULL
      ORDER BY fa.created_at DESC`,
    [userId]
  );
  const folders = await query(
    `SELECT fo.*, u.username AS created_by_name
       FROM favorites fa
       JOIN folders fo ON fo.id = fa.folder_id AND fo.is_trashed = 0
       LEFT JOIN users u ON u.id = fo.created_by
      WHERE fa.user_id = ? AND fa.folder_id IS NOT NULL
      ORDER BY fa.created_at DESC`,
    [userId]
  );
  return { folders: folders.map(publicFolder), files: files.map(publicFile) };
}

async function favoriteIds(userId) {
  const rows = await query('SELECT file_id, folder_id FROM favorites WHERE user_id = ?', [userId]);
  return {
    files: rows.filter((r) => r.file_id != null).map((r) => Number(r.file_id)),
    folders: rows.filter((r) => r.folder_id != null).map((r) => Number(r.folder_id)),
  };
}

async function addFavorite(userId, { fileId, folderId }) {
  if (fileId) {
    const f = await queryOne('SELECT id FROM files WHERE id = ? AND is_trashed = 0', [fileId]);
    if (!f) throw AppError.notFound('File not found');
    await execute('INSERT IGNORE INTO favorites (user_id, file_id) VALUES (?, ?)', [userId, fileId]);
  } else if (folderId) {
    const f = await queryOne('SELECT id FROM folders WHERE id = ? AND is_trashed = 0', [folderId]);
    if (!f) throw AppError.notFound('Folder not found');
    await execute('INSERT IGNORE INTO favorites (user_id, folder_id) VALUES (?, ?)', [userId, folderId]);
  } else {
    throw AppError.badRequest('fileId or folderId is required');
  }
  return { success: true };
}

async function removeFavorite(userId, { fileId, folderId }) {
  if (fileId) {
    await execute('DELETE FROM favorites WHERE user_id = ? AND file_id = ?', [userId, fileId]);
  } else if (folderId) {
    await execute('DELETE FROM favorites WHERE user_id = ? AND folder_id = ?', [userId, folderId]);
  } else {
    throw AppError.badRequest('fileId or folderId is required');
  }
  return { success: true };
}

/* ------------------------------- Recent --------------------------------- */

async function listRecent(userId, limit = 40) {
  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 40, 1), 100);
  const rows = await query(
    `SELECT fi.*, u.username AS uploaded_by_name, MAX(al.created_at) AS last_at
       FROM activity_logs al
       JOIN files fi ON fi.id = al.target_id AND fi.is_trashed = 0
       LEFT JOIN users u ON u.id = fi.uploaded_by
      WHERE al.user_id = ? AND al.target_type = 'file'
        AND al.action IN ('upload_file', 'preview_file', 'download_file')
      GROUP BY fi.id
      ORDER BY last_at DESC
      LIMIT ${safeLimit}`,
    [userId]
  );
  return rows.map(publicFile);
}

module.exports = {
  listFavorites,
  favoriteIds,
  addFavorite,
  removeFavorite,
  listRecent,
};
