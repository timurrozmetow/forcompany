'use strict';

const rateLimit = require('express-rate-limit');

/**
 * Strict limiter for the login endpoint to slow down brute-force attempts.
 * 10 attempts / 15 min per IP.
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: 'Too many login attempts. Try again later.', code: 'RATE_LIMITED' } },
});

/**
 * General API limiter (generous) to dampen abuse without hurting normal use.
 */
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: 'Too many requests. Slow down.', code: 'RATE_LIMITED' } },
});

module.exports = { loginLimiter, apiLimiter };
