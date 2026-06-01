'use strict';

const crypto = require('crypto');
const archiver = require('archiver');

const { query, queryOne } = require('../db/pool');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');
const { resolveStoragePath } = require('../utils/storagePath');
const activityLog = require('./activityLog.service');

// Short-lived sessions for selection-zip (so the browser can download via GET).
const sessions = new Map(); // sessionId -> { userId, fileIds, folderIds, createdAt }
const SESSION_TTL_MS = 5 * 60 * 1000;

function createSession(userId, fileIds, folderIds) {
  const sessionId = crypto.randomUUID();
  sessions.set(sessionId, {
    userId,
    fileIds: (fileIds || []).map(Number).filter(Boolean),
    folderIds: (folderIds || []).map(Number).filter(Boolean),
    createdAt: Date.now(),
  });
  return sessionId;
}

function takeSession(sessionId, userId) {
  const s = sessions.get(sessionId);
  if (!s) throw AppError.notFound('Download session expired', 'NO_SESSION');
  if (Date.now() - s.createdAt > SESSION_TTL_MS) {
    sessions.delete(sessionId);
    throw AppError.notFound('Download session expired', 'NO_SESSION');
  }
  if (Number(s.userId) !== Number(userId)) throw AppError.forbidden('Not your download');
  return s;
}

// Periodic cleanup of expired sessions.
setInterval(() => {
  const now = Date.now();
  for (const [id, s] of sessions) {
    if (now - s.createdAt > SESSION_TTL_MS) sessions.delete(id);
  }
}, 60 * 1000).unref();

/* ----------------------------- gathering -------------------------------- */

async function filesInFolder(folderId) {
  return query(
    'SELECT id, original_name, storage_path FROM files WHERE is_trashed = 0 AND folder_id = ?',
    [folderId]
  );
}
async function subfolders(folderId) {
  return query(
    'SELECT id, name FROM folders WHERE is_trashed = 0 AND parent_id = ?',
    [folderId]
  );
}

/**
 * Recursively collect { absolutePath, zipName } entries for a folder subtree,
 * rooted at `prefix` (e.g. "Docs/").
 */
async function gatherFolder(folderId, prefix, out, guard = { n: 0 }) {
  if (guard.n > 200000) return;
  const files = await filesInFolder(folderId);
  for (const f of files) {
    guard.n += 1;
    out.push({ absolutePath: resolveStoragePath(f.storage_path), zipName: prefix + f.original_name });
  }
  const subs = await subfolders(folderId);
  for (const s of subs) {
    await gatherFolder(s.id, `${prefix}${s.name}/`, out, guard);
  }
}

function dedupeNames(entries) {
  const seen = new Map();
  for (const e of entries) {
    if (!seen.has(e.zipName)) {
      seen.set(e.zipName, 1);
    } else {
      const n = seen.get(e.zipName) + 1;
      seen.set(e.zipName, n);
      const dot = e.zipName.lastIndexOf('.');
      e.zipName =
        dot > 0
          ? `${e.zipName.slice(0, dot)} (${n})${e.zipName.slice(dot)}`
          : `${e.zipName} (${n})`;
    }
  }
  return entries;
}

/* ------------------------------ streaming ------------------------------- */

function streamArchive(res, entries, downloadName, { userId, context, summary }) {
  if (!entries.length) throw AppError.notFound('Nothing to download');

  const archive = archiver('zip', { zlib: { level: 0 }, store: true }); // store: large files, no CPU
  archive.on('warning', (err) => logger.warn('archiver warning:', err.message));
  archive.on('error', (err) => {
    logger.error('archiver error:', err.message);
    if (!res.headersSent) res.status(500);
    res.end();
  });

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="download.zip"; filename*=UTF-8''${encodeURIComponent(downloadName)}`
  );
  res.setHeader('Cache-Control', 'private, no-store');

  res.on('close', () => archive.destroy());

  archive.pipe(res);
  for (const e of entries) {
    archive.file(e.absolutePath, { name: e.zipName });
  }
  archive.finalize();

  activityLog.log({
    userId,
    action: activityLog.ACTIONS.DOWNLOAD_FILE,
    targetType: 'system',
    newValue: { zip: true, files: entries.length, name: downloadName, ...summary },
    context,
  });
}

async function streamFolderZip(res, folderId, user, context) {
  const folder = await queryOne('SELECT id, name FROM folders WHERE id = ? AND is_trashed = 0', [folderId]);
  if (!folder) throw AppError.notFound('Folder not found');

  const entries = [];
  await gatherFolder(folder.id, `${folder.name}/`, entries);
  dedupeNames(entries);
  streamArchive(res, entries, `${folder.name}.zip`, {
    userId: user.id,
    context,
    summary: { folderId: folder.id },
  });
}

async function streamSelectionZip(res, sessionId, user, context) {
  const s = takeSession(sessionId, user.id);
  const entries = [];

  if (s.fileIds.length) {
    const placeholders = s.fileIds.map(() => '?').join(',');
    const rows = await query(
      `SELECT id, original_name, storage_path FROM files
        WHERE is_trashed = 0 AND id IN (${placeholders})`,
      s.fileIds
    );
    for (const f of rows) {
      entries.push({ absolutePath: resolveStoragePath(f.storage_path), zipName: f.original_name });
    }
  }
  for (const fid of s.folderIds) {
    const folder = await queryOne('SELECT id, name FROM folders WHERE id = ? AND is_trashed = 0', [fid]);
    if (folder) await gatherFolder(folder.id, `${folder.name}/`, entries);
  }

  dedupeNames(entries);
  sessions.delete(sessionId);
  streamArchive(res, entries, 'selection.zip', { userId: user.id, context });
}

module.exports = { createSession, streamFolderZip, streamSelectionZip };
