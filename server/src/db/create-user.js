'use strict';

/**
 * Create a user from the command line (admin utility — bypasses the in-app
 * 8-char password policy, so use responsibly).
 *
 *   node src/db/create-user.js <username> <password> [role]
 *   npm run create-user -- <username> <password> [role]
 *
 * role: "user" (default) or "admin".
 */
const bcrypt = require('bcryptjs');
const config = require('../config');
const { queryOne, execute, close } = require('./pool');
const { cleanUsername, parseRole } = require('../utils/validators');

async function main() {
  const [username, password, roleArg] = process.argv.slice(2);
  if (!username || !password) {
    // eslint-disable-next-line no-console
    console.error('Usage: node src/db/create-user.js <username> <password> [role]');
    process.exitCode = 1;
    return;
  }

  const cleanName = cleanUsername(username);
  const role = parseRole(roleArg);
  if (password.length < 8) {
    // eslint-disable-next-line no-console
    console.warn(`[create-user] WARNING: password is short (${password.length} chars). The in-app policy requires 8+.`);
  }

  const existing = await queryOne('SELECT id FROM users WHERE username = ? LIMIT 1', [cleanName]);
  if (existing) {
    // eslint-disable-next-line no-console
    console.error(`[create-user] User "${cleanName}" already exists (id=${existing.id}).`);
    process.exitCode = 1;
    return;
  }

  const hash = await bcrypt.hash(password, config.bcryptRounds);
  const result = await execute(
    'INSERT INTO users (username, password_hash, role, is_active) VALUES (?, ?, ?, 1)',
    [cleanName, hash, role]
  );
  // eslint-disable-next-line no-console
  console.log(`[create-user] Created "${cleanName}" (role=${role}, id=${result.insertId}).`);
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error('[create-user] Failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => close());
