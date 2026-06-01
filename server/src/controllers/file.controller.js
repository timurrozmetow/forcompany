'use strict';

const fs = require('fs');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { parseId, parseOptionalId } = require('../utils/validators');
const config = require('../config');
const fileService = require('../services/file.service');
const folderService = require('../services/folder.service');
const thumbnailService = require('../services/thumbnail.service');
const officePreviewService = require('../services/officePreview.service');
const activityLog = require('../services/activityLog.service');
const { streamUploadToDisk } = require('../utils/uploadStream');
const { deleteFromDisk } = require('../utils/storagePath');
const { sendFile } = require('../utils/streamFile');
const { assertEnoughSpace } = require('../utils/diskSpace');
const logger = require('../utils/logger');

const list = asyncHandler(async (req, res) => {
  const result = await fileService.listFiles(req.query.folderId, {
    limit: req.query.limit,
    offset: req.query.offset,
  });
  res.json(result); // { files, total, limit, offset }
});

const checkConflicts = asyncHandler(async (req, res) => {
  const { folderId, names } = req.body || {};
  const conflicts = await fileService.checkConflicts(folderId, names);
  res.json({ conflicts });
});

/**
 * Streaming multi-file upload. folderId via query string (?folderId=).
 * Files are written to disk by busboy (constant memory), then DB rows inserted.
 */
const upload = asyncHandler(async (req, res) => {
  const folderId = parseOptionalId(req.query.folderId);
  if (folderId !== null) {
    await folderService.getActiveFolderOrThrow(folderId); // 404 before reading body
  }

  const contentType = req.headers['content-type'] || '';
  if (!contentType.includes('multipart/form-data')) {
    throw AppError.badRequest('Expected multipart/form-data');
  }

  // Best-effort space check using the request body size.
  const contentLength = Number(req.headers['content-length'] || 0);
  if (contentLength > 0) await assertEnoughSpace(contentLength);

  const persisted = await streamUploadToDisk(req, {
    maxBytes: config.storage.maxFileSizeBytes,
  });

  const replace = req.query.replace === '1' || req.query.replace === 'true';
  const created = [];
  for (const meta of persisted) {
    try {
      const file = await fileService.createFileRecord({
        folderId,
        originalName: meta.originalName,
        storedName: meta.storedName,
        storagePath: meta.relativePath,
        mimeType: meta.mimeType,
        extension: meta.extension,
        sizeBytes: meta.sizeBytes,
        actor: req.user,
        context: req.context,
      });
      if (replace) {
        await fileService.replaceOlderVersions({
          folderId,
          name: meta.originalName,
          keepFileId: file.id,
          actor: req.user,
          context: req.context,
        });
      }
      created.push(file);
    } catch (err) {
      // DB insert failed -> remove the orphaned bytes from disk.
      logger.error('createFileRecord failed, cleaning disk:', err.message);
      try {
        await deleteFromDisk(meta.relativePath);
      } catch (_) {
        /* ignore */
      }
      throw err;
    }
  }

  res.status(201).json({ files: created });
});

const download = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const { file, absolutePath } = await fileService.resolveForStreaming(id);

  await activityLog.log({
    userId: req.user.id,
    action: activityLog.ACTIONS.DOWNLOAD_FILE,
    targetType: 'file',
    targetId: file.id,
    newValue: { name: file.original_name },
    context: req.context,
  });

  await sendFile(req, res, {
    absolutePath,
    mimeType: file.mime_type,
    fileName: file.original_name,
    sizeBytes: Number(file.size_bytes),
    mode: 'download',
  });
});

const preview = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const { file, absolutePath } = await fileService.resolveForStreaming(id);

  // Log only the first request of a ranged stream (range start 0 or no range)
  // to avoid spamming logs while a video seeks.
  const range = req.headers.range;
  if (!range || /^bytes=0-/.test(range)) {
    await activityLog.log({
      userId: req.user.id,
      action: activityLog.ACTIONS.PREVIEW_FILE,
      targetType: 'file',
      targetId: file.id,
      newValue: { name: file.original_name },
      context: req.context,
    });
  }

  await sendFile(req, res, {
    absolutePath,
    mimeType: file.mime_type,
    fileName: file.original_name,
    sizeBytes: Number(file.size_bytes),
    mode: 'inline',
  });
});

const thumbnail = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const file = await fileService.getActiveFileOrThrow(id);
  const thumbPath = await thumbnailService.getOrCreateThumb(file);
  if (!thumbPath) throw AppError.notFound('No thumbnail for this file type', 'NO_THUMB');

  res.setHeader('Content-Type', 'image/webp');
  res.setHeader('Cache-Control', 'private, max-age=86400');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const stream = fs.createReadStream(thumbPath);
  stream.on('error', () => {
    if (!res.headersSent) res.status(404);
    res.end();
  });
  res.on('close', () => stream.destroy());
  stream.pipe(res);
});

const officePreview = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const file = await fileService.getActiveFileOrThrow(id);
  const pdfPath = await officePreviewService.getOrCreatePdf(file);
  if (!pdfPath) throw AppError.badRequest('Not an office document', 'NOT_OFFICE');

  await activityLog.log({
    userId: req.user.id,
    action: activityLog.ACTIONS.PREVIEW_FILE,
    targetType: 'file',
    targetId: file.id,
    newValue: { name: file.original_name, office: true },
    context: req.context,
  });

  await sendFile(req, res, {
    absolutePath: pdfPath,
    mimeType: 'application/pdf',
    fileName: `${file.original_name.replace(/\.[^.]+$/, '')}.pdf`,
    mode: 'inline',
  });
});

const rename = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const { name } = req.body || {};
  const file = await fileService.renameFile({ id, name, actor: req.user, context: req.context });
  res.json({ file });
});

const move = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const { targetFolderId } = req.body || {};
  const file = await fileService.moveFile({
    id,
    targetFolderId,
    actor: req.user,
    context: req.context,
  });
  res.json({ file });
});

const trash = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const result = await fileService.trashFile({ id, actor: req.user, context: req.context });
  res.json(result);
});

module.exports = {
  list,
  checkConflicts,
  upload,
  download,
  preview,
  thumbnail,
  officePreview,
  rename,
  move,
  trash,
};
