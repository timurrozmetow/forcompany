'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const busboy = require('busboy');
const mime = require('mime-types');

const {
  buildRelativePath,
  resolveStoragePath,
  sanitizeExtension,
} = require('./storagePath');
const AppError = require('./AppError');
const logger = require('./logger');

const MAX_FILES_PER_REQUEST = 100;
// Control characters 0x00-0x1f used to scrub filenames.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS_RE = /[\x00-\x1f]/g;

/**
 * Streams a multipart/form-data upload straight to disk using busboy.
 * - No file is ever buffered fully in memory (constant memory usage).
 * - Enforces a per-file byte limit (maxBytes); over-limit parts are rejected
 *   and their partial bytes removed.
 * - On any error or client abort, every partial file written so far is deleted.
 *
 * Resolves with an array describing each persisted file:
 *   { storedName, relativePath, mimeType, extension, sizeBytes, originalName }
 *
 * The caller is responsible for inserting DB rows (and removing disk files if
 * the DB insert later fails).
 */
function streamUploadToDisk(req, { maxBytes }) {
  return new Promise((resolve, reject) => {
    let bb;
    try {
      bb = busboy({
        headers: req.headers,
        limits: {
          fileSize: maxBytes,
          files: MAX_FILES_PER_REQUEST,
          fields: 20,
        },
      });
    } catch (err) {
      return reject(AppError.badRequest('Invalid upload request'));
    }

    const writtenPaths = []; // absolute paths to clean up on failure
    const pending = []; // per-file promises
    const results = [];
    let settled = false;
    let tooManyFiles = false;

    function cleanupAll() {
      for (const p of writtenPaths) {
        fs.rm(p, { force: true }, () => {});
      }
    }

    function fail(err) {
      if (settled) return;
      settled = true;
      cleanupAll();
      reject(err);
    }

    function succeed() {
      if (settled) return;
      settled = true;
      resolve(results);
    }

    bb.on('file', (fieldname, fileStream, info) => {
      const originalName = sanitizeOriginalName(info.filename);
      const ext = sanitizeExtension(path.extname(originalName));
      const storedName = `${crypto.randomUUID()}${ext}`;
      const relativePath = buildRelativePath(storedName);

      let absolutePath;
      try {
        absolutePath = resolveStoragePath(relativePath);
      } catch (err) {
        fileStream.resume(); // drain
        return fail(err);
      }

      // Pause until the destination directory exists, then pipe.
      fileStream.pause();

      const writePromise = fs.promises
        .mkdir(path.dirname(absolutePath), { recursive: true })
        .then(
          () =>
            new Promise((res, rej) => {
              const ws = fs.createWriteStream(absolutePath);
              writtenPaths.push(absolutePath);
              let size = 0;
              let limitHit = false;

              fileStream.on('data', (chunk) => {
                size += chunk.length;
              });
              fileStream.on('limit', () => {
                limitHit = true;
              });
              fileStream.on('error', (err) => {
                ws.destroy();
                rej(err);
              });
              ws.on('error', (err) => rej(err));
              ws.on('close', () => {
                if (limitHit) {
                  return rej(
                    AppError.payloadTooLarge(
                      `File "${originalName}" exceeds the size limit`,
                      'FILE_TOO_LARGE'
                    )
                  );
                }
                const mimeType =
                  info.mimeType && info.mimeType !== 'application/octet-stream'
                    ? info.mimeType
                    : mime.lookup(originalName) || 'application/octet-stream';

                res({
                  storedName,
                  relativePath,
                  mimeType,
                  extension: ext.replace(/^\./, ''),
                  sizeBytes: size,
                  originalName,
                });
              });

              fileStream.pipe(ws);
              fileStream.resume();
            })
        )
        .then((meta) => {
          results.push(meta);
        });

      pending.push(writePromise);
    });

    bb.on('filesLimit', () => {
      tooManyFiles = true;
    });

    bb.on('error', (err) => fail(err));

    bb.on('close', () => {
      if (tooManyFiles) {
        return fail(AppError.badRequest(`Too many files (max ${MAX_FILES_PER_REQUEST})`));
      }
      Promise.all(pending).then(succeed).catch(fail);
    });

    // Client aborted the request mid-upload.
    req.on('aborted', () => {
      logger.warn('Upload aborted by client');
      fail(AppError.badRequest('Upload aborted', 'UPLOAD_ABORTED'));
    });
    req.on('error', (err) => fail(err));

    req.pipe(bb);
  });
}

function sanitizeOriginalName(name) {
  let n = (name || 'file').toString();
  // Strip any path component a client might send.
  n = n.replace(/^.*[\\/]/, '').trim();
  // Remove control chars.
  n = n.replace(CONTROL_CHARS_RE, '');
  if (!n) n = 'file';
  return n.slice(0, 255);
}

module.exports = { streamUploadToDisk, MAX_FILES_PER_REQUEST };
