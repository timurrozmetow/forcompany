'use strict';

const express = require('express');

const authRoutes = require('./auth.routes');
const adminRoutes = require('./admin.routes');
const folderRoutes = require('./folder.routes');
const fileRoutes = require('./file.routes');
const searchRoutes = require('./search.routes');
const trashRoutes = require('./trash.routes');
const tagRoutes = require('./tag.routes');
const favoriteRoutes = require('./favorite.routes');
const worklogRoutes = require('./worklog.routes');
const miscRoutes = require('./misc.routes');

const db = require('../db/pool');
const { getDiskSpace } = require('../utils/diskSpace');

const router = express.Router();

// Richer healthcheck for uptime monitors: verifies DB connectivity + reports
// free disk. Returns 503 if the database is unreachable.
router.get('/health', async (req, res) => {
  const health = { status: 'ok', time: new Date().toISOString(), db: 'ok', disk: null };
  try {
    await db.ping();
  } catch (_) {
    health.status = 'degraded';
    health.db = 'down';
  }
  try {
    const disk = await getDiskSpace();
    health.disk = { freeBytes: disk.free, totalBytes: disk.total };
  } catch (_) {
    /* ignore */
  }
  res.status(health.db === 'ok' ? 200 : 503).json(health);
});

router.use('/auth', authRoutes);
router.use('/admin', adminRoutes);
router.use('/folders', folderRoutes);
router.use('/files', fileRoutes);
router.use('/search', searchRoutes);
router.use('/trash', trashRoutes);
router.use('/tags', tagRoutes);
router.use('/favorites', favoriteRoutes);
router.use('/worklogs', worklogRoutes);
router.use('/', miscRoutes); // /recent, /comments/:id, /storage/quota

module.exports = router;
