'use strict';

const fs = require('fs');
const config = require('../config');
const logger = require('../utils/logger');
const { execute } = require('../db/pool');
const { resolveStoragePath } = require('../utils/storagePath');

const MAX = config.fulltextMaxChars;
const MAX_FILE_BYTES = 50 * 1024 * 1024; // skip extraction for very large files

const TEXT_EXT = [
  'txt', 'md', 'csv', 'json', 'log', 'xml', 'yml', 'yaml', 'html', 'htm',
  'js', 'ts', 'jsx', 'tsx', 'css', 'sql', 'ini', 'conf', 'env',
];

/**
 * Extract a plain-text representation of a file for indexing. Returns '' when
 * the type isn't supported or extraction fails.
 */
async function extractText(absPath, mime = '', ext = '') {
  const e = (ext || '').toLowerCase();
  const m = (mime || '').toLowerCase();

  if (m.startsWith('text/') || TEXT_EXT.includes(e)) {
    const buf = await fs.promises.readFile(absPath, 'utf8').catch(() => '');
    return buf.slice(0, MAX);
  }
  if (m === 'application/pdf' || e === 'pdf') {
    const pdf = require('pdf-parse');
    const data = await pdf(await fs.promises.readFile(absPath));
    return (data.text || '').slice(0, MAX);
  }
  if (e === 'docx' || m.includes('wordprocessingml')) {
    const mammoth = require('mammoth');
    const r = await mammoth.extractRawText({ path: absPath });
    return (r.value || '').slice(0, MAX);
  }
  if (['xlsx', 'xls', 'ods'].includes(e) || m.includes('spreadsheet') || m.includes('ms-excel')) {
    const XLSX = require('xlsx');
    const wb = XLSX.readFile(absPath, { cellFormula: false, cellHTML: false });
    let out = '';
    for (const name of wb.SheetNames) {
      out += `${XLSX.utils.sheet_to_csv(wb.Sheets[name])}\n`;
      if (out.length > MAX) break;
    }
    return out.slice(0, MAX);
  }
  return '';
}

/**
 * Extract + persist text for a single file (fire-and-forget from upload).
 * Marks indexed_at even on empty/failed so we don't retry endlessly.
 */
async function indexFile(fileId, relativePath, mime, ext, sizeBytes) {
  try {
    let text = '';
    if (!sizeBytes || sizeBytes <= MAX_FILE_BYTES) {
      const abs = resolveStoragePath(relativePath);
      text = await extractText(abs, mime, ext);
    }
    await execute('UPDATE files SET text_content = ?, indexed_at = NOW() WHERE id = ?', [
      text || null,
      fileId,
    ]);
  } catch (err) {
    logger.warn(`text index failed for file ${fileId}: ${err.message}`);
    await execute('UPDATE files SET indexed_at = NOW() WHERE id = ?', [fileId]).catch(() => {});
  }
}

module.exports = { extractText, indexFile, TEXT_EXT };
