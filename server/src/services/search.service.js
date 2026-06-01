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

  // Build a BOOLEAN-mode query with prefix matching for each term, e.g.
  // "year report" -> "+year* +report*". Strip operator chars.
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

  // Full-text match on name + extracted content, falling back to LIKE on the
  // name so short queries (< full-text min token length) still work.
  const useFulltext = booleanQuery.length > 0;
  const files = await query(
    `SELECT f.*, u.username AS uploaded_by_name,
            ${useFulltext
              ? "MATCH(f.original_name, f.text_content) AGAINST (? IN BOOLEAN MODE)"
              : '0'} AS score
       FROM files f
       LEFT JOIN users u ON u.id = f.uploaded_by
      WHERE f.is_trashed = 0
        AND (
          ${useFulltext
            ? "MATCH(f.original_name, f.text_content) AGAINST (? IN BOOLEAN MODE) OR "
            : ''}
          f.original_name LIKE ? ESCAPE '\\'
        )
      ORDER BY score DESC, f.original_name ASC
      LIMIT 200`,
    useFulltext ? [booleanQuery, booleanQuery, like] : [like]
  );

  return {
    folders: folders.map(publicFolder),
    files: files.map((f) => ({ ...publicFile(f), matchedContent: Number(f.score) > 0 })),
  };
}

module.exports = { search };
