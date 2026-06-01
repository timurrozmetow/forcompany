'use strict';

/**
 * Applies database/schema.sql to the configured database.
 * Usage: npm run migrate
 *
 * Note: requires the database to already exist (CREATE DATABASE company_drive).
 */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const config = require('../config');

async function main() {
  const schemaPath = path.join(__dirname, '..', '..', 'database', 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');

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
  console.log(`[migrate] Applying schema to "${config.db.database}"...`);
  await conn.query(sql);
  await conn.end();
  // eslint-disable-next-line no-console
  console.log('[migrate] Done.');
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[migrate] Failed:', err.message);
  process.exit(1);
});
