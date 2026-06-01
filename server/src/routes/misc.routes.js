'use strict';

const express = require('express');
const { authenticate } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const library = require('../controllers/library.controller');
const comment = require('../controllers/comment.controller');
const notification = require('../controllers/notification.controller');
const { getDiskSpace } = require('../utils/diskSpace');
const { query } = require('../db/pool');
const config = require('../config');

const router = express.Router();
router.use(authenticate);

// Lightweight active-user list (id + username) for the "uploaded by" filter.
router.get(
  '/users/basic',
  asyncHandler(async (req, res) => {
    const users = await query(
      'SELECT id, username FROM users WHERE is_active = 1 ORDER BY username ASC'
    );
    res.json({ users });
  })
);

// Recent files for the current user.
router.get('/recent', library.recent);

// Delete a comment (author or admin — enforced in service).
router.delete('/comments/:id', comment.remove);

// In-app notifications (header bell).
router.get('/notifications', notification.list);
router.get('/notifications/unread-count', notification.unreadCount);
router.patch('/notifications/read', notification.markRead);

// Storage quota for the low-space banner (any authenticated user).
router.get(
  '/storage/quota',
  asyncHandler(async (req, res) => {
    const disk = await getDiskSpace();
    const ratio = disk.total ? disk.free / disk.total : null;
    res.json({
      totalBytes: disk.total,
      freeBytes: disk.free,
      usedBytes: disk.used,
      low: ratio !== null && ratio < config.lowSpaceWarnRatio,
      warnRatio: config.lowSpaceWarnRatio,
    });
  })
);

module.exports = router;
