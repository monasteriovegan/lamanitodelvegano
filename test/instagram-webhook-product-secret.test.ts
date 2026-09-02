import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const route = readFileSync(
  new URL('../src/app/api/instagram/route.ts', import.meta.url),
  'utf8',
);

test('Instagram webhook verifies against the Instagram product App Secret as well as Core/Bridge', () => {
  assert.match(route, /META_INSTAGRAM_APP_SECRET/);
  assert.match(route, /const instagramSecret = process\.env\.META_INSTAGRAM_APP_SECRET/);
  assert.match(route, /verifyHmacAny\(rawBody, signature256, \[[\s\S]*primarySecret,[\s\S]*bridgeSecret,[\s\S]*instagramSecret,[\s\S]*\]\)/);
});

test('Instagram product secret is diagnostic-only metadata and is never logged', () => {
  assert.match(route, /instagramSecretPresent: Boolean\(instagramSecret\)/);
  assert.doesNotMatch(route, /instagramSecret:\s*instagramSecret/);
  assert.doesNotMatch(route, /console\.(?:log|warn|error)\([^;]*META_INSTAGRAM_APP_SECRET/);
});
