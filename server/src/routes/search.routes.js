'use strict';

const express = require('express');
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/search.controller');

const router = express.Router();

router.use(authenticate);
router.get('/', ctrl.search);

module.exports = router;
