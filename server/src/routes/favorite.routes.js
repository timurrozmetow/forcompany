'use strict';

const express = require('express');
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/library.controller');

const router = express.Router();
router.use(authenticate);

router.get('/', ctrl.listFavorites);
router.get('/ids', ctrl.favoriteIds);
router.post('/', ctrl.addFavorite);
router.delete('/', ctrl.removeFavorite);

module.exports = router;
