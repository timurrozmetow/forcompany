'use strict';

const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { parseId } = require('../utils/validators');
const zipService = require('../services/zip.service');

// POST /api/files/zip  { fileIds:[], folderIds:[] }  -> { sessionId }
const createSelection = asyncHandler(async (req, res) => {
  const { fileIds, folderIds } = req.body || {};
  const fids = Array.isArray(fileIds) ? fileIds : [];
  const folds = Array.isArray(folderIds) ? folderIds : [];
  if (fids.length + folds.length === 0) {
    throw AppError.badRequest('Select at least one item');
  }
  if (fids.length + folds.length > 5000) {
    throw AppError.badRequest('Too many items selected');
  }
  const sessionId = zipService.createSession(req.user.id, fids, folds);
  res.status(201).json({ sessionId });
});

// GET /api/files/zip/:sessionId  -> streams selection.zip
const downloadSelection = asyncHandler(async (req, res) => {
  await zipService.streamSelectionZip(res, req.params.sessionId, req.user, req.context);
});

// GET /api/folders/:id/zip -> streams folder.zip
const downloadFolder = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  await zipService.streamFolderZip(res, id, req.user, req.context);
});

module.exports = { createSelection, downloadSelection, downloadFolder };
