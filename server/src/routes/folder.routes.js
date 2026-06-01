'use strict';

const express = require('express');
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/folder.controller');
const zipCtrl = require('../controllers/zip.controller');

const router = express.Router();

router.use(authenticate);

router.get('/', ctrl.list);
router.post('/', ctrl.create);
router.get('/:id/zip', zipCtrl.downloadFolder); // download whole folder as ZIP
router.put('/:id', ctrl.rename);
router.patch('/:id/move', ctrl.move);
router.delete('/:id', ctrl.trash); // soft-delete -> trash

module.exports = router;
