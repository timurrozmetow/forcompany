'use strict';

const { query } = require('../db/pool');
const logger = require('../utils/logger');
const { publicFile } = require('./file.service');
const { publicFolder } = require('./folder.service');

// type filter -> SQL condition on the files table
const TYPE_SQL = {
  image: "f.mime_type LIKE 'image/%'",
  video: "f.mime_type LIKE 'video/%'",
  audio: "f.mime_type LIKE 'audio/%'",
  pdf: "(f.mime_type = 'application/pdf' OR f.extension = 'pdf')",
  doc: "f.extension IN ('doc','docx','odt','rtf')",
  sheet: "f.extension IN ('xls','xlsx','ods','csv')",
  ppt: "f.extension IN ('ppt','pptx','odp')",
  archive: "f.extension IN ('zip','rar','7z','tar','gz','bz2','xz')",
};

const escLike = (s) => `%${s.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;

/**
 * Search folders + files by name (+ file content via full-text) with optional
 * filters: type, uploadedBy, dateFrom/dateTo (YYYY-MM-DD), tagId.
 */
async function search(qRaw, filters = {}) {
  const q = String(qRaw || '').trim();
  const type = filters.type || '';
  const uploadedBy = filters.uploadedBy ? Number(filters.uploadedBy) : null;
  const tagId = filters.tagId ? Number(filters.tagId) : null;
  const dateFrom = filters.dateFrom || null;
  const dateTo = filters.dateTo || null;
  const hasFilters = !!(type || uploadedBy || tagId || dateFrom || dateTo);

  if (q.length > 128) return { folders: [], files: [] };
  if (q.length < 1 && !hasFilters) return { folders: [], files: [] };

  const like = q ? escLike(q) : '%';

  // ---- Folders (skip when filtering to a file-type or a tag) ----
  let folders = [];
  if ((!type || type === 'folder') && !tagId) {
    const where = ['fo.is_trashed = 0', 'fo.name LIKE ?'];
    const params = [like];
    if (uploadedBy) {
      where.push('fo.created_by = ?');
      params.push(uploadedBy);
    }
    if (dateFrom) {
      where.push('fo.created_at >= ?');
      params.push(`${dateFrom} 00:00:00`);
    }
    if (dateTo) {
      where.push('fo.created_at <= ?');
      params.push(`${dateTo} 23:59:59`);
    }
    folders = await query(
      `SELECT fo.*, u.username AS created_by_name
         FROM folders fo LEFT JOIN users u ON u.id = fo.created_by
        WHERE ${where.join(' AND ')}
        ORDER BY fo.name ASC LIMIT 100`,
      params
    );
  }

  // ---- Files (skip when type === 'folder') ----
  let files = [];
  if (type !== 'folder') {
    files = await searchFiles({ q, like, type, uploadedBy, tagId, dateFrom, dateTo });
  }

  return {
    folders: folders.map(publicFolder),
    files: files.map((f) => ({ ...publicFile(f), matchedContent: Number(f.score || 0) > 0 })),
  };
}

function buildFilterSql({ type, uploadedBy, tagId, dateFrom, dateTo }) {
  const where = [];
  const params = [];
  if (type && TYPE_SQL[type]) where.push(TYPE_SQL[type]);
  if (uploadedBy) {
    where.push('f.uploaded_by = ?');
    params.push(uploadedBy);
  }
  if (dateFrom) {
    where.push('f.created_at >= ?');
    params.push(`${dateFrom} 00:00:00`);
  }
  if (dateTo) {
    where.push('f.created_at <= ?');
    params.push(`${dateTo} 23:59:59`);
  }
  if (tagId) {
    where.push('f.id IN (SELECT file_id FROM file_tags WHERE tag_id = ?)');
    params.push(tagId);
  }
  return { sql: where.length ? ` AND ${where.join(' AND ')}` : '', params };
}

async function searchFiles(opts) {
  const { q, like } = opts;
  const filter = buildFilterSql(opts);

  const booleanQuery = q
    ? q
        .split(/\s+/)
        .map((t) => t.replace(/[+\-><()~*"@]/g, ''))
        .filter(Boolean)
        .map((t) => `+${t}*`)
        .join(' ')
    : '';

  if (q && booleanQuery) {
    try {
      return await query(
        `SELECT f.*, u.username AS uploaded_by_name,
                MATCH(f.original_name, f.text_content) AGAINST (? IN BOOLEAN MODE) AS score
           FROM files f LEFT JOIN users u ON u.id = f.uploaded_by
          WHERE f.is_trashed = 0
            AND (
              MATCH(f.original_name, f.text_content) AGAINST (? IN BOOLEAN MODE)
              OR f.original_name LIKE ?
            )${filter.sql}
          ORDER BY score DESC, f.original_name ASC LIMIT 200`,
        [booleanQuery, booleanQuery, like, ...filter.params]
      );
    } catch (err) {
      logger.warn('Full-text search unavailable, falling back to name:', err.message);
    }
  }

  const nameCond = q ? 'f.original_name LIKE ?' : '1 = 1';
  const nameParams = q ? [like] : [];
  return query(
    `SELECT f.*, u.username AS uploaded_by_name, 0 AS score
       FROM files f LEFT JOIN users u ON u.id = f.uploaded_by
      WHERE f.is_trashed = 0 AND ${nameCond}${filter.sql}
      ORDER BY f.original_name ASC LIMIT 200`,
    [...nameParams, ...filter.params]
  );
}

module.exports = { search };
