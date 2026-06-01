'use strict';

const { query, queryOne, execute } = require('../db/pool');
const AppError = require('../utils/AppError');
const { publicFile } = require('./file.service');

const NAME_RE = /^[\p{L}\p{N} _.\-#]{1,64}$/u;
const COLOR_RE = /^#?[0-9a-fA-F]{6}$/;

function cleanTagName(raw) {
  const name = String(raw || '').trim();
  if (!NAME_RE.test(name)) throw AppError.badRequest('Invalid tag name');
  return name;
}

async function listTags() {
  return query(
    `SELECT t.id, t.name, t.color, COUNT(ft.file_id) AS file_count
       FROM tags t
       LEFT JOIN file_tags ft ON ft.tag_id = t.id
      GROUP BY t.id, t.name, t.color
      ORDER BY t.name ASC`
  );
}

async function createTag({ name, color, actor }) {
  const cleanName = cleanTagName(name);
  const cleanColor = color && COLOR_RE.test(color) ? (color.startsWith('#') ? color : `#${color}`) : null;
  const existing = await queryOne('SELECT id, name, color FROM tags WHERE name = ?', [cleanName]);
  if (existing) return existing;
  const r = await execute('INSERT INTO tags (name, color, created_by) VALUES (?, ?, ?)', [
    cleanName,
    cleanColor,
    actor.id,
  ]);
  return { id: r.insertId, name: cleanName, color: cleanColor, file_count: 0 };
}

async function deleteTag(id) {
  const t = await queryOne('SELECT id FROM tags WHERE id = ?', [id]);
  if (!t) throw AppError.notFound('Tag not found');
  await execute('DELETE FROM tags WHERE id = ?', [id]); // cascades file_tags
  return { success: true };
}

async function fileTags(fileId) {
  return query(
    `SELECT t.id, t.name, t.color
       FROM file_tags ft JOIN tags t ON t.id = ft.tag_id
      WHERE ft.file_id = ? ORDER BY t.name ASC`,
    [fileId]
  );
}

async function attachTag({ fileId, tagId, name, color, actor }) {
  const file = await queryOne('SELECT id FROM files WHERE id = ? AND is_trashed = 0', [fileId]);
  if (!file) throw AppError.notFound('File not found');

  let tag;
  if (tagId) {
    tag = await queryOne('SELECT id, name, color FROM tags WHERE id = ?', [tagId]);
    if (!tag) throw AppError.notFound('Tag not found');
  } else {
    tag = await createTag({ name, color, actor });
  }
  await execute('INSERT IGNORE INTO file_tags (file_id, tag_id) VALUES (?, ?)', [fileId, tag.id]);
  return fileTags(fileId);
}

async function detachTag({ fileId, tagId }) {
  await execute('DELETE FROM file_tags WHERE file_id = ? AND tag_id = ?', [fileId, tagId]);
  return fileTags(fileId);
}

async function filesByTag(tagId) {
  const rows = await query(
    `SELECT fi.*, u.username AS uploaded_by_name
       FROM file_tags ft
       JOIN files fi ON fi.id = ft.file_id AND fi.is_trashed = 0
       LEFT JOIN users u ON u.id = fi.uploaded_by
      WHERE ft.tag_id = ?
      ORDER BY fi.original_name ASC`,
    [tagId]
  );
  return rows.map(publicFile);
}

module.exports = {
  listTags,
  createTag,
  deleteTag,
  fileTags,
  attachTag,
  detachTag,
  filesByTag,
};
