'use strict';

const { query, queryOne, execute } = require('../db/pool');
const { cleanEntityName, parseOptionalId } = require('../utils/validators');
const { resolveStoragePath } = require('../utils/storagePath');
const AppError = require('../utils/AppError');
const activityLog = require('./activityLog.service');
const folderService = require('./folder.service');

function publicFile(f) {
  return {
    id: f.id,
    folderId: f.folder_id ?? null,
    name: f.original_name,
    type: 'file',
    mimeType: f.mime_type,
    extension: f.extension,
    sizeBytes: Number(f.size_bytes),
    uploadedBy: f.uploaded_by,
    uploadedByName: f.uploaded_by_name ?? null,
    isTrashed: !!f.is_trashed,
    createdAt: f.created_at,
    updatedAt: f.updated_at,
  };
}

async function getActiveFileOrThrow(id) {
  const f = await queryOne('SELECT * FROM files WHERE id = ? AND is_trashed = 0 LIMIT 1', [id]);
  if (!f) throw AppError.notFound('File not found');
  return f;
}

/**
 * List active files in a folder (null = root).
 */
async function listFiles(folderIdRaw) {
  const folderId = parseOptionalId(folderIdRaw);
  if (folderId !== null) {
    await folderService.getActiveFolderOrThrow(folderId);
  }
  const rows = await query(
    `SELECT f.*, u.username AS uploaded_by_name
       FROM files f
       LEFT JOIN users u ON u.id = f.uploaded_by
      WHERE f.is_trashed = 0
        AND ${folderId === null ? 'f.folder_id IS NULL' : 'f.folder_id = ?'}
      ORDER BY f.original_name ASC`,
    folderId === null ? [] : [folderId]
  );
  return rows.map(publicFile);
}

async function getFilePublic(id) {
  const f = await queryOne(
    `SELECT f.*, u.username AS uploaded_by_name FROM files f
       LEFT JOIN users u ON u.id = f.uploaded_by WHERE f.id = ?`,
    [id]
  );
  if (!f) throw AppError.notFound('File not found');
  return publicFile(f);
}

/**
 * Inserts a file metadata row after the bytes have been streamed to disk.
 * Called by the upload controller once a single file part is fully written.
 */
async function createFileRecord({
  folderId,
  originalName,
  storedName,
  storagePath,
  mimeType,
  extension,
  sizeBytes,
  actor,
  context,
}) {
  const result = await execute(
    `INSERT INTO files
       (folder_id, original_name, stored_name, storage_path, mime_type, extension, size_bytes, uploaded_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      folderId,
      originalName,
      storedName,
      storagePath,
      mimeType || 'application/octet-stream',
      extension || '',
      sizeBytes,
      actor.id,
    ]
  );

  await activityLog.log({
    userId: actor.id,
    action: activityLog.ACTIONS.UPLOAD_FILE,
    targetType: 'file',
    targetId: result.insertId,
    newValue: { name: originalName, sizeBytes, folderId },
    context,
  });

  return getFilePublic(result.insertId);
}

async function renameFile({ id, name, actor, context }) {
  const file = await getActiveFileOrThrow(id);
  const cleanName = cleanEntityName(name, 'File name');
  if (cleanName === file.original_name) return publicFile(file);

  await execute('UPDATE files SET original_name = ? WHERE id = ?', [cleanName, id]);

  await activityLog.log({
    userId: actor.id,
    action: activityLog.ACTIONS.RENAME_FILE,
    targetType: 'file',
    targetId: id,
    oldValue: { name: file.original_name },
    newValue: { name: cleanName },
    context,
  });

  return { ...publicFile(file), name: cleanName };
}

async function moveFile({ id, targetFolderId: targetRaw, actor, context }) {
  const file = await getActiveFileOrThrow(id);
  const targetFolderId = parseOptionalId(targetRaw);
  if (targetFolderId !== null) {
    await folderService.getActiveFolderOrThrow(targetFolderId);
  }
  if ((file.folder_id ?? null) === (targetFolderId ?? null)) {
    return publicFile(file);
  }

  await execute('UPDATE files SET folder_id = ? WHERE id = ?', [targetFolderId, id]);

  await activityLog.log({
    userId: actor.id,
    action: activityLog.ACTIONS.MOVE_FILE,
    targetType: 'file',
    targetId: id,
    oldValue: { folderId: file.folder_id ?? null },
    newValue: { folderId: targetFolderId },
    context,
  });

  return { ...publicFile(file), folderId: targetFolderId };
}

async function trashFile({ id, actor, context }) {
  const file = await getActiveFileOrThrow(id);
  await execute(
    'UPDATE files SET is_trashed = 1, trashed_by = ?, trashed_at = NOW() WHERE id = ?',
    [actor.id, id]
  );

  await activityLog.log({
    userId: actor.id,
    action: activityLog.ACTIONS.TRASH_FILE,
    targetType: 'file',
    targetId: id,
    oldValue: { name: file.original_name, folderId: file.folder_id ?? null },
    context,
  });

  return { success: true };
}

/**
 * Returns the row + a SAFE absolute disk path for streaming download/preview.
 * Throws if the file is trashed or missing. Path is validated against traversal.
 */
async function resolveForStreaming(id) {
  const file = await getActiveFileOrThrow(id);
  const absolutePath = resolveStoragePath(file.storage_path);
  return { file, absolutePath };
}

module.exports = {
  publicFile,
  listFiles,
  getFilePublic,
  getActiveFileOrThrow,
  createFileRecord,
  renameFile,
  moveFile,
  trashFile,
  resolveForStreaming,
};
