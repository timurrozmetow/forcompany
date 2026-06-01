'use strict';

const asyncHandler = require('../utils/asyncHandler');
const { parseId } = require('../utils/validators');
const tagService = require('../services/tag.service');

const list = asyncHandler(async (req, res) => res.json({ tags: await tagService.listTags() }));

const create = asyncHandler(async (req, res) => {
  const { name, color } = req.body || {};
  const tag = await tagService.createTag({ name, color, actor: req.user });
  res.status(201).json({ tag });
});

const remove = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  res.json(await tagService.deleteTag(id));
});

const filesByTag = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  res.json({ files: await tagService.filesByTag(id) });
});

const ofFile = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  res.json({ tags: await tagService.fileTags(id) });
});

const attach = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const { tagId, name, color } = req.body || {};
  const tags = await tagService.attachTag({
    fileId: id,
    tagId: tagId ? Number(tagId) : null,
    name,
    color,
    actor: req.user,
  });
  res.json({ tags });
});

const detach = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const tagId = parseId(req.params.tagId);
  const tags = await tagService.detachTag({ fileId: id, tagId });
  res.json({ tags });
});

module.exports = { list, create, remove, filesByTag, ofFile, attach, detach };
