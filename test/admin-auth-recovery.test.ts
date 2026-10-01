import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  adminRecoveryRedirectUrl,
  safeAdminCallbackPath,
} from '../src/lib/auth/admin-auth-redirects.ts';

function read(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('password recovery always targets the canonical production callback', () => {
  assert.equal(
    adminRecoveryRedirectUrl(),
    'https://lamanitodelvegano.cl/admin/callback?next=/admin/update-password',
  );
});

test('callback accepts the internal password-update route', () => {
  assert.equal(safeAdminCallbackPath('/admin/update-password'), '/admin/update-password');
});

test('callback falls back safely when next is missing or malformed', () => {
  for (const value of [null, '', 'admin/productos', '/tienda', '/admin/../checkout']) {
    assert.equal(safeAdminCallbackPath(value), '/admin/productos');
  }
});

test('callback blocks absolute, protocol-relative and backslash redirects', () => {
  for (const value of [
    'https://evil.example/steal',
    '//evil.example/steal',
    '/\\evil.example/steal',
    '\\evil.example/steal',
  ]) {
    assert.equal(safeAdminCallbackPath(value), '/admin/productos');
  }
});

test('login, recovery, callback, password update and admin role contracts remain wired', () => {
  const login = read('src/app/(auth)/admin/login/page.tsx');
  const callback = read('src/app/(auth)/admin/callback/route.ts');
  const updatePassword = read('src/app/(auth)/admin/update-password/page.tsx');
  const serverAuth = read('src/lib/supabase/server-auth.ts');

  assert.match(login, /signInWithPassword\(\{ email, password \}\)/);
  assert.match(login, /resetPasswordForEmail\(email/);
  assert.match(login, /adminRecoveryRedirectUrl\(\)/);
  assert.doesNotMatch(login, /window\.location\.origin.*admin\/callback/);
  assert.match(callback, /exchangeCodeForSession\(code\)/);
  assert.match(callback, /safeAdminCallbackPath/);
  assert.match(callback, /OFFICIAL_SITE_URL/);
  assert.match(updatePassword, /updateUser\(\{ password \}\)/);
  assert.match(updatePassword, /router\.push\('\/admin\/login'\)/);
  assert.match(serverAuth, /\.from\('admin_roles'\)/);
  assert.match(serverAuth, /\.eq\('user_id', user\.id\)/);
});

test('admin auth runtime contains no managed Supabase or Vercel recovery fallback', () => {
  const sources = [
    read('src/app/(auth)/admin/login/page.tsx'),
    read('src/app/(auth)/admin/callback/route.ts'),
    read('src/lib/auth/admin-auth-redirects.ts'),
  ].join('\n');

  assert.doesNotMatch(sources, /\.supabase\.co/i);
  assert.doesNotMatch(sources, /\.vercel\.app/i);
  assert.doesNotMatch(sources, /localhost/i);
});
