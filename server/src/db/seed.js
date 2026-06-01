'use strict';

/**
 * Creates the first admin account (idempotent).
 * Usage: npm run seed
 *
 *   username: admin
 *   password: admin12345   (change it after first login!)
 */
const bcrypt = require('bcryptjs');
const config = require('../config');
const { query, execute, close } = require('./pool');

const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'admin12345';

async function main() {
  const existing = await query('SELECT id FROM users WHERE username = ? LIMIT 1', [ADMIN_USERNAME]);
  if (existing.length) {
    // eslint-disable-next-line no-console
    console.log(`[seed] User "${ADMIN_USERNAME}" already exists (id=${existing[0].id}). Nothing to do.`);
    return;
  }

  const hash = await bcrypt.hash(ADMIN_PASSWORD, config.bcryptRounds);
  const result = await execute(
    'INSERT INTO users (username, password_hash, role, is_active) VALUES (?, ?, ?, 1)',
    [ADMIN_USERNAME, hash, 'admin']
  );

  // eslint-disable-next-line no-console
  console.log(`[seed] Created admin (id=${result.insertId}).`);
  // eslint-disable-next-line no-console
  console.log(`[seed] login: ${ADMIN_USERNAME} / ${ADMIN_PASSWORD}  — CHANGE THIS PASSWORD after first login.`);
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error('[seed] Failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => close());
