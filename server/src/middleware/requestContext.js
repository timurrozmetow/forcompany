'use strict';

/**
 * Attaches a normalized client context (ip, userAgent) to req.context so
 * controllers/services can log activity without re-deriving it each time.
 */
module.exports = function requestContext(req, res, next) {
  const ip =
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.ip ||
    req.socket?.remoteAddress ||
    null;

  const userAgent = (req.headers['user-agent'] || '').slice(0, 512) || null;

  req.context = {
    ip: ip ? String(ip).slice(0, 64) : null,
    userAgent,
  };
  next();
};
