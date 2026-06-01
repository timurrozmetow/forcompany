'use strict';

const { query, queryOne, execute, transaction } = require('../db/pool');
const { deleteFromDisk } = require('../utils/storagePath');
const { removeThumb } = require('./thumbnail.service');
const AppError = require('../utils/AppError');
const activityLog = require('./activityLog.service');
const logger = require('../utils/logger');

/**
 * Lists "trash roots" only — items the user explicitly sent to trash, not every
 * descendant. A trashed folder is a root if its parent is NOT trashed (or null).
 * A trashed file is a root if its folder is NOT trashed (or null).
 */
async function listTrash() {
  const folders = await query(
    `SELECT f.id, f.name, f.parent_id, f.created_at, f.trashed_at, f.trashed_by,
            tb.username AS trashed_by_name, p.name AS parent_name
       FROM folders f
       LEFT JOIN users tb ON tb.id = f.trashed_by
       LEFT JOIN folders p ON p.id = f.parent_id
      WHERE f.is_trashed = 1
        AND (f.parent_id IS NULL OR p.is_trashed = 0)
      ORDER BY f.trashed_at DESC`
  );

  const files = await query(
    `SELECT fi.id, fi.original_name, fi.folder_id, fi.mime_type, fi.extension,
            fi.size_bytes, fi.created_at, fi.trashed_at, fi.trashed_by,
            tb.username AS trashed_by_name, fo.name AS folder_name
       FROM files fi
       LEFT JOIN users tb ON tb.id = fi.trashed_by
       LEFT JOIN folders fo ON fo.id = fi.folder_id
      WHERE fi.is_trashed = 1
        AND (fi.folder_id IS NULL OR fo.is_trashed = 0)
      ORDER BY fi.trashed_at DESC`
  );

  return {
    folders: folders.map((f) => ({
      id: f.id,
      type: 'folder',
      name: f.name,
      originalPath: f.parent_name ? `…/${f.parent_name}` : '/',
      parentId: f.parent_id ?? null,
      sizeBytes: null,
      trashedAt: f.trashed_at,
      trashedBy: f.trashed_by,
      trashedByName: f.trashed_by_name,
      createdAt: f.created_at,
    })),
    files: files.map((f) => ({
      id: f.id,
      type: 'file',
      name: f.original_name,
      mimeType: f.mime_type,
      extension: f.extension,
      originalPath: f.folder_name ? `…/${f.folder_name}` : '/',
      folderId: f.folder_id ?? null,
      sizeBytes: Number(f.size_bytes),
      trashedAt: f.trashed_at,
      trashedBy: f.trashed_by,
      trashedByName: f.trashed_by_name,
      createdAt: f.created_at,
    })),
  };
}

async function restoreFile({ id, actor, context }) {
  const file = await queryOne('SELECT * FROM files WHERE id = ? AND is_trashed = 1 LIMIT 1', [id]);
  if (!file) throw AppError.notFound('Trashed file not found');

  // If its folder is trashed, restore to root so it isn't orphaned in trash.
  let targetFolderId = file.folder_id;
  if (targetFolderId != null) {
    const folder = await queryOne('SELECT is_trashed FROM folders WHERE id = ?', [targetFolderId]);
    if (!folder || folder.is_trashed) targetFolderId = null;
  }

  await execute(
    'UPDATE files SET is_trashed = 0, trashed_by = NULL, trashed_at = NULL, folder_id = ? WHERE id = ?',
    [targetFolderId, id]
  );

  await activityLog.log({
    userId: actor.id,
    action: activityLog.ACTIONS.RESTORE_FILE,
    targetType: 'file',
    targetId: id,
    newValue: { name: file.original_name, folderId: targetFolderId },
    context,
  });

  return { success: true };
}

async function restoreFolder({ id, actor, context }) {
  const folder = await queryOne('SELECT * FROM folders WHERE id = ? AND is_trashed = 1 LIMIT 1', [id]);
  if (!folder) throw AppError.notFound('Trashed folder not found');

  await transaction(async (tx) => {
    // If parent is trashed/missing, restore this folder to root.
    let parentId = folder.parent_id;
    if (parentId != null) {
      const parent = await tx.queryOne('SELECT is_trashed FROM folders WHERE id = ?', [parentId]);
      if (!parent || parent.is_trashed) parentId = null;
    }

    const folderIds = await collectDescendantFolderIds(tx, id);
    folderIds.push(Number(id));
    const placeholders = folderIds.map(() => '?').join(',');

    await tx.execute(
      `UPDATE folders SET is_trashed = 0, trashed_by = NULL, trashed_at = NULL
        WHERE id IN (${placeholders})`,
      folderIds
    );
    await tx.execute(
      `UPDATE files SET is_trashed = 0, trashed_by = NULL, trashed_at = NULL
        WHERE folder_id IN (${placeholders}) AND is_trashed = 1`,
      folderIds
    );
    // Re-parent the restored root.
    await tx.execute('UPDATE folders SET parent_id = ? WHERE id = ?', [parentId, id]);
  });

  await activityLog.log({
    userId: actor.id,
    action: activityLog.ACTIONS.RESTORE_FOLDER,
    targetType: 'folder',
    targetId: id,
    newValue: { name: folder.name },
    context,
  });

  return { success: true };
}

async function permanentDeleteFile({ id, actor, context }) {
  const file = await queryOne('SELECT * FROM files WHERE id = ? AND is_trashed = 1 LIMIT 1', [id]);
  if (!file) throw AppError.notFound('Trashed file not found');

  // Delete DB row first; only then remove disk bytes (so a crash leaves an
  // orphan file, not a dangling DB row pointing at nothing).
  await execute('DELETE FROM files WHERE id = ?', [id]);
  try {
    await deleteFromDisk(file.storage_path);
    await removeThumb(file.stored_name);
  } catch (err) {
    logger.error('permanentDeleteFile: disk cleanup failed:', err.message);
  }

  await activityLog.log({
    userId: actor.id,
    action: activityLog.ACTIONS.PERMANENT_DELETE_FILE,
    targetType: 'file',
    targetId: id,
    oldValue: { name: file.original_name, sizeBytes: Number(file.size_bytes) },
    context,
  });

  return { success: true };
}

async function permanentDeleteFolder({ id, actor, context }) {
  const folder = await queryOne('SELECT * FROM folders WHERE id = ? AND is_trashed = 1 LIMIT 1', [id]);
  if (!folder) throw AppError.notFound('Trashed folder not found');

  // Collect every file under this subtree so we can wipe disk bytes.
  const filesToDelete = await transaction(async (tx) => {
    const folderIds = await collectDescendantFolderIds(tx, id);
    folderIds.push(Number(id));
    const placeholders = folderIds.map(() => '?').join(',');

    const files = await tx.query(
      `SELECT id, storage_path, stored_name FROM files WHERE folder_id IN (${placeholders})`,
      folderIds
    );

    // Deleting the root folder cascades to descendant folders AND their files
    // rows via ON DELETE CASCADE.
    await tx.execute('DELETE FROM folders WHERE id = ?', [id]);
    return files;
  });

  // Remove bytes from disk (best-effort; DB is already consistent).
  for (const f of filesToDelete) {
    try {
      await deleteFromDisk(f.storage_path);
      await removeThumb(f.stored_name);
    } catch (err) {
      logger.error(`permanentDeleteFolder: disk cleanup failed for file ${f.id}:`, err.message);
    }
  }

  await activityLog.log({
    userId: actor.id,
    action: activityLog.ACTIONS.PERMANENT_DELETE_FOLDER,
    targetType: 'folder',
    targetId: id,
    oldValue: { name: folder.name, filesRemovedCount: filesToDelete.length },
    context,
  });

  return { success: true, filesRemoved: filesToDelete.length };
}

/* BFS descendant folder collection (shared with folder.service semantics). */
async function collectDescendantFolderIds(tx, rootId) {
  const all = [];
  let frontier = [Number(rootId)];
  let guard = 0;
  while (frontier.length && guard < 100000) {
    const placeholders = frontier.map(() => '?').join(',');
    const children = await tx.query(
      `SELECT id FROM folders WHERE parent_id IN (${placeholders})`,
      frontier
    );
    const ids = children.map((c) => Number(c.id));
    all.push(...ids);
    frontier = ids;
    guard += ids.length;
  }
  return all;
}

module.exports = {
  listTrash,
  restoreFile,
  restoreFolder,
  permanentDeleteFile,
  permanentDeleteFolder,
};
