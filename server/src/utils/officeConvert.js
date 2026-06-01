'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const AppError = require('./AppError');
const logger = require('./logger');

const SOFFICE = process.env.SOFFICE_BIN || 'soffice';
const PROFILE = `file://${path.join(os.tmpdir(), 'cd_lo_profile')}`;

// LibreOffice headless can't run concurrent conversions with one profile.
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
 * Convert a source file to `format` (e.g. 'pdf', 'docx') via LibreOffice.
 * Returns the absolute path of the produced file. Throws 501 if soffice fails.
 */
async function convert(srcAbs, format, outDir) {
  try {
    await serialize(
      () =>
        new Promise((resolve, reject) => {
          execFile(
            SOFFICE,
            ['--headless', `-env:UserInstallation=${PROFILE}`, '--convert-to', format, '--outdir', outDir, srcAbs],
            { timeout: 120000 },
            (err) => (err ? reject(err) : resolve())
          );
        })
    );
    const ext = String(format).split(':')[0];
    const out = path.join(outDir, `${path.basename(srcAbs).replace(/\.[^.]+$/, '')}.${ext}`);
    await fs.promises.access(out);
    return out;
  } catch (err) {
    logger.warn(`officeConvert failed: ${err.message}`);
    throw new AppError(501, 'Export to PDF/Word requires LibreOffice on the server', 'NO_LIBREOFFICE');
  }
}

module.exports = { convert };
