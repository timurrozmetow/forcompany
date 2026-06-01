'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');

const logger = require('../utils/logger');
const AppError = require('../utils/AppError');
const { resolveStoragePath } = require('../utils/storagePath');

const OFFICE_EXT = ['doc', 'docx', 'odt', 'rtf', 'xls', 'xlsx', 'ods', 'ppt', 'pptx', 'odp'];
const SOFFICE = process.env.SOFFICE_BIN || 'soffice'; // LibreOffice binary
const PROFILE = `file://${path.join(os.tmpdir(), 'cd_lo_profile')}`;
const OFFICE_SUBDIR = '.office';

function isOffice(file) {
  const ext = (file.extension || '').toLowerCase();
  const mime = (file.mime_type || '').toLowerCase();
  return (
    OFFICE_EXT.includes(ext) ||
    mime.includes('officedocument') ||
    mime.includes('opendocument') ||
    mime.includes('msword') ||
    mime.includes('ms-excel') ||
    mime.includes('powerpoint')
  );
}

function cachePath(storedName) {
  const base = storedName.replace(/\.[^.]+$/, '');
  return resolveStoragePath(
    path.posix.join(OFFICE_SUBDIR, storedName.slice(0, 2), storedName.slice(2, 4), `${base}.pdf`)
  );
}

// LibreOffice headless can't run two conversions with the same profile at once.
let chain = Promise.resolve();
function serialize(fn) {
  const p = chain.then(fn, fn);
  chain = p.then(
    () => {},
    () => {}
  );
  return p;
}

/**
 * Returns the absolute path to a cached PDF rendering of an office file,
 * converting on first request via LibreOffice. Returns null if the file isn't
 * an office document. Throws 501 if LibreOffice is missing / conversion fails.
 */
async function getOrCreatePdf(file) {
  if (!isOffice(file)) return null;

  const pdfAbs = cachePath(file.stored_name);
  try {
    await fs.promises.access(pdfAbs);
    return pdfAbs; // cached
  } catch (_) {
    /* convert below */
  }

  const srcAbs = resolveStoragePath(file.storage_path);
  const outDir = path.dirname(pdfAbs);
  await fs.promises.mkdir(outDir, { recursive: true });

  try {
    await serialize(
      () =>
        new Promise((resolve, reject) => {
          execFile(
            SOFFICE,
            [
              '--headless',
              `-env:UserInstallation=${PROFILE}`,
              '--convert-to',
              'pdf',
              '--outdir',
              outDir,
              srcAbs,
            ],
            { timeout: 120000 },
            (err) => (err ? reject(err) : resolve())
          );
        })
    );
    await fs.promises.access(pdfAbs);
    return pdfAbs;
  } catch (err) {
    logger.warn(`Office preview failed for file ${file.id}: ${err.message}`);
    throw new AppError(
      501,
      'Office preview is not available on this server',
      'NO_OFFICE_PREVIEW'
    );
  }
}

async function removePdf(storedName) {
  try {
    await fs.promises.rm(cachePath(storedName), { force: true });
  } catch (_) {
    /* ignore */
  }
}

module.exports = { isOffice, getOrCreatePdf, removePdf };
