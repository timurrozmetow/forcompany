'use strict';

const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const authService = require('../services/auth.service');

const login = asyncHandler(async (req, res) => {
  const { username, password } = req.body || {};
  if (typeof username !== 'string' || typeof password !== 'string' || !username || !password) {
    throw AppError.badRequest('Username and password are required');
  }
  const result = await authService.login({
    username: username.trim(),
    password,
    context: req.context,
  });
  res.json(result);
});

const me = asyncHandler(async (req, res) => {
  const user = await authService.getMe(req.user.id);
  res.json({ user });
});

const logout = asyncHandler(async (req, res) => {
  await authService.logout({ userId: req.user.id, context: req.context });
  res.json({ success: true });
});

module.exports = { login, me, logout };
