'use strict';

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const AppError = require('../utils/AppError');
const logger = require('../utils/logger');
const { resolveStoragePath } = require('../utils/storagePath');

const THUMB_MAX = 480; // px, longest side
const THUMB_SUBDIR = '.thumbs';

// Avoid huge memory on giant images.
sharp.cache(false);
sharp.concurrency(1);

function isThumbnailable(mimeType) {
  return typeof mimeType === 'string' && mimeType.startsWith('image/') && mimeType !== 'image/svg+xml';
}

function thumbRelPath(storedName) {
  const a = storedName.slice(0, 2);
  const b = storedName.slice(2, 4);
  return path.posix.join(THUMB_SUBDIR, a, b, `${storedName}.webp`);
}

/**
 * Returns the absolute path to a cached webp thumbnail, generating it on first
 * request. Returns null if the file isn't an image we can process.
 */
async function getOrCreateThumb(file) {
  if (!isThumbnailable(file.mime_type)) return null;

  const thumbAbs = resolveStoragePath(thumbRelPath(file.stored_name));
  try {
    await fs.promises.access(thumbAbs);
    return thumbAbs; // cached
  } catch (_) {
    /* generate below */
  }

  const srcAbs = resolveStoragePath(file.storage_path);
  await fs.promises.mkdir(path.dirname(thumbAbs), { recursive: true });

  try {
    await sharp(srcAbs, { failOn: 'none', limitInputPixels: 268402689 })
      .rotate() // respect EXIF orientation
      .resize(THUMB_MAX, THUMB_MAX, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 72 })
      .toFile(thumbAbs);
    return thumbAbs;
  } catch (err) {
    logger.warn(`thumbnail generation failed for file ${file.id}: ${err.message}`);
    // Clean a possibly half-written file.
    fs.rm(thumbAbs, { force: true }, () => {});
    throw AppError.notFound('Thumbnail not available', 'NO_THUMB');
  }
}

/** Remove a cached thumbnail when a file is permanently deleted (best effort). */
async function removeThumb(storedName) {
  try {
    await fs.promises.rm(resolveStoragePath(thumbRelPath(storedName)), { force: true });
  } catch (_) {
    /* ignore */
  }
}

module.exports = { getOrCreateThumb, removeThumb, isThumbnailable };
