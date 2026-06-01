'use strict';

const { query, queryOne } = require('../db/pool');
const { getDiskSpace } = require('../utils/diskSpace');

async function dashboardStats() {
  const totals = await queryOne(
    `SELECT
        (SELECT COUNT(*) FROM files   WHERE is_trashed = 0)                 AS total_files,
        (SELECT COALESCE(SUM(size_bytes),0) FROM files WHERE is_trashed = 0) AS total_size,
        (SELECT COUNT(*) FROM folders WHERE is_trashed = 0)                 AS total_folders,
        (SELECT COUNT(*) FROM files   WHERE is_trashed = 1)                 AS trashed_files,
        (SELECT COUNT(*) FROM folders WHERE is_trashed = 1)                 AS trashed_folders,
        (SELECT COUNT(*) FROM users)                                        AS total_users,
        (SELECT COUNT(*) FROM users WHERE is_active = 1)                    AS active_users`
  );

  const recentUploads = await query(
    `SELECT f.id, f.original_name AS name, f.size_bytes, f.mime_type, f.created_at,
            u.username AS uploaded_by_name
       FROM files f
       LEFT JOIN users u ON u.id = f.uploaded_by
      WHERE f.is_trashed = 0
      ORDER BY f.id DESC
      LIMIT 8`
  );

  const recentDeletions = await query(
    `SELECT al.id, al.action, al.target_type, al.target_id, al.new_value, al.old_value,
            al.created_at, u.username
       FROM activity_logs al
       LEFT JOIN users u ON u.id = al.user_id
      WHERE al.action IN ('trash_file','trash_folder','permanent_delete_file','permanent_delete_folder')
      ORDER BY al.id DESC
      LIMIT 8`
  );

  // Users active in the last 7 days (any logged activity).
  const recentlyActive = await query(
    `SELECT u.id, u.username, u.role, MAX(al.created_at) AS last_active
       FROM users u
       JOIN activity_logs al ON al.user_id = u.id
      WHERE al.created_at >= (NOW() - INTERVAL 7 DAY)
      GROUP BY u.id, u.username, u.role
      ORDER BY last_active DESC
      LIMIT 10`
  );

  const disk = await getDiskSpace();

  return {
    totals: {
      totalFiles: Number(totals.total_files),
      totalSizeBytes: Number(totals.total_size),
      totalFolders: Number(totals.total_folders),
      trashedFiles: Number(totals.trashed_files),
      trashedFolders: Number(totals.trashed_folders),
      totalUsers: Number(totals.total_users),
      activeUsers: Number(totals.active_users),
    },
    storage: {
      diskTotalBytes: disk.total,
      diskFreeBytes: disk.free,
      diskUsedBytes: disk.used,
    },
    recentUploads: recentUploads.map((r) => ({
      id: r.id,
      name: r.name,
      sizeBytes: Number(r.size_bytes),
      mimeType: r.mime_type,
      uploadedByName: r.uploaded_by_name,
      createdAt: r.created_at,
    })),
    recentDeletions: recentDeletions.map((r) => ({
      id: r.id,
      action: r.action,
      targetType: r.target_type,
      targetId: r.target_id,
      username: r.username,
      detail: parseMaybeJson(r.old_value) || parseMaybeJson(r.new_value),
      createdAt: r.created_at,
    })),
    recentlyActiveUsers: recentlyActive.map((r) => ({
      id: r.id,
      username: r.username,
      role: r.role,
      lastActive: r.last_active,
    })),
  };
}

function parseMaybeJson(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'object') return v;
  try {
    return JSON.parse(v);
  } catch (_) {
    return null;
  }
}

module.exports = { dashboardStats };
