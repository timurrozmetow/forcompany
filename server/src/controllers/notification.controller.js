'use strict';

const asyncHandler = require('../utils/asyncHandler');
const notification = require('../services/notification.service');

const list = asyncHandler(async (req, res) => {
  const [items, unread] = await Promise.all([
    notification.list(req.user.id, { limit: req.query.limit, offset: req.query.offset }),
    notification.unreadCount(req.user.id),
  ]);
  res.json({ items, unread });
});

const unreadCount = asyncHandler(async (req, res) => {
  res.json({ count: await notification.unreadCount(req.user.id) });
});

const markRead = asyncHandler(async (req, res) => {
  const { id } = req.body || {};
  res.json(await notification.markRead(req.user.id, id ? Number(id) : null));
});

module.exports = { list, unreadCount, markRead };
