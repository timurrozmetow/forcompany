'use strict';

/* Minimal structured-ish logger. Avoids extra deps; PM2 captures stdout/stderr. */
function ts() {
  return new Date().toISOString();
}

module.exports = {
  info: (...args) => console.log(`[${ts()}] [info]`, ...args), // eslint-disable-line no-console
  warn: (...args) => console.warn(`[${ts()}] [warn]`, ...args), // eslint-disable-line no-console
  error: (...args) => console.error(`[${ts()}] [error]`, ...args), // eslint-disable-line no-console
};
