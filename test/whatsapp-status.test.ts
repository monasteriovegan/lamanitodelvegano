import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

import { buildWhatsAppStatus } from '../src/lib/messaging/whatsapp-status.ts';

test('missing measurements are unknown instead of invented healthy values', () => {
  assert.deepEqual(buildWhatsAppStatus({
    transport: null,
    integration: null,
    asset: null,
    sendMode: 'disabled',
  }), {
    number: 'unknown',
    business_app: 'unknown',
    cloud_api: 'unknown',
    waba_id: 'unknown',
    phone_number_id: 'unknown',
    quality: 'unknown',
    callback: 'unknown',
    webhook: 'unknown',
    crm_sync: 'unknown',
    automatic_ai: 'unknown',
    real_sends: 'DISABLED',
    transports: [],
  });
});

test('status exposes only values actually read from configuration and observations', () => {
  const transport = {
    transport: 'cloud_api', status: 'connected', last_inbound_at: '2026-08-31T10:00:00Z',
    last_outbound_at: null, last_error: null, updated_at: '2026-08-31T10:00:01Z',
    metadata: { webhook: { outcome: 'persisted' } },
  };
  assert.deepEqual(buildWhatsAppStatus({
    transport,
    integration: { wa_phone_number_id: 'phone-real', ai_enabled: false },
    asset: { external_id: 'phone-real', metadata: { waba_id: 'waba-real', display_phone_number: '+560000', quality_rating: 'YELLOW' } },
    callbackUrl: 'https://example.test/api/meta/webhooks/whatsapp',
    sendMode: 'read_only',
  }), {
    number: '+560000',
    business_app: 'unknown',
    cloud_api: 'connected',
    waba_id: 'waba-real',
    phone_number_id: 'phone-real',
    quality: 'YELLOW',
    callback: 'https://example.test/api/meta/webhooks/whatsapp',
    webhook: 'persisted',
    crm_sync: 'configured',
    automatic_ai: 'OFF',
    real_sends: 'READ_ONLY',
    transports: [transport],
  });
});

test('admin route contains no historical phone, WABA or fabricated quality literals', () => {
  const source = readFileSync(new URL('../src/app/api/admin/whatsapp/status/route.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /1022209807648757|1129249369256097|GREEN|not_verified/);
  assert.match(source, /META_WHATSAPP_CALLBACK_URL/);
});
