'use strict';

const fs = require('fs');
const config = require('../config');
const AppError = require('./AppError');

// Keep at least this much free so the OS/DB never run out because of uploads.
const SAFETY_MARGIN_BYTES = 512 * 1024 * 1024; // 512 MB

/**
 * Free / total / used bytes for the filesystem holding the storage dir.
 * Uses fs.statfs (Node >= 18.15) — no external dependency.
 */
async function getDiskSpace(targetPath = config.storage.dir) {
  try {
    const s = await fs.promises.statfs(targetPath);
    const total = s.blocks * s.bsize;
    const free = s.bavail * s.bsize;
    return { total, free, used: Math.max(total - free, 0) };
  } catch (err) {
    // statfs unsupported / path missing — report unknown rather than crash.
    return { total: null, free: null, used: null };
  }
}

/**
 * Throws 507 if storing `needBytes` more would leave less than the safety
 * margin free. No-op when disk info is unavailable.
 */
async function assertEnoughSpace(needBytes, targetPath = config.storage.dir) {
  const { free } = await getDiskSpace(targetPath);
  if (free === null) return; // can't tell -> don't block
  if (free - Number(needBytes || 0) < SAFETY_MARGIN_BYTES) {
    throw new AppError(507, 'Not enough free disk space on the server', 'NO_SPACE');
  }
}

module.exports = { getDiskSpace, assertEnoughSpace, SAFETY_MARGIN_BYTES };
