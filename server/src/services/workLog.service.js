'use strict';

const { query, queryOne, execute } = require('../db/pool');
const AppError = require('../utils/AppError');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function pad(n) {
  return String(n).padStart(2, '0');
}
function ymd(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
function today() {
  return ymd(new Date());
}
function cleanDate(raw, fallback) {
  if (!raw) return fallback;
  const s = String(raw).slice(0, 10);
  if (!DATE_RE.test(s)) throw AppError.badRequest('Invalid date (expected YYYY-MM-DD)');
  return s;
}

/** First and last day of the current month (server local). */
function currentMonthRange() {
  const now = new Date();
  const from = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { from, to: ymd(last) };
}

function publicEntry(r) {
  return {
    id: r.id,
    userId: r.user_id,
    username: r.username || null,
    authorId: r.author_id,
    authorName: r.author_name || null,
    date: typeof r.entry_date === 'string' ? r.entry_date.slice(0, 10) : ymd(new Date(r.entry_date)),
    content: r.content,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

// Non-admins may only ever touch their own log.
function resolveTargetUser(requester, userId) {
  if (requester.role === 'admin' && userId) return Number(userId);
  return requester.id;
}

async function list({ requester, userId, from, to }) {
  const f = cleanDate(from, currentMonthRange().from);
  const t = cleanDate(to, currentMonthRange().to);

  // Admin can request "all" -> entries of every user in the range.
  const wantAll = requester.role === 'admin' && (userId === 'all' || userId === '*');
  const where = ['wl.entry_date BETWEEN ? AND ?'];
  const params = [f, t];
  let targetUser = 'all';
  if (!wantAll) {
    targetUser = resolveTargetUser(requester, userId);
    where.push('wl.user_id = ?');
    params.push(targetUser);
  }

  const rows = await query(
    `SELECT wl.*, u.username, a.username AS author_name
       FROM work_logs wl
       LEFT JOIN users u ON u.id = wl.user_id
       LEFT JOIN users a ON a.id = wl.author_id
      WHERE ${where.join(' AND ')}
      ORDER BY u.username ASC, wl.entry_date DESC, wl.id ASC`,
    params
  );
  return { entries: rows.map(publicEntry), from: f, to: t, userId: targetUser };
}

async function getOrThrow(id) {
  const row = await queryOne(
    `SELECT wl.*, u.username, a.username AS author_name
       FROM work_logs wl
       LEFT JOIN users u ON u.id = wl.user_id
       LEFT JOIN users a ON a.id = wl.author_id
      WHERE wl.id = ?`,
    [id]
  );
  if (!row) throw AppError.notFound('Entry not found');
  return row;
}

function assertCanEdit(requester, row) {
  if (requester.role !== 'admin' && Number(row.user_id) !== Number(requester.id)) {
    throw AppError.forbidden('You can only edit your own entries');
  }
}

function cleanContent(raw) {
  const text = String(raw || '').trim();
  if (!text) throw AppError.badRequest('Entry cannot be empty');
  if (text.length > 2000) throw AppError.badRequest('Entry is too long (max 2000)');
  return text;
}

async function add({ requester, userId, content, entryDate }) {
  const targetUser = resolveTargetUser(requester, userId);
  if (Number(targetUser) !== Number(requester.id)) {
    // Only an admin can write into someone else's log.
    if (requester.role !== 'admin') throw AppError.forbidden('Not allowed');
    const u = await queryOne('SELECT id FROM users WHERE id = ?', [targetUser]);
    if (!u) throw AppError.notFound('User not found');
  }
  const text = cleanContent(content);
  const date = cleanDate(entryDate, today());
  const r = await execute(
    'INSERT INTO work_logs (user_id, author_id, entry_date, content) VALUES (?, ?, ?, ?)',
    [targetUser, requester.id, date, text]
  );
  return publicEntry(await getOrThrow(r.insertId));
}

async function update({ requester, id, content, entryDate }) {
  const row = await getOrThrow(id);
  assertCanEdit(requester, row);
  const updates = [];
  const params = [];
  if (content !== undefined) {
    updates.push('content = ?');
    params.push(cleanContent(content));
  }
  if (entryDate !== undefined) {
    updates.push('entry_date = ?');
    params.push(cleanDate(entryDate, today()));
  }
  if (updates.length) {
    params.push(id);
    await execute(`UPDATE work_logs SET ${updates.join(', ')} WHERE id = ?`, params);
  }
  return publicEntry(await getOrThrow(id));
}

async function remove({ requester, id }) {
  const row = await getOrThrow(id);
  assertCanEdit(requester, row);
  await execute('DELETE FROM work_logs WHERE id = ?', [id]);
  return { success: true };
}

/**
 * Monthly analysis: per-user counts + active days for the range.
 * Admin -> all users (or a specific one); regular user -> only self.
 */
async function summary({ requester, userId, from, to }) {
  const f = cleanDate(from, currentMonthRange().from);
  const t = cleanDate(to, currentMonthRange().to);

  const where = ['wl.entry_date BETWEEN ? AND ?'];
  const params = [f, t];
  if (requester.role !== 'admin') {
    where.push('wl.user_id = ?');
    params.push(requester.id);
  } else if (userId) {
    where.push('wl.user_id = ?');
    params.push(Number(userId));
  }

  const perUser = await query(
    `SELECT wl.user_id, u.username,
            COUNT(*) AS entries,
            COUNT(DISTINCT wl.entry_date) AS active_days
       FROM work_logs wl LEFT JOIN users u ON u.id = wl.user_id
      WHERE ${where.join(' AND ')}
      GROUP BY wl.user_id, u.username
      ORDER BY entries DESC`,
    params
  );

  const total = perUser.reduce((s, r) => s + Number(r.entries), 0);
  return {
    from: f,
    to: t,
    total,
    perUser: perUser.map((r) => ({
      userId: r.user_id,
      username: r.username,
      entries: Number(r.entries),
      activeDays: Number(r.active_days),
    })),
  };
}

/**
 * Structured data for exports: users -> days -> list of entries, for the range.
 */
async function reportData({ requester, userId, from, to }) {
  const f = cleanDate(from, currentMonthRange().from);
  const t = cleanDate(to, currentMonthRange().to);
  const where = ['wl.entry_date BETWEEN ? AND ?'];
  const params = [f, t];
  if (requester.role !== 'admin') {
    where.push('wl.user_id = ?');
    params.push(requester.id);
  } else if (userId) {
    where.push('wl.user_id = ?');
    params.push(Number(userId));
  }
  const rows = await query(
    `SELECT wl.*, u.username
       FROM work_logs wl LEFT JOIN users u ON u.id = wl.user_id
      WHERE ${where.join(' AND ')}
      ORDER BY u.username ASC, wl.entry_date ASC, wl.id ASC`,
    params
  );

  const byUser = new Map();
  for (const r of rows) {
    if (!byUser.has(r.user_id)) {
      byUser.set(r.user_id, { userId: r.user_id, username: r.username, total: 0, days: new Map() });
    }
    const u = byUser.get(r.user_id);
    const date = publicEntry(r).date;
    if (!u.days.has(date)) u.days.set(date, []);
    u.days.get(date).push(r.content);
    u.total += 1;
  }
  const users = [...byUser.values()].map((u) => ({
    userId: u.userId,
    username: u.username,
    total: u.total,
    days: [...u.days.entries()].map(([date, items]) => ({ date, items })),
  }));
  return { from: f, to: t, users };
}

module.exports = {
  list,
  add,
  update,
  remove,
  summary,
  reportData,
  currentMonthRange,
  publicEntry,
  cleanDate,
};
