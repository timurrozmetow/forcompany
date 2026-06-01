'use strict';

const asyncHandler = require('../utils/asyncHandler');
const searchService = require('../services/search.service');

const search = asyncHandler(async (req, res) => {
  const result = await searchService.search(req.query.q);
  res.json(result);
});

module.exports = { search };
