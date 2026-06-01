'use strict';

const mysql = require('mysql2/promise');
const config = require('../config');

const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  waitForConnections: true,
  connectionLimit: config.db.connectionLimit,
  queueLimit: 0,
  charset: 'utf8mb4',
  timezone: 'Z',
  // Return BIGINT columns as JS numbers when safe, otherwise as string.
  // IDs here stay well within Number.MAX_SAFE_INTEGER for this use case.
  supportBigNumbers: true,
  bigNumberStrings: false,
  dateStrings: false,
  namedPlaceholders: false,
});

/**
 * Run a query and return rows.
 */
async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

/**
 * Run a query and return the first row (or null).
 */
async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows.length ? rows[0] : null;
}

/**
 * Execute a write and return the raw result (insertId, affectedRows...).
 */
async function execute(sql, params = []) {
  const [result] = await pool.execute(sql, params);
  return result;
}

/**
 * Run a function inside a transaction. The callback receives a connection
 * with the same helper signatures (query/queryOne/execute).
 */
async function transaction(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const tx = {
      query: async (sql, params = []) => {
        const [rows] = await conn.execute(sql, params);
        return rows;
      },
      queryOne: async (sql, params = []) => {
        const [rows] = await conn.execute(sql, params);
        return rows.length ? rows[0] : null;
      },
      execute: async (sql, params = []) => {
        const [result] = await conn.execute(sql, params);
        return result;
      },
    };
    const out = await fn(tx);
    await conn.commit();
    return out;
  } catch (err) {
    try {
      await conn.rollback();
    } catch (_) {
      /* ignore rollback error */
    }
    throw err;
  } finally {
    conn.release();
  }
}

async function ping() {
  const conn = await pool.getConnection();
  try {
    await conn.ping();
  } finally {
    conn.release();
  }
}

async function close() {
  await pool.end();
}

module.exports = { pool, query, queryOne, execute, transaction, ping, close };
