'use strict';

/**
 * Applies database/migration_v3.sql (in-app notifications).
 * Usage: npm run migrate:v3  (safe to re-run)
 */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const config = require('../config');

async function main() {
  const sqlPath = path.join(__dirname, '..', '..', 'database', 'migration_v3.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  const conn = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database,
    multipleStatements: true,
    charset: 'utf8mb4',
  });
  // eslint-disable-next-line no-console
  console.log(`[migrate:v3] applying to "${config.db.database}"...`);
  await conn.query(sql);
  await conn.end();
  // eslint-disable-next-line no-console
  console.log('[migrate:v3] done.');
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[migrate:v3] failed:', err.message);
  process.exit(1);
});
