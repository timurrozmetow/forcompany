'use strict';

/**
 * (Re)build the full-text index by extracting text from stored files.
 *   npm run reindex          # only files not yet indexed
 *   npm run reindex -- --all # re-extract everything
 */
const { query, close } = require('./pool');
const textExtract = require('../services/textExtract.service');

async function main() {
  const all = process.argv.includes('--all');
  const rows = await query(
    `SELECT id, storage_path, mime_type, extension, size_bytes
       FROM files
      WHERE is_trashed = 0 ${all ? '' : 'AND indexed_at IS NULL'}`
  );
  // eslint-disable-next-line no-console
  console.log(`Indexing ${rows.length} files...`);
  let n = 0;
  for (const f of rows) {
    // eslint-disable-next-line no-await-in-loop
    await textExtract.indexFile(f.id, f.storage_path, f.mime_type, f.extension, Number(f.size_bytes));
    n += 1;
    if (n % 50 === 0) console.log(`  ${n}/${rows.length}`); // eslint-disable-line no-console
  }
  // eslint-disable-next-line no-console
  console.log(`Done: ${n} files indexed.`);
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => close());
