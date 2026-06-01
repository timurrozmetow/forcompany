'use strict';

const http = require('http');
const app = require('./app');
const config = require('./config');
const db = require('./db/pool');
const logger = require('./utils/logger');
const { ensureStorageDir } = require('./utils/storagePath');
const { sweepStaleSessions } = require('./services/chunkUpload.service');

async function start() {
  // Fail fast if storage dir can't be created / DB is unreachable.
  await ensureStorageDir();
  await db.ping();
  logger.info(`Database connected (${config.db.database}@${config.db.host})`);

  // Clean up abandoned chunked-upload sessions now and once a day.
  sweepStaleSessions().catch(() => {});
  setInterval(() => sweepStaleSessions().catch(() => {}), 24 * 60 * 60 * 1000).unref();

  const server = http.createServer(app);

  // Large uploads can stall briefly between chunks; relax socket timeouts.
  server.requestTimeout = 0; // disable the hard request timeout for big uploads
  server.headersTimeout = 65 * 1000;
  server.keepAliveTimeout = 61 * 1000;

  server.listen(config.port, () => {
    logger.info(`Company Drive API listening on :${config.port} [${config.env}]`);
    logger.info(`Storage dir: ${config.storage.dir}`);
  });

  const shutdown = (signal) => async () => {
    logger.info(`${signal} received, shutting down...`);
    server.close(async () => {
      try {
        await db.close();
      } catch (_) {
        /* ignore */
      }
      logger.info('Shutdown complete.');
      process.exit(0);
    });
    // Force-exit if it hangs.
    setTimeout(() => process.exit(1), 15000).unref();
  };

  process.on('SIGTERM', shutdown('SIGTERM'));
  process.on('SIGINT', shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled promise rejection:', reason);
  });
  process.on('uncaughtException', (err) => {
    logger.error('Uncaught exception:', err);
  });
}

start().catch((err) => {
  logger.error('Failed to start server:', err.message);
  process.exit(1);
});
