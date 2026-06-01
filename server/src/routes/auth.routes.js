'use strict';

const express = require('express');
const { authenticate } = require('../middleware/auth');
const { loginLimiter } = require('../middleware/rateLimit');
const ctrl = require('../controllers/auth.controller');

const router = express.Router();

router.post('/login', loginLimiter, ctrl.login);
router.get('/me', authenticate, ctrl.me);
router.post('/logout', authenticate, ctrl.logout);

module.exports = router;
