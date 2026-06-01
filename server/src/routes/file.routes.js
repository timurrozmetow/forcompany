'use strict';

const express = require('express');
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/file.controller');
const uploadCtrl = require('../controllers/upload.controller');
const zipCtrl = require('../controllers/zip.controller');

const router = express.Router();

router.use(authenticate);

router.get('/', ctrl.list);

// Simple single-request multipart upload (small files).
router.post('/upload', ctrl.upload);

// Chunked / resumable upload (large files, survives connection drops).
router.post('/upload/init', uploadCtrl.init);
router.get('/upload/:uploadId/status', uploadCtrl.status);
router.put('/upload/:uploadId/chunk/:index', uploadCtrl.chunk); // raw octet-stream body
router.post('/upload/:uploadId/complete', uploadCtrl.complete);
router.delete('/upload/:uploadId', uploadCtrl.abort);

// ZIP download of an arbitrary selection (two-step: create session -> stream).
router.post('/zip', zipCtrl.createSelection);
router.get('/zip/:sessionId', zipCtrl.downloadSelection);

// Per-file operations.
router.get('/:id/download', ctrl.download);
router.get('/:id/thumbnail', ctrl.thumbnail);
router.head('/:id/preview', ctrl.preview);
router.get('/:id/preview', ctrl.preview);
router.put('/:id', ctrl.rename);
router.patch('/:id/move', ctrl.move);
router.delete('/:id', ctrl.trash); // soft-delete -> trash

module.exports = router;
