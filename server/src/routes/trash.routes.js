'use strict';

const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const ctrl = require('../controllers/trash.controller');

const router = express.Router();

router.use(authenticate);

// Any authenticated user can view the trash (shared corporate storage).
router.get('/', ctrl.list);

// Restore and permanent deletion are ADMIN ONLY (per spec).
router.patch('/files/:id/restore', requireAdmin, ctrl.restoreFile);
router.patch('/folders/:id/restore', requireAdmin, ctrl.restoreFolder);
router.delete('/files/:id/permanent', requireAdmin, ctrl.permanentDeleteFile);
router.delete('/folders/:id/permanent', requireAdmin, ctrl.permanentDeleteFolder);

module.exports = router;
