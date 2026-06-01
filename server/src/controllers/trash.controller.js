'use strict';

const asyncHandler = require('../utils/asyncHandler');
const { parseId } = require('../utils/validators');
const trashService = require('../services/trash.service');

const list = asyncHandler(async (req, res) => {
  const result = await trashService.listTrash();
  res.json(result);
});

const restoreFile = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const result = await trashService.restoreFile({ id, actor: req.user, context: req.context });
  res.json(result);
});

const restoreFolder = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const result = await trashService.restoreFolder({ id, actor: req.user, context: req.context });
  res.json(result);
});

// Admin only (enforced at route level).
const permanentDeleteFile = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const result = await trashService.permanentDeleteFile({ id, actor: req.user, context: req.context });
  res.json(result);
});

const permanentDeleteFolder = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const result = await trashService.permanentDeleteFolder({ id, actor: req.user, context: req.context });
  res.json(result);
});

module.exports = {
  list,
  restoreFile,
  restoreFolder,
  permanentDeleteFile,
  permanentDeleteFolder,
};
