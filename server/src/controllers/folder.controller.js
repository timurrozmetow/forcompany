'use strict';

const asyncHandler = require('../utils/asyncHandler');
const { parseId } = require('../utils/validators');
const folderService = require('../services/folder.service');

const list = asyncHandler(async (req, res) => {
  const folders = await folderService.listFolders(req.query.parentId);
  const breadcrumbs = await folderService.getBreadcrumbs(req.query.parentId);
  res.json({ folders, breadcrumbs });
});

const create = asyncHandler(async (req, res) => {
  const { name, parentId } = req.body || {};
  const folder = await folderService.createFolder({
    name,
    parentId,
    actor: req.user,
    context: req.context,
  });
  res.status(201).json({ folder });
});

const rename = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const { name } = req.body || {};
  const folder = await folderService.renameFolder({
    id,
    name,
    actor: req.user,
    context: req.context,
  });
  res.json({ folder });
});

const move = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const { targetParentId } = req.body || {};
  const folder = await folderService.moveFolder({
    id,
    targetParentId,
    actor: req.user,
    context: req.context,
  });
  res.json({ folder });
});

const trash = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const result = await folderService.trashFolder({ id, actor: req.user, context: req.context });
  res.json(result);
});

module.exports = { list, create, rename, move, trash };
