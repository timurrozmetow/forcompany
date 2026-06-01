'use strict';

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const config = require('../config');
const AppError = require('./AppError');

const STORAGE_DIR = config.storage.dir;

/**
 * Build a sharded relative path for a generated UUID name, e.g.
 *   "ab/cd/abcdef12-....bin"
 * Sharding keeps directories from holding millions of entries.
 */
function buildRelativePath(storedName) {
  const a = storedName.slice(0, 2);
  const b = storedName.slice(2, 4);
  return path.posix.join(a, b, storedName);
}

/**
 * Resolve a stored relative path to an absolute path on disk, GUARANTEEING the
 * result stays inside STORAGE_DIR (anti path-traversal). Any attempt to escape
 * throws. The relative path comes from our DB (UUID based), never from user
 * input, but we validate defensively regardless.
 */
function resolveStoragePath(relativePath) {
  if (typeof relativePath !== 'string' || relativePath.length === 0) {
    throw AppError.internal('Invalid storage path');
  }
  // Normalize and strip any leading separators / drive letters.
  const normalized = path
    .normalize(relativePath)
    .replace(/^([/\\])+/, '');
  const absolute = path.resolve(STORAGE_DIR, normalized);

  const root = path.resolve(STORAGE_DIR);
  const rel = path.relative(root, absolute);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw AppError.forbidden('Path traversal detected', 'PATH_TRAVERSAL');
  }
  return absolute;
}

/**
 * Generate a fresh unique stored name + relative path and ensure its directory
 * exists. Returns { storedName, relativePath, absolutePath }.
 */
async function allocateStorageTarget(extension = '') {
  const ext = sanitizeExtension(extension);
  const storedName = `${crypto.randomUUID()}${ext}`;
  const relativePath = buildRelativePath(storedName);
  const absolutePath = resolveStoragePath(relativePath);
  await fs.promises.mkdir(path.dirname(absolutePath), { recursive: true });
  return { storedName, relativePath, absolutePath };
}

/**
 * Keep only a short, safe extension (letters/digits) with a single leading dot.
 */
function sanitizeExtension(ext) {
  if (!ext) return '';
  let e = String(ext).trim().toLowerCase();
  if (e.startsWith('.')) e = e.slice(1);
  e = e.replace(/[^a-z0-9]/g, '');
  if (!e) return '';
  return `.${e.slice(0, 16)}`;
}

async function ensureStorageDir() {
  await fs.promises.mkdir(STORAGE_DIR, { recursive: true });
}

async function deleteFromDisk(relativePath) {
  const absolute = resolveStoragePath(relativePath);
  await fs.promises.rm(absolute, { force: true });
}

module.exports = {
  STORAGE_DIR,
  buildRelativePath,
  resolveStoragePath,
  allocateStorageTarget,
  sanitizeExtension,
  ensureStorageDir,
  deleteFromDisk,
};
