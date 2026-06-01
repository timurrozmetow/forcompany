'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mime = require('mime-types');

const config = require('../config');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');
const { assertEnoughSpace } = require('../utils/diskSpace');
const {
  STORAGE_DIR,
  allocateStorageTarget,
  sanitizeExtension,
  resolveStoragePath,
} = require('../utils/storagePath');
const fileService = require('./file.service');
const folderService = require('./folder.service');

const TMP_DIR = path.join(STORAGE_DIR, '.uploads_tmp');
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_CHUNK = 8 * 1024 * 1024; // 8 MB
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24h

function sessionDir(uploadId) {
  if (!UUID_RE.test(uploadId)) throw AppError.badRequest('Invalid upload id');
  const dir = path.join(TMP_DIR, uploadId);
  // Defensive: ensure it stays under TMP_DIR.
  const rel = path.relative(TMP_DIR, dir);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw AppError.forbidden('Path traversal detected', 'PATH_TRAVERSAL');
  }
  return dir;
}

async function readMeta(uploadId, actor) {
  const dir = sessionDir(uploadId);
  let meta;
  try {
    meta = JSON.parse(await fs.promises.readFile(path.join(dir, 'meta.json'), 'utf8'));
  } catch (_) {
    throw AppError.notFound('Upload session not found', 'NO_SESSION');
  }
  if (actor && Number(meta.uploadedBy) !== Number(actor.id)) {
    throw AppError.forbidden('Not your upload session');
  }
  return { dir, meta };
}

/**
 * Start (or describe) a chunked upload. Returns the uploadId, the chunk size to
 * use, and which chunk indices are already on disk (for resume).
 */
async function init({ name, size, folderId, mimeType, chunkSize, actor }) {
  const totalSize = Number(size);
  if (!Number.isFinite(totalSize) || totalSize < 0) throw AppError.badRequest('Invalid size');
  if (totalSize > config.storage.maxFileSizeBytes) {
    throw AppError.payloadTooLarge(
      `File exceeds the ${config.storage.maxFileSizeGb} GB limit`,
      'FILE_TOO_LARGE'
    );
  }
  const fid = folderId === undefined || folderId === null || folderId === '' ? null : Number(folderId);
  if (fid !== null) await folderService.getActiveFolderOrThrow(fid);

  await assertEnoughSpace(totalSize);

  const cs = Math.min(Math.max(Number(chunkSize) || DEFAULT_CHUNK, 1024 * 1024), 64 * 1024 * 1024);
  const uploadId = crypto.randomUUID();
  const dir = sessionDir(uploadId);
  await fs.promises.mkdir(dir, { recursive: true });

  const meta = {
    uploadId,
    originalName: String(name || 'file').slice(0, 255),
    size: totalSize,
    folderId: fid,
    mimeType: mimeType || mime.lookup(String(name || '')) || 'application/octet-stream',
    chunkSize: cs,
    totalChunks: Math.max(1, Math.ceil(totalSize / cs)),
    uploadedBy: actor.id,
    createdAt: Date.now(),
  };
  await fs.promises.writeFile(path.join(dir, 'meta.json'), JSON.stringify(meta));

  return { uploadId, chunkSize: cs, totalChunks: meta.totalChunks, received: [] };
}

async function status(uploadId, actor) {
  const { dir, meta } = await readMeta(uploadId, actor);
  const received = await receivedIndices(dir);
  return { uploadId, chunkSize: meta.chunkSize, totalChunks: meta.totalChunks, received, size: meta.size };
}

async function receivedIndices(dir) {
  let files;
  try {
    files = await fs.promises.readdir(dir);
  } catch (_) {
    return [];
  }
  return files
    .filter((f) => f.endsWith('.part'))
    .map((f) => parseInt(f.replace('.part', ''), 10))
    .filter((n) => Number.isInteger(n) && n >= 0)
    .sort((a, b) => a - b);
}

/**
 * Stream one chunk's raw body to disk. Written to a .tmp file then atomically
 * renamed to {index}.part so a half-written chunk never counts as received.
 */
function writeChunk(uploadId, index, req, actor) {
  return new Promise((resolve, reject) => {
    const idx = Number(index);
    if (!Number.isInteger(idx) || idx < 0) return reject(AppError.badRequest('Invalid chunk index'));

    readMeta(uploadId, actor)
      .then(({ dir, meta }) => {
        if (idx >= meta.totalChunks) return reject(AppError.badRequest('Chunk index out of range'));
        const maxChunkBytes = meta.chunkSize * 2 + 1024; // generous slack
        const tmpPath = path.join(dir, `${idx}.part.tmp`);
        const finalPath = path.join(dir, `${idx}.part`);

        const ws = fs.createWriteStream(tmpPath);
        let size = 0;
        let aborted = false;

        const fail = (err) => {
          if (aborted) return;
          aborted = true;
          ws.destroy();
          fs.rm(tmpPath, { force: true }, () => {});
          reject(err);
        };

        req.on('data', (chunk) => {
          size += chunk.length;
          if (size > maxChunkBytes) fail(AppError.payloadTooLarge('Chunk too large'));
        });
        req.on('aborted', () => fail(AppError.badRequest('Chunk upload aborted', 'UPLOAD_ABORTED')));
        req.on('error', fail);
        ws.on('error', fail);
        ws.on('close', () => {
          if (aborted) return;
          fs.rename(tmpPath, finalPath, (err) => {
            if (err) return fail(AppError.internal('Failed to persist chunk'));
            resolve({ index: idx, size });
          });
        });

        req.pipe(ws);
      })
      .catch(reject);
  });
}

/**
 * Assemble all chunks into the final stored file, create the DB row, clean up.
 */
async function complete(uploadId, actor, context) {
  const { dir, meta } = await readMeta(uploadId, actor);
  const received = await receivedIndices(dir);

  if (received.length !== meta.totalChunks) {
    throw AppError.badRequest(
      `Missing chunks: have ${received.length}/${meta.totalChunks}`,
      'INCOMPLETE'
    );
  }
  for (let i = 0; i < meta.totalChunks; i += 1) {
    if (!received.includes(i)) throw AppError.badRequest(`Missing chunk ${i}`, 'INCOMPLETE');
  }

  const ext = sanitizeExtension(path.extname(meta.originalName));
  const target = await allocateStorageTarget(ext);

  // Concatenate parts in order into the final file (streamed, low memory).
  await assembleParts(dir, meta.totalChunks, target.absolutePath);

  const stat = await fs.promises.stat(target.absolutePath);
  if (meta.size && stat.size !== meta.size) {
    await fs.promises.rm(target.absolutePath, { force: true });
    throw AppError.badRequest(
      `Assembled size mismatch (${stat.size} != ${meta.size})`,
      'SIZE_MISMATCH'
    );
  }

  let file;
  try {
    file = await fileService.createFileRecord({
      folderId: meta.folderId,
      originalName: meta.originalName,
      storedName: target.storedName,
      storagePath: target.relativePath,
      mimeType: meta.mimeType,
      extension: ext.replace(/^\./, ''),
      sizeBytes: stat.size,
      actor,
      context,
    });
  } catch (err) {
    await fs.promises.rm(target.absolutePath, { force: true });
    throw err;
  }

  // Cleanup temp session (best effort).
  fs.rm(dir, { recursive: true, force: true }, () => {});
  return file;
}

function assembleParts(dir, totalChunks, destAbsolute) {
  return new Promise((resolve, reject) => {
    const out = fs.createWriteStream(destAbsolute);
    out.on('error', reject);

    let i = 0;
    const next = () => {
      if (i >= totalChunks) {
        out.end();
        return;
      }
      const partPath = path.join(dir, `${i}.part`);
      const rs = fs.createReadStream(partPath);
      rs.on('error', reject);
      rs.on('end', () => {
        i += 1;
        next();
      });
      rs.pipe(out, { end: false });
    };

    out.on('finish', resolve);
    next();
  });
}

async function abort(uploadId, actor) {
  const { dir } = await readMeta(uploadId, actor);
  await fs.promises.rm(dir, { recursive: true, force: true });
  return { success: true };
}

/**
 * Remove abandoned sessions older than the TTL. Called on startup + daily.
 */
async function sweepStaleSessions() {
  let entries;
  try {
    entries = await fs.promises.readdir(TMP_DIR);
  } catch (_) {
    return;
  }
  const now = Date.now();
  for (const id of entries) {
    try {
      const metaPath = path.join(TMP_DIR, id, 'meta.json');
      const meta = JSON.parse(await fs.promises.readFile(metaPath, 'utf8'));
      if (now - (meta.createdAt || 0) > SESSION_TTL_MS) {
        await fs.promises.rm(path.join(TMP_DIR, id), { recursive: true, force: true });
        logger.info(`[chunkUpload] swept stale session ${id}`);
      }
    } catch (_) {
      /* ignore malformed session dirs */
    }
  }
}

module.exports = { init, status, writeChunk, complete, abort, sweepStaleSessions, TMP_DIR };
