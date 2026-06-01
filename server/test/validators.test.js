'use strict';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.STORAGE_DIR = process.env.STORAGE_DIR || require('os').tmpdir();

const test = require('node:test');
const assert = require('node:assert');
const v = require('../src/utils/validators');

test('cleanEntityName accepts normal names', () => {
  assert.strictEqual(v.cleanEntityName('Отчёт 2024.xlsx'), 'Отчёт 2024.xlsx');
  assert.strictEqual(v.cleanEntityName('  trimmed  '), 'trimmed');
});

test('cleanEntityName rejects path separators and traversal', () => {
  assert.throws(() => v.cleanEntityName('../etc/passwd'));
  assert.throws(() => v.cleanEntityName('a/b'));
  assert.throws(() => v.cleanEntityName('a\\b'));
  assert.throws(() => v.cleanEntityName('.'));
  assert.throws(() => v.cleanEntityName('..'));
  assert.throws(() => v.cleanEntityName(''));
});

test('cleanUsername enforces the charset', () => {
  assert.strictEqual(v.cleanUsername('john_doe.1'), 'john_doe.1');
  assert.throws(() => v.cleanUsername('ab')); // too short
  assert.throws(() => v.cleanUsername('has space'));
});

test('parseId / parseOptionalId', () => {
  assert.strictEqual(v.parseId('42'), 42);
  assert.throws(() => v.parseId('0'));
  assert.throws(() => v.parseId('abc'));
  assert.strictEqual(v.parseOptionalId(''), null);
  assert.strictEqual(v.parseOptionalId('root'), null);
  assert.strictEqual(v.parseOptionalId('7'), 7);
});

test('checkPasswordStrength', () => {
  assert.strictEqual(v.checkPasswordStrength('longenough'), 'longenough');
  assert.throws(() => v.checkPasswordStrength('short'));
});
