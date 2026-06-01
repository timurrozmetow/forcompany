'use strict';

const asyncHandler = require('../utils/asyncHandler');
const { parseId } = require('../utils/validators');
const commentService = require('../services/comment.service');

const list = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  res.json({ comments: await commentService.listComments(id) });
});

const add = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const { body } = req.body || {};
  const comment = await commentService.addComment({ fileId: id, body, actor: req.user });
  res.status(201).json({ comment });
});

const remove = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  res.json(await commentService.deleteComment({ id, actor: req.user }));
});

module.exports = { list, add, remove };
