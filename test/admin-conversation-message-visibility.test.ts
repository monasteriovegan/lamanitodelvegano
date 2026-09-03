import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const listRoute = readFileSync(new URL('../src/app/api/admin/conversations/route.ts', import.meta.url), 'utf8');
const messagesRoute = readFileSync(new URL('../src/app/api/admin/conversations/[id]/messages/route.ts', import.meta.url), 'utf8');

test('admin conversation previews ignore provider-only status rows', () => {
  assert.match(listRoute, /\.not\(['"]message_type['"],\s*['"]like['"],\s*['"]status:%['"]\)/);
});

test('admin chat transcript does not render provider-only status rows as messages', () => {
  assert.match(messagesRoute, /\.not\(['"]message_type['"],\s*['"]like['"],\s*['"]status:%['"]\)/);
});
