'use strict';

const express = require('express');
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/workLog.controller');

const router = express.Router();
router.use(authenticate);

router.get('/', ctrl.list);
router.get('/summary', ctrl.summary);
router.get('/export', ctrl.exportReport); // ?format=pdf|docx|html&userId=&from=&to=
router.post('/', ctrl.create);
router.put('/:id', ctrl.update);
router.delete('/:id', ctrl.remove);

module.exports = router;
