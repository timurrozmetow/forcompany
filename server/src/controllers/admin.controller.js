'use strict';

const asyncHandler = require('../utils/asyncHandler');
const statsService = require('../services/stats.service');
const activityLog = require('../services/activityLog.service');

const dashboardStats = asyncHandler(async (req, res) => {
  const stats = await statsService.dashboardStats();
  res.json(stats);
});

const activityLogs = asyncHandler(async (req, res) => {
  const { limit, offset, userId, action } = req.query;
  const result = await activityLog.list({
    limit,
    offset,
    userId: userId ? Number(userId) : undefined,
    action: action || undefined,
  });
  res.json(result);
});

module.exports = { dashboardStats, activityLogs };
