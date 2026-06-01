'use strict';

const asyncHandler = require('../utils/asyncHandler');
const { parseId } = require('../utils/validators');
const userService = require('../services/user.service');

const list = asyncHandler(async (req, res) => {
  const users = await userService.listUsers();
  res.json({ users });
});

const create = asyncHandler(async (req, res) => {
  const { username, password, role } = req.body || {};
  const user = await userService.createUser({
    username,
    password,
    role,
    actor: req.user,
    context: req.context,
  });
  res.status(201).json({ user });
});

const update = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const { username, role, isActive } = req.body || {};
  const user = await userService.updateUser({
    id,
    username,
    role,
    isActive,
    actor: req.user,
    context: req.context,
  });
  res.json({ user });
});

const changePassword = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const { password } = req.body || {};
  const result = await userService.changePassword({
    id,
    password,
    actor: req.user,
    context: req.context,
  });
  res.json(result);
});

const setBlocked = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const { blocked } = req.body || {};
  const user = await userService.setBlocked({
    id,
    blocked: !!blocked,
    actor: req.user,
    context: req.context,
  });
  res.json({ user });
});

const remove = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const result = await userService.deleteUser({ id, actor: req.user, context: req.context });
  res.json(result);
});

module.exports = { list, create, update, changePassword, setBlocked, remove };
