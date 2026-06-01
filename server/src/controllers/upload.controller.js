'use strict';

const asyncHandler = require('../utils/asyncHandler');
const chunkUpload = require('../services/chunkUpload.service');

const init = asyncHandler(async (req, res) => {
  const { name, size, folderId, mimeType, chunkSize } = req.body || {};
  const result = await chunkUpload.init({
    name,
    size,
    folderId,
    mimeType,
    chunkSize,
    actor: req.user,
  });
  res.status(201).json(result);
});

const status = asyncHandler(async (req, res) => {
  const result = await chunkUpload.status(req.params.uploadId, req.user);
  res.json(result);
});

// Raw body — no JSON/multipart parsing on this route.
const chunk = asyncHandler(async (req, res) => {
  const result = await chunkUpload.writeChunk(req.params.uploadId, req.params.index, req, req.user);
  res.json(result);
});

const complete = asyncHandler(async (req, res) => {
  const file = await chunkUpload.complete(req.params.uploadId, req.user, req.context);
  res.status(201).json({ file });
});

const abort = asyncHandler(async (req, res) => {
  const result = await chunkUpload.abort(req.params.uploadId, req.user);
  res.json(result);
});

module.exports = { init, status, chunk, complete, abort };
