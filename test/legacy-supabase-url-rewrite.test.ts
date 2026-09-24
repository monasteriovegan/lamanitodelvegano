import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const migration = readFileSync(
  new URL('../supabase/migrations/20260924145426_prepare_legacy_supabase_url_rewrite.sql', import.meta.url),
  'utf8',
);

const [applySection] = migration.split(
  'create or replace function migration_support.rollback_legacy_supabase_url_rewrite()',
);

test('legacy URL rewrite changes only recovered public-media relations', () => {
  assert.match(applySection, /update public\.ajustes/);
  assert.match(applySection, /update public\.productos/);
  assert.match(applySection, /update public\.seasons/);
  assert.doesNotMatch(applySection, /update public\.omnichannel_messages/);
  assert.doesNotMatch(applySection, /update public\.wonka_jobs/);
  assert.doesNotMatch(applySection, /update public\.wonka_messages/);
});

test('legacy URL rewrite backs up all old references and leaves signed URLs pending', () => {
  for (const relation of [
    'public.ajustes',
    'public.omnichannel_messages',
    'public.productos',
    'public.seasons',
    'public.wonka_jobs',
    'public.wonka_messages',
  ]) {
    assert.match(applySection, new RegExp(`select '${relation.replace('.', '\\.')}'`));
  }
  assert.match(applySection, /signed_rows_pending/);
  assert.match(applySection, /\/storage\/v1\/object\/sign\//);
});
