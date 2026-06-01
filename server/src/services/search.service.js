'use strict';

const { query } = require('../db/pool');
const { publicFile } = require('./file.service');
const { publicFolder } = require('./folder.service');

/**
 * Case-insensitive name search across active (non-trashed) folders and files.
 */
async function search(qRaw) {
  const q = String(qRaw || '').trim();
  if (q.length < 1) return { folders: [], files: [] };
  if (q.length > 128) return { folders: [], files: [] };

  const like = `%${q.replace(/[%_]/g, (m) => `\\${m}`)}%`;

  const folders = await query(
    `SELECT f.*, u.username AS created_by_name
       FROM folders f
       LEFT JOIN users u ON u.id = f.created_by
      WHERE f.is_trashed = 0 AND f.name LIKE ? ESCAPE '\\'
      ORDER BY f.name ASC
      LIMIT 100`,
    [like]
  );

  const files = await query(
    `SELECT f.*, u.username AS uploaded_by_name
       FROM files f
       LEFT JOIN users u ON u.id = f.uploaded_by
      WHERE f.is_trashed = 0 AND f.original_name LIKE ? ESCAPE '\\'
      ORDER BY f.original_name ASC
      LIMIT 200`,
    [like]
  );

  return {
    folders: folders.map(publicFolder),
    files: files.map(publicFile),
  };
}

module.exports = { search };
