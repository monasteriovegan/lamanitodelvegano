import assert from 'node:assert/strict';
import test from 'node:test';
import { validateAdminMediaUpload } from '../src/lib/storage/admin-upload-policy.ts';

test('admin media signing accepts an allowed file at the 12 MiB boundary', () => {
  assert.deepEqual(
    validateAdminMediaUpload({ fileName: 'producto.webp', contentType: 'image/webp', size: 12 * 1024 * 1024 }),
    { ok: true, fileName: 'producto.webp', contentType: 'image/webp', size: 12 * 1024 * 1024 },
  );
});

test('admin media signing rejects a file one byte above 12 MiB', () => {
  assert.deepEqual(
    validateAdminMediaUpload({ fileName: 'producto.webp', contentType: 'image/webp', size: 12 * 1024 * 1024 + 1 }),
    { ok: false, reason: 'size' },
  );
});

test('admin media signing rejects executable or empty uploads', () => {
  assert.deepEqual(
    validateAdminMediaUpload({ fileName: 'payload.exe', contentType: 'application/octet-stream', size: 100 }),
    { ok: false, reason: 'content_type' },
  );
  assert.deepEqual(
    validateAdminMediaUpload({ fileName: 'empty.png', contentType: 'image/png', size: 0 }),
    { ok: false, reason: 'size' },
  );
});
