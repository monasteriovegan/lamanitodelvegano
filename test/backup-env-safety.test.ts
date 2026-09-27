import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const backupScript = readFileSync(
  new URL('../ops/self-hosted/backup/backup.sh', import.meta.url),
  'utf8',
);

test('backup reads only the required stack variables instead of executing .env', () => {
  assert.doesNotMatch(backupScript, /(?:source|\.)\s+["']?\$stack\/\.env/);
  assert.match(backupScript, /read_env_value/);
  for (const key of [
    'S3_PROTOCOL_ACCESS_KEY_ID',
    'S3_PROTOCOL_ACCESS_KEY_SECRET',
    'REGION',
    'SUPABASE_PUBLIC_URL',
  ]) {
    assert.match(backupScript, new RegExp(`${key}=\\$\\(read_env_value ${key}\\)`));
  }
});
