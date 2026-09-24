import assert from 'node:assert/strict';
import test from 'node:test';
import { requireSupabaseServiceConfig } from '../src/lib/supabase/required-env.ts';

test('Supabase server configuration fails closed when required values are absent', () => {
  assert.throws(
    () => requireSupabaseServiceConfig({}),
    /Supabase server configuration is incomplete/,
  );
  assert.throws(
    () => requireSupabaseServiceConfig({ NEXT_PUBLIC_SUPABASE_URL: 'https://preview.example.test' }),
    /Supabase server configuration is incomplete/,
  );
});

test('Supabase server configuration rejects malformed URLs without exposing the key', () => {
  const secret = 'server-secret-that-must-not-appear';
  assert.throws(
    () => requireSupabaseServiceConfig({
      NEXT_PUBLIC_SUPABASE_URL: 'not-a-url',
      SUPABASE_SERVICE_ROLE_KEY: secret,
    }),
    (error: unknown) => error instanceof Error && /URL is invalid/.test(error.message) && !error.message.includes(secret),
  );
});

test('Supabase server configuration returns the exact configured endpoint and key', () => {
  assert.deepEqual(
    requireSupabaseServiceConfig({
      NEXT_PUBLIC_SUPABASE_URL: 'https://preview.example.test',
      SUPABASE_SERVICE_ROLE_KEY: 'preview-server-key',
    }),
    { url: 'https://preview.example.test', serviceKey: 'preview-server-key' },
  );
});
