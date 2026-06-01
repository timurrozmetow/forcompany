'use strict';

const AppError = require('../utils/AppError');
const logger = require('../utils/logger');
const config = require('../config');

function notFound(req, res, next) {
  next(AppError.notFound('Endpoint not found'));
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // Body-parser / JSON syntax errors
  if (err && err.type === 'entity.too.large') {
    err = AppError.payloadTooLarge('Request body too large');
  }
  if (err instanceof SyntaxError && 'body' in err) {
    err = AppError.badRequest('Malformed JSON body');
  }

  const isOperational = err instanceof AppError && err.isOperational;
  const statusCode = isOperational ? err.statusCode : 500;

  if (!isOperational) {
    // Unexpected: log full detail server-side, but never leak it to the client.
    logger.error('Unhandled error:', err && err.stack ? err.stack : err);
  }

  const body = {
    error: {
      message: isOperational ? err.message : 'Internal server error',
      code: err.code || (isOperational ? undefined : 'INTERNAL'),
    },
  };

  // Only expose stack in non-production for debugging.
  if (!config.isProd && !isOperational && err && err.stack) {
    body.error.stack = err.stack;
  }

  if (res.headersSent) {
    return next(err);
  }
  res.status(statusCode).json(body);
}

module.exports = { notFound, errorHandler };
