'use strict';

/**
 * Operational error with an HTTP status code. Thrown anywhere in services;
 * caught by the central error handler which converts it to a clean JSON body
 * (never leaking stack traces or server paths to clients).
 */
class AppError extends Error {
  constructor(statusCode, message, code) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code || undefined;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(msg = 'Bad request', code) {
    return new AppError(400, msg, code);
  }
  static unauthorized(msg = 'Unauthorized', code) {
    return new AppError(401, msg, code);
  }
  static forbidden(msg = 'Forbidden', code) {
    return new AppError(403, msg, code);
  }
  static notFound(msg = 'Not found', code) {
    return new AppError(404, msg, code);
  }
  static conflict(msg = 'Conflict', code) {
    return new AppError(409, msg, code);
  }
  static payloadTooLarge(msg = 'Payload too large', code) {
    return new AppError(413, msg, code);
  }
  static internal(msg = 'Internal server error', code) {
    return new AppError(500, msg, code);
  }
}

module.exports = AppError;
