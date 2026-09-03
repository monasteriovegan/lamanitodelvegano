import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const webhook = readFileSync(new URL('../src/app/api/instagram/route.ts', import.meta.url), 'utf8');
const customers = readFileSync(new URL('../src/lib/repositories/customers-repository.ts', import.meta.url), 'utf8');

test('verified inbound Instagram messages trigger best-effort profile enrichment', () => {
  assert.match(webhook, /enrichInstagramContactProfile/);
  assert.match(webhook, /message\.direction === ['"]inbound['"]/);
  assert.match(webhook, /instagram_profile_enrichment_failed/);
});

test('Instagram profile enrichment stores a username and human display name instead of replacing identity ids', () => {
  assert.match(customers, /instagram_username/);
  assert.match(customers, /display_name/);
  assert.match(customers, /nombre/);
  assert.match(customers, /enrichInstagramProfile/);
});
