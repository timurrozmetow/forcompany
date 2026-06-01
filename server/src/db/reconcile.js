'use strict';

/**
 * Storage reconciliation: finds DB rows whose file is missing on disk, and
 * disk files not referenced by any DB row (orphans).
 *
 *   npm run reconcile            # report only
 *   npm run reconcile -- --delete  # also delete orphan files from disk
 */
const fs = require('fs');
const path = require('path');
const { query, close } = require('./pool');
const { resolveStoragePath, STORAGE_DIR } = require('../utils/storagePath');

async function walk(dir, known, orphans) {
  let entries;
  try {
    entries = await fs.promises.readdir(dir, { withFileTypes: true });
  } catch (_) {
    return;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === '.thumbs' || e.name === '.uploads_tmp') continue;
      // eslint-disable-next-line no-await-in-loop
      await walk(full, known, orphans);
    } else if (!known.has(e.name)) {
      orphans.push(full);
    }
  }
}

async function main() {
  const del = process.argv.includes('--delete');
  const files = await query('SELECT id, storage_path, stored_name FROM files');
  const known = new Set();
  let missing = 0;

  for (const f of files) {
    known.add(f.stored_name);
    try {
      // eslint-disable-next-line no-await-in-loop
      await fs.promises.access(resolveStoragePath(f.storage_path));
    } catch (_) {
      missing += 1;
      // eslint-disable-next-line no-console
      console.log(`MISSING ON DISK: file id=${f.id} ${f.storage_path}`);
    }
  }

  const orphans = [];
  await walk(STORAGE_DIR, known, orphans);

  // eslint-disable-next-line no-console
  console.log(`\nDB files: ${files.length} | missing on disk: ${missing} | orphans on disk: ${orphans.length}`);

  if (orphans.length && del) {
    for (const o of orphans) {
      // eslint-disable-next-line no-await-in-loop
      await fs.promises.rm(o, { force: true });
    }
    // eslint-disable-next-line no-console
    console.log(`Deleted ${orphans.length} orphan files.`);
  } else if (orphans.length) {
    // eslint-disable-next-line no-console
    console.log('Run with --delete to remove orphans. Examples:');
    orphans.slice(0, 20).forEach((o) => console.log(`  ${o}`)); // eslint-disable-line no-console
  }
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => close());
