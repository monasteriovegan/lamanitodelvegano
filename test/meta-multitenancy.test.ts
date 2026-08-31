import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { metaAssetReference } from '../src/lib/meta/asset-routing.ts';
import { decryptMetaToken, encryptMetaToken, hashOAuthState, newOAuthState } from '../src/lib/meta/token-crypto.ts';

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

test('extrae el Instagram professional account receptor del webhook', () => {
  assert.deepEqual(metaAssetReference({
    channel: 'instagram',
    raw_payload: { business_instagram_id: 'ig-tenant-2' },
  }), { assetType: 'instagram_account', externalId: 'ig-tenant-2' });
});

test('extrae el phone_number_id receptor del webhook WhatsApp', () => {
  assert.deepEqual(metaAssetReference({
    channel: 'whatsapp',
    raw_payload: { metadata: { phone_number_id: 'phone-tenant-2' } },
  }), { assetType: 'whatsapp_phone_number', externalId: 'phone-tenant-2' });
});

test('un webhook Meta sin asset receptor no puede caer al tenant predeterminado', () => {
  assert.equal(metaAssetReference({ channel: 'instagram', raw_payload: {} }), null);
  const source = read('src/lib/messaging/messages.ts');
  assert.doesNotMatch(source, /new BusinessRepository\(db\)\.requireDefault\(\)/);
  assert.match(source, /resolveBusinessUnitForMessage/);
});

test('la migración central usa business_units, RLS y estado OAuth de un solo uso', () => {
  const source = read('supabase/migracion-synthetiq-meta-multitenant.sql');
  for (const table of ['business_members', 'meta_connections', 'meta_connection_assets', 'meta_oauth_states']) {
    assert.match(source, new RegExp(`create table(?: if not exists)? public\\.${table}`));
    assert.match(source, new RegExp(`alter table public\\.${table} enable row level security`));
  }
  assert.match(source, /business_unit_id uuid not null references public\.business_units/);
  assert.match(source, /state_hash text not null unique/);
  assert.match(source, /expires_at timestamptz not null/);
  assert.match(source, /consumed_at timestamptz/);
  assert.match(source, /unique \(asset_type, external_id\)/);
  assert.doesNotMatch(source, /create table(?: if not exists)? public\.businesses/);
  assert.match(source, /revoke all on table public\.meta_oauth_states from anon, authenticated/);
});

test('los tokens Meta no usan columnas de texto plano', () => {
  const source = read('supabase/migracion-synthetiq-meta-multitenant.sql');
  assert.match(source, /access_token_ciphertext text not null/);
  assert.match(source, /access_token_iv text not null/);
  assert.match(source, /access_token_tag text not null/);
  assert.doesNotMatch(source, /\baccess_token text\b/);
});

test('state OAuth es aleatorio y sólo su hash estable se persiste', () => {
  const first = newOAuthState();
  const second = newOAuthState();
  assert.notEqual(first, second);
  assert.ok(first.length >= 43);
  assert.equal(hashOAuthState(first), hashOAuthState(first));
  assert.notEqual(hashOAuthState(first), first);
});

test('token Meta usa AES-GCM autenticado y no queda en texto plano', () => {
  const key = Buffer.alloc(32, 7).toString('base64');
  const encrypted = encryptMetaToken('EA-secret-token', key);
  assert.equal(decryptMetaToken(encrypted, key), 'EA-secret-token');
  assert.doesNotMatch(encrypted.ciphertext, /EA-secret-token/);
  assert.throws(() => decryptMetaToken({ ...encrypted, tag: Buffer.alloc(16).toString('base64') }, key));
});

test('OAuth propio valida membresía, consume state y descubre assets server-side', () => {
  const start = read('src/app/api/meta/oauth/start/route.ts');
  const callback = read('src/app/api/meta/oauth/callback/route.ts');
  assert.match(start, /meta_oauth_states/);
  assert.match(start, /business_members/);
  assert.match(start, /newOAuthState/);
  assert.match(callback, /consume_meta_oauth_state/);
  assert.match(callback, /exchangeMetaCode/);
  assert.match(callback, /discoverMetaAssets/);
  assert.doesNotMatch(callback, /localStorage/);
});

test('selección sólo activa candidatos descubiertos para la conexión y tenant del usuario', () => {
  const source = read('src/app/api/meta/assets/select/route.ts');
  assert.match(source, /business_members/);
  assert.match(source, /meta_connection_assets/);
  assert.match(source, /\.in\('id', assetIds\)/);
  assert.match(source, /candidateIds/);
  assert.match(source, /status: 'active'/);
  assert.match(source, /subscribeMetaPages/);
  assert.match(source, /subscribed:\s*true/);
});

test('la suscripción webhook usa tokens de Page efímeros y no persiste esos secretos', () => {
  const source = read('src/lib/meta/oauth.ts');
  assert.match(source, /export async function subscribeMetaPages/);
  assert.match(source, /\/subscribed_apps/);
  assert.match(source, /subscribed_fields/);
  assert.match(source, /messages,messaging_postbacks/);
  assert.doesNotMatch(source, /page_access_token_ciphertext|page_access_token:/);
});

test('outbound resuelve conversación, tenant, conexión y asset sin defaults globales', () => {
  const send = read('src/lib/messaging/send.ts');
  const instagram = read('src/lib/messaging/transports/instagram-meta.ts');
  const whatsapp = read('src/lib/messaging/transports/whatsapp-cloud.ts');
  assert.match(send, /select\('business_unit_id,channel'\)/);
  assert.match(send, /businessUnitId: String\(conversation\.business_unit_id\)/);
  for (const source of [instagram, whatsapp]) {
    assert.match(source, /getActiveCredential/);
    assert.doesNotMatch(source, /integraciones_secretas/);
    assert.doesNotMatch(source, /requireDefault|DEFAULT_IG_BUSINESS_ID|META_INSTAGRAM_BUSINESS_ID/);
  }
  assert.match(instagram, /getActiveCredential\([\s\S]*'instagram_account'/);
  assert.match(whatsapp, /getActiveCredential\([\s\S]*'whatsapp_phone_number'/);
});

test('Centro de Conexiones opera por membresía y conserva historial al desconectar', () => {
  const page = read('src/app/admin/integraciones/page.tsx');
  const actions = read('src/app/api/meta/connections/disconnect/route.ts');
  assert.match(page, /business_members/);
  assert.match(page, /meta_connections/);
  assert.match(page, /MetaConnectionPanel/);
  assert.match(actions, /export async function POST/);
  assert.match(actions, /status: 'disconnected'/);
  assert.doesNotMatch(actions, /delete\(\)[\s\S]*meta_connections/);
});

test('webhook Instagram de un asset no conectado responde 200 sin contaminar otro tenant', () => {
  const source = read('src/app/api/instagram/route.ts');
  assert.match(source, /meta_asset_not_connected/);
  assert.match(source, /ignored:\s*true/);
  assert.match(source, /status:\s*200/);
});
