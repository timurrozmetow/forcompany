'use strict';

const asyncHandler = require('../utils/asyncHandler');
const lib = require('../services/library.service');

function bodyTarget(req) {
  const { fileId, folderId } = req.body || {};
  return {
    fileId: fileId ? Number(fileId) : null,
    folderId: folderId ? Number(folderId) : null,
  };
}

const listFavorites = asyncHandler(async (req, res) => res.json(await lib.listFavorites(req.user.id)));
const favoriteIds = asyncHandler(async (req, res) => res.json(await lib.favoriteIds(req.user.id)));
const addFavorite = asyncHandler(async (req, res) =>
  res.json(await lib.addFavorite(req.user.id, bodyTarget(req)))
);
const removeFavorite = asyncHandler(async (req, res) =>
  res.json(await lib.removeFavorite(req.user.id, bodyTarget(req)))
);
const recent = asyncHandler(async (req, res) =>
  res.json({ files: await lib.listRecent(req.user.id, req.query.limit) })
);

module.exports = { listFavorites, favoriteIds, addFavorite, removeFavorite, recent };
