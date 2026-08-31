import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

test('business diagnostic page is strictly read-only', () => {
  const source = readFileSync(new URL('../src/app/internal-meta-business-diagnostic-4e8a/page.tsx', import.meta.url), 'utf8');
  assert.match(source, /diagnoseMetaBusinessAssignments/);
  assert.match(source, /diagnoseMetaToken/);
  assert.match(source, /listWabaSubscriptions/);
  assert.doesNotMatch(source, /ensureWabaMessagesSubscription|method:\s*['"]POST|assigned_users.*POST/);
  assert.doesNotMatch(source, /console\./);
});
