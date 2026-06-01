'use strict';

const asyncHandler = require('../utils/asyncHandler');
const searchService = require('../services/search.service');

const search = asyncHandler(async (req, res) => {
  const { q, type, uploadedBy, dateFrom, dateTo, tagId } = req.query;
  const result = await searchService.search(q, { type, uploadedBy, dateFrom, dateTo, tagId });
  res.json(result);
});

module.exports = { search };
