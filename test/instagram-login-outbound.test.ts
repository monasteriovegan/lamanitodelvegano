import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

test('Instagram Login OAuth uses the Instagram-specific app identity and business messaging scopes', () => {
  const oauthPath = 'src/lib/meta/instagram-login-oauth.ts';
  assert.equal(existsSync(join(root, oauthPath)), true);
  const source = read(oauthPath);
  assert.match(source, /4495025437486041/);
  assert.match(source, /META_INSTAGRAM_APP_SECRET/);
  assert.match(source, /instagram_business_basic/);
  assert.match(source, /instagram_business_manage_messages/);
  assert.match(source, /https:\/\/www\.instagram\.com\/oauth\/authorize/);
  assert.match(source, /https:\/\/api\.instagram\.com\/oauth\/access_token/);
  assert.match(source, /https:\/\/graph\.instagram\.com\/access_token/);
});

test('Instagram Login has an authenticated tenant-scoped start route and reuses the protected OAuth state', () => {
  const startPath = 'src/app/api/meta/instagram/oauth/start/route.ts';
  assert.equal(existsSync(join(root, startPath)), true);
  const source = read(startPath);
  assert.match(source, /getCurrentAdminUser/);
  assert.match(source, /business_members/);
  assert.match(source, /meta_oauth_states/);
  assert.match(source, /instagramLoginAuthorizationUrl/);
});

test('shared OAuth callback stores Instagram Login tokens encrypted and separately from the Facebook Login connection', () => {
  const source = read('src/app/api/meta/oauth/callback/route.ts');
  assert.match(source, /instagram_business_basic/);
  assert.match(source, /exchangeInstagramLoginCode/);
  assert.match(source, /discoverInstagramLoginProfile/);
  assert.match(source, /provider:\s*'meta_instagram_login'/);
  assert.match(source, /encryptMetaToken/);
  assert.match(source, /external_user_id/);
});

test('Meta repository can resolve an encrypted Instagram Login credential without moving the routing asset', () => {
  const source = read('src/lib/repositories/meta-connections-repository.ts');
  assert.match(source, /getInstagramLoginCredential/);
  assert.match(source, /meta_instagram_login/);
  assert.match(source, /external_user_id/);
  assert.match(source, /decryptMetaToken/);
});

test('Instagram sender prefers graph.instagram.com Instagram Login and keeps Facebook Login as fallback', () => {
  const source = read('src/lib/messaging/transports/instagram-meta.ts');
  assert.match(source, /getInstagramLoginCredential/);
  assert.match(source, /graph\.instagram\.com/);
  assert.match(source, /instagram_login/);
  assert.match(source, /facebook_login/);
});

test('admin integration panel exposes a dedicated Instagram Login authorization action', () => {
  const source = read('src/app/admin/integraciones/MetaConnectionPanel.tsx');
  assert.match(source, /\/api\/meta\/instagram\/oauth\/start/);
  assert.match(source, /Instagram Login/);
});
