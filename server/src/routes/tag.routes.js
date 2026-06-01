'use strict';

const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const ctrl = require('../controllers/tag.controller');

const router = express.Router();
router.use(authenticate);

router.get('/', ctrl.list);
router.post('/', ctrl.create);
router.get('/:id/files', ctrl.filesByTag);
router.delete('/:id', requireAdmin, ctrl.remove); // deleting a tag is admin-only

module.exports = router;
