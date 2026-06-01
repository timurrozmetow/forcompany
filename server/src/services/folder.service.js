'use strict';

const { query, queryOne, execute, transaction } = require('../db/pool');
const { cleanEntityName, parseOptionalId } = require('../utils/validators');
const AppError = require('../utils/AppError');
const activityLog = require('./activityLog.service');

function publicFolder(f) {
  return {
    id: f.id,
    name: f.name,
    parentId: f.parent_id ?? null,
    type: 'folder',
    createdBy: f.created_by,
    createdByName: f.created_by_name ?? null,
    isTrashed: !!f.is_trashed,
    createdAt: f.created_at,
    updatedAt: f.updated_at,
  };
}

/**
 * Loads an active (non-trashed) folder or throws 404.
 */
async function getActiveFolderOrThrow(id) {
  const f = await queryOne(
    'SELECT * FROM folders WHERE id = ? AND is_trashed = 0 LIMIT 1',
    [id]
  );
  if (!f) throw AppError.notFound('Folder not found');
  return f;
}

/**
 * List immediate child folders of parentId (null = root). Only active folders.
 */
async function listFolders(parentIdRaw) {
  const parentId = parseOptionalId(parentIdRaw);
  if (parentId !== null) {
    await getActiveFolderOrThrow(parentId);
  }

  const rows = await query(
    `SELECT f.*, u.username AS created_by_name
       FROM folders f
       LEFT JOIN users u ON u.id = f.created_by
      WHERE f.is_trashed = 0
        AND ${parentId === null ? 'f.parent_id IS NULL' : 'f.parent_id = ?'}
      ORDER BY f.name ASC`,
    parentId === null ? [] : [parentId]
  );
  return rows.map(publicFolder);
}

/**
 * Returns the breadcrumb chain from root to the given folder (inclusive).
 */
async function getBreadcrumbs(folderIdRaw) {
  const folderId = parseOptionalId(folderIdRaw);
  if (folderId === null) return [];

  const chain = [];
  let current = await queryOne('SELECT id, name, parent_id FROM folders WHERE id = ?', [folderId]);
  let guard = 0;
  while (current && guard < 1000) {
    chain.unshift({ id: current.id, name: current.name, parentId: current.parent_id ?? null });
    if (current.parent_id == null) break;
    current = await queryOne('SELECT id, name, parent_id FROM folders WHERE id = ?', [current.parent_id]);
    guard += 1;
  }
  return chain;
}

async function createFolder({ name, parentId: parentIdRaw, actor, context }) {
  const cleanName = cleanEntityName(name, 'Folder name');
  const parentId = parseOptionalId(parentIdRaw);
  if (parentId !== null) {
    await getActiveFolderOrThrow(parentId);
  }

  // Prevent duplicate sibling names (active only).
  const dupe = await queryOne(
    `SELECT id FROM folders
      WHERE is_trashed = 0 AND name = ?
        AND ${parentId === null ? 'parent_id IS NULL' : 'parent_id = ?'}
      LIMIT 1`,
    parentId === null ? [cleanName] : [cleanName, parentId]
  );
  if (dupe) throw AppError.conflict('A folder with this name already exists here', 'DUPLICATE_NAME');

  const result = await execute(
    'INSERT INTO folders (name, parent_id, created_by) VALUES (?, ?, ?)',
    [cleanName, parentId, actor.id]
  );

  await activityLog.log({
    userId: actor.id,
    action: activityLog.ACTIONS.CREATE_FOLDER,
    targetType: 'folder',
    targetId: result.insertId,
    newValue: { name: cleanName, parentId },
    context,
  });

  const created = await queryOne(
    `SELECT f.*, u.username AS created_by_name FROM folders f
       LEFT JOIN users u ON u.id = f.created_by WHERE f.id = ?`,
    [result.insertId]
  );
  return publicFolder(created);
}

async function renameFolder({ id, name, actor, context }) {
  const folder = await getActiveFolderOrThrow(id);
  const cleanName = cleanEntityName(name, 'Folder name');
  if (cleanName === folder.name) return publicFolder(folder);

  const dupe = await queryOne(
    `SELECT id FROM folders
      WHERE is_trashed = 0 AND name = ? AND id <> ?
        AND ${folder.parent_id === null ? 'parent_id IS NULL' : 'parent_id = ?'}
      LIMIT 1`,
    folder.parent_id === null ? [cleanName, id] : [cleanName, id, folder.parent_id]
  );
  if (dupe) throw AppError.conflict('A folder with this name already exists here', 'DUPLICATE_NAME');

  await execute('UPDATE folders SET name = ? WHERE id = ?', [cleanName, id]);

  await activityLog.log({
    userId: actor.id,
    action: activityLog.ACTIONS.RENAME_FOLDER,
    targetType: 'folder',
    targetId: id,
    oldValue: { name: folder.name },
    newValue: { name: cleanName },
    context,
  });

  return { ...publicFolder(folder), name: cleanName };
}

async function moveFolder({ id, targetParentId: targetRaw, actor, context }) {
  const folder = await getActiveFolderOrThrow(id);
  const targetParentId = parseOptionalId(targetRaw);

  if (targetParentId !== null) {
    if (Number(targetParentId) === Number(id)) {
      throw AppError.badRequest('Cannot move a folder into itself', 'INVALID_MOVE');
    }
    await getActiveFolderOrThrow(targetParentId);
    // Prevent moving into one of its own descendants (cycle).
    if (await isDescendant(targetParentId, id)) {
      throw AppError.badRequest('Cannot move a folder into its own subfolder', 'INVALID_MOVE');
    }
  }

  if ((folder.parent_id ?? null) === (targetParentId ?? null)) {
    return publicFolder(folder);
  }

  // Duplicate name in destination?
  const dupe = await queryOne(
    `SELECT id FROM folders
      WHERE is_trashed = 0 AND name = ? AND id <> ?
        AND ${targetParentId === null ? 'parent_id IS NULL' : 'parent_id = ?'}
      LIMIT 1`,
    targetParentId === null ? [folder.name, id] : [folder.name, id, targetParentId]
  );
  if (dupe) throw AppError.conflict('A folder with this name already exists in the destination', 'DUPLICATE_NAME');

  await execute('UPDATE folders SET parent_id = ? WHERE id = ?', [targetParentId, id]);

  await activityLog.log({
    userId: actor.id,
    action: activityLog.ACTIONS.MOVE_FOLDER,
    targetType: 'folder',
    targetId: id,
    oldValue: { parentId: folder.parent_id ?? null },
    newValue: { parentId: targetParentId },
    context,
  });

  return { ...publicFolder(folder), parentId: targetParentId };
}

/**
 * Soft-delete (move to trash) a folder and ALL its descendants (folders+files).
 * Only the top folder is flagged as the "trash root" via trashed_at marker we
 * keep on each; restore brings the whole subtree back.
 */
async function trashFolder({ id, actor, context }) {
  const folder = await getActiveFolderOrThrow(id);

  await transaction(async (tx) => {
    const folderIds = await collectDescendantFolderIds(tx, id);
    folderIds.push(Number(id));

    const placeholders = folderIds.map(() => '?').join(',');
    await tx.execute(
      `UPDATE folders SET is_trashed = 1, trashed_by = ?, trashed_at = NOW()
        WHERE id IN (${placeholders}) AND is_trashed = 0`,
      [actor.id, ...folderIds]
    );
    await tx.execute(
      `UPDATE files SET is_trashed = 1, trashed_by = ?, trashed_at = NOW()
        WHERE folder_id IN (${placeholders}) AND is_trashed = 0`,
      [actor.id, ...folderIds]
    );
  });

  await activityLog.log({
    userId: actor.id,
    action: activityLog.ACTIONS.TRASH_FOLDER,
    targetType: 'folder',
    targetId: id,
    oldValue: { name: folder.name, parentId: folder.parent_id ?? null },
    context,
  });

  return { success: true };
}

/* ----------------------------- tree helpers ----------------------------- */

/**
 * Returns true if `candidateId` is the same as or a descendant of `ancestorId`.
 */
async function isDescendant(candidateId, ancestorId) {
  let current = await queryOne('SELECT id, parent_id FROM folders WHERE id = ?', [candidateId]);
  let guard = 0;
  while (current && guard < 10000) {
    if (Number(current.id) === Number(ancestorId)) return true;
    if (current.parent_id == null) return false;
    current = await queryOne('SELECT id, parent_id FROM folders WHERE id = ?', [current.parent_id]);
    guard += 1;
  }
  return false;
}

/**
 * Breadth-first collection of all descendant folder ids (active or trashed).
 */
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
  publicFolder,
  listFolders,
  getBreadcrumbs,
  createFolder,
  renameFolder,
  moveFolder,
  trashFolder,
  isDescendant,
  collectDescendantFolderIds,
  getActiveFolderOrThrow,
};
