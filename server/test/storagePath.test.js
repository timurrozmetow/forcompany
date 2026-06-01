'use strict';

const os = require('os');
const path = require('path');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.STORAGE_DIR = process.env.STORAGE_DIR || path.join(os.tmpdir(), 'cd_test_store');

const test = require('node:test');
const assert = require('node:assert');
const sp = require('../src/utils/storagePath');

test('resolveStoragePath keeps paths inside STORAGE_DIR', () => {
  const abs = sp.resolveStoragePath('ab/cd/some-uuid.bin');
  assert.ok(abs.startsWith(sp.STORAGE_DIR), 'resolved path must be under STORAGE_DIR');
});

test('resolveStoragePath blocks path traversal', () => {
  assert.throws(() => sp.resolveStoragePath('../../etc/passwd'));
  assert.throws(() => sp.resolveStoragePath('..\\..\\windows\\system32'));
});

test('sanitizeExtension strips unsafe characters', () => {
  assert.strictEqual(sp.sanitizeExtension('.PDF'), '.pdf');
  assert.strictEqual(sp.sanitizeExtension('tar.gz'), '.targz');
  assert.strictEqual(sp.sanitizeExtension('../sh'), '.sh');
  assert.strictEqual(sp.sanitizeExtension(''), '');
});

test('buildRelativePath shards by first 4 chars', () => {
  const rel = sp.buildRelativePath('abcd1234-rest.bin');
  assert.strictEqual(rel, path.posix.join('ab', 'cd', 'abcd1234-rest.bin'));
});
