'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const asyncHandler = require('../utils/asyncHandler');
const { parseId } = require('../utils/validators');
const workLog = require('../services/workLog.service');
const { convert } = require('../utils/officeConvert');

const list = asyncHandler(async (req, res) => {
  const { userId, from, to } = req.query;
  res.json(await workLog.list({ requester: req.user, userId, from, to }));
});

const create = asyncHandler(async (req, res) => {
  const { userId, content, entryDate } = req.body || {};
  const entry = await workLog.add({ requester: req.user, userId, content, entryDate });
  res.status(201).json({ entry });
});

const update = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const { content, entryDate } = req.body || {};
  const entry = await workLog.update({ requester: req.user, id, content, entryDate });
  res.json({ entry });
});

const remove = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  res.json(await workLog.remove({ requester: req.user, id }));
});

const summary = asyncHandler(async (req, res) => {
  const { userId, from, to } = req.query;
  res.json(await workLog.summary({ requester: req.user, userId, from, to }));
});

/* ------------------------------- export --------------------------------- */
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
function ruDate(d) {
  const [y, m, day] = d.split('-');
  return `${day}.${m}.${y}`;
}

function buildHtml(data) {
  const blocks = data.users
    .map((u) => {
      const days = u.days
        .map(
          (d) =>
            `<h3>${ruDate(d.date)}</h3><ol>${d.items.map((it) => `<li>${esc(it)}</li>`).join('')}</ol>`
        )
        .join('');
      return `<section><h2>${esc(u.username || '—')} <span class="cnt">— записей: ${u.total}</span></h2>${days || '<p class="muted">нет записей</p>'}</section>`;
    })
    .join('');

  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><style>
    body { font-family: "DejaVu Sans", Arial, sans-serif; color: #1d1d1f; margin: 32px; }
    h1 { font-size: 22px; margin: 0 0 4px; }
    .period { color: #555; margin: 0 0 20px; }
    section { margin-bottom: 22px; page-break-inside: avoid; }
    h2 { font-size: 16px; border-bottom: 2px solid #0071e3; padding-bottom: 4px; margin: 0 0 8px; }
    .cnt { color: #777; font-weight: normal; font-size: 13px; }
    h3 { font-size: 13px; color: #0071e3; margin: 12px 0 4px; }
    ol { margin: 0 0 6px 18px; padding: 0; }
    li { margin: 3px 0; line-height: 1.4; }
    .muted { color: #999; }
    .footer { color: #999; font-size: 11px; margin-top: 28px; border-top: 1px solid #ddd; padding-top: 8px; }
  </style></head><body>
    <h1>Журнал работ</h1>
    <p class="period">Период: ${ruDate(data.from)} — ${ruDate(data.to)}</p>
    ${blocks || '<p class="muted">За выбранный период записей нет.</p>'}
    <p class="footer">Сформировано: ${new Date().toLocaleString('ru-RU')}</p>
  </body></html>`;
}

const CONTENT_TYPES = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  html: 'text/html; charset=utf-8',
};

const exportReport = asyncHandler(async (req, res) => {
  const { userId, from, to } = req.query;
  const format = ['pdf', 'docx', 'html'].includes(req.query.format) ? req.query.format : 'pdf';
  const data = await workLog.reportData({ requester: req.user, userId, from, to });
  const html = buildHtml(data);
  const baseName = `worklog-${data.from}_${data.to}`;

  if (format === 'html') {
    res.setHeader('Content-Type', CONTENT_TYPES.html);
    res.setHeader('Content-Disposition', `attachment; filename="${baseName}.html"`);
    return res.send(html);
  }

  // pdf / docx -> LibreOffice conversion from a temp HTML file.
  const tmpDir = path.join(os.tmpdir(), 'cd_reports');
  await fs.promises.mkdir(tmpDir, { recursive: true });
  const stamp = crypto.randomUUID();
  const htmlPath = path.join(tmpDir, `${stamp}.html`);
  await fs.promises.writeFile(htmlPath, html, 'utf8');

  try {
    const outPath = await convert(htmlPath, format, tmpDir);
    const buf = await fs.promises.readFile(outPath);
    res.setHeader('Content-Type', CONTENT_TYPES[format]);
    res.setHeader('Content-Disposition', `attachment; filename="${baseName}.${format}"`);
    res.send(buf);
    fs.rm(outPath, { force: true }, () => {});
  } finally {
    fs.rm(htmlPath, { force: true }, () => {});
  }
});

module.exports = { list, create, update, remove, summary, exportReport };
