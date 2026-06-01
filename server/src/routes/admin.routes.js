'use strict';

const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const users = require('../controllers/user.controller');
const admin = require('../controllers/admin.controller');

const router = express.Router();

// All admin routes require a valid JWT AND admin role.
router.use(authenticate, requireAdmin);

// Users management
router.get('/users', users.list);
router.post('/users', users.create);
router.put('/users/:id', users.update);
router.patch('/users/:id/password', users.changePassword);
router.patch('/users/:id/block', users.setBlocked);
router.delete('/users/:id', users.remove);

// Dashboard + logs
router.get('/dashboard/stats', admin.dashboardStats);
router.get('/activity-logs', admin.activityLogs);

// Notifications
router.post('/notify/test', admin.notifyTest);
router.get('/notify/telegram-chats', admin.telegramChats);

module.exports = router;
