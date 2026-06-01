'use strict';

const fs = require('fs');
const AppError = require('./AppError');

/**
 * RFC 7233 single-range parser. Returns { start, end } or null if unsatisfiable
 * / absent. Only supports a single range (good enough for media seeking).
 */
function parseRange(rangeHeader, size) {
  if (!rangeHeader || !/^bytes=/.test(rangeHeader)) return null;
  const spec = rangeHeader.replace(/^bytes=/, '').split(',')[0].trim();
  const [startStr, endStr] = spec.split('-');

  let start;
  let end;
  if (startStr === '') {
    // suffix range: last N bytes
    const suffix = parseInt(endStr, 10);
    if (Number.isNaN(suffix)) return null;
    start = Math.max(size - suffix, 0);
    end = size - 1;
  } else {
    start = parseInt(startStr, 10);
    end = endStr === '' || endStr === undefined ? size - 1 : parseInt(endStr, 10);
    if (Number.isNaN(start)) return null;
    if (Number.isNaN(end)) end = size - 1;
  }

  if (start > end || start < 0 || start >= size) {
    return { unsatisfiable: true };
  }
  end = Math.min(end, size - 1);
  return { start, end };
}

/**
 * Streams a file to the response. `mode`:
 *   - 'download'  -> Content-Disposition: attachment
 *   - 'inline'    -> Content-Disposition: inline (preview), supports Range
 *
 * Uses fs read streams (never loads the whole file into memory) and supports
 * HTTP range requests so browsers can seek video/audio.
 */
async function sendFile(req, res, { absolutePath, mimeType, fileName, sizeBytes, mode }) {
  let stat;
  try {
    stat = await fs.promises.stat(absolutePath);
  } catch (err) {
    throw AppError.notFound('File is missing on disk', 'FILE_MISSING');
  }
  const size = stat.size;

  const safeName = encodeURIComponent(fileName || 'file').replace(/['()]/g, escape);
  const disposition = mode === 'download' ? 'attachment' : 'inline';

  res.setHeader('Content-Type', mimeType || 'application/octet-stream');
  res.setHeader(
    'Content-Disposition',
    `${disposition}; filename="${asciiFallback(fileName)}"; filename*=UTF-8''${safeName}`
  );
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', 'private, no-store');
  // Don't let the browser sniff a different content type.
  res.setHeader('X-Content-Type-Options', 'nosniff');

  const range = parseRange(req.headers.range, size);

  if (range && range.unsatisfiable) {
    res.status(416).setHeader('Content-Range', `bytes */${size}`);
    return res.end();
  }

  if (range) {
    const { start, end } = range;
    const chunkSize = end - start + 1;
    res.status(206);
    res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
    res.setHeader('Content-Length', chunkSize);
    const stream = fs.createReadStream(absolutePath, { start, end });
    pipeWithCleanup(stream, res);
    return undefined;
  }

  res.status(200);
  res.setHeader('Content-Length', size);
  if (req.method === 'HEAD') {
    return res.end();
  }
  const stream = fs.createReadStream(absolutePath);
  pipeWithCleanup(stream, res);
  return undefined;
}

function pipeWithCleanup(stream, res) {
  stream.on('error', () => {
    if (!res.headersSent) res.status(500);
    res.end();
  });
  // If the client disconnects, stop reading from disk.
  res.on('close', () => stream.destroy());
  stream.pipe(res);
}

function asciiFallback(name) {
  return String(name || 'file')
    .replace(/[^\x20-\x7e]/g, '_')
    .replace(/["\\]/g, '_');
}

module.exports = { sendFile, parseRange };
