'use strict';

const { query } = require('../db/pool');
const logger = require('../utils/logger');
const { publicFile } = require('./file.service');
const { publicFolder } = require('./folder.service');

/**
 * Search across active (non-trashed) folders and files.
 * Files are matched by full-text (name + extracted content) with a graceful
 * fallback to a plain name LIKE — so search keeps working even if the full-text
 * index isn't present (e.g. migration_v2 not applied yet) instead of 500-ing.
 */
async function search(qRaw) {
  const q = String(qRaw || '').trim();
  if (q.length < 1) return { folders: [], files: [] };
  if (q.length > 128) return { folders: [], files: [] };

  const like = `%${q.replace(/[%_]/g, (m) => `\\${m}`)}%`;

  // BOOLEAN-mode query with prefix matching, e.g. "year report" -> "+year* +report*".
  const booleanQuery = q
    .split(/\s+/)
    .map((term) => term.replace(/[+\-><()~*"@]/g, ''))
    .filter(Boolean)
    .map((term) => `+${term}*`)
    .join(' ');

  const folders = await query(
    `SELECT f.*, u.username AS created_by_name
       FROM folders f
       LEFT JOIN users u ON u.id = f.created_by
      WHERE f.is_trashed = 0 AND f.name LIKE ? ESCAPE '\\'
      ORDER BY f.name ASC
      LIMIT 100`,
    [like]
  );

  const LIKE_ONLY_SQL = `SELECT f.*, u.username AS uploaded_by_name, 0 AS score
       FROM files f
       LEFT JOIN users u ON u.id = f.uploaded_by
      WHERE f.is_trashed = 0 AND f.original_name LIKE ? ESCAPE '\\'
      ORDER BY f.original_name ASC
      LIMIT 200`;

  let files;
  if (booleanQuery.length > 0) {
    try {
      files = await query(
        `SELECT f.*, u.username AS uploaded_by_name,
                MATCH(f.original_name, f.text_content) AGAINST (? IN BOOLEAN MODE) AS score
           FROM files f
           LEFT JOIN users u ON u.id = f.uploaded_by
          WHERE f.is_trashed = 0
            AND (
              MATCH(f.original_name, f.text_content) AGAINST (? IN BOOLEAN MODE)
              OR f.original_name LIKE ? ESCAPE '\\'
            )
          ORDER BY score DESC, f.original_name ASC
          LIMIT 200`,
        [booleanQuery, booleanQuery, like]
      );
    } catch (err) {
      // Most likely the full-text column/index is missing (run `npm run migrate:v2`).
      logger.warn('Full-text search unavailable, falling back to name search:', err.message);
      files = await query(LIKE_ONLY_SQL, [like]);
    }
  } else {
    files = await query(LIKE_ONLY_SQL, [like]);
  }

  return {
    folders: folders.map(publicFolder),
    files: files.map((f) => ({ ...publicFile(f), matchedContent: Number(f.score) > 0 })),
  };
}

module.exports = { search };
