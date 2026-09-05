import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

function read(path: string) {
  return fs.readFileSync(path, 'utf8');
}

test('Panel Maestro install metadata is not exposed from the public root', () => {
  assert.equal(fs.existsSync('src/app/manifest.ts'), false, 'public root must not expose the admin PWA manifest');
  const adminLayout = read('src/app/admin/layout.tsx');
  assert.match(adminLayout, /manifest\s*:\s*['"]\/admin\/manifest\.webmanifest['"]/);
  const adminManifest = read('src/app/admin/manifest.webmanifest/route.ts');
  assert.match(adminManifest, /start_url['"]?\s*:\s*['"]\/admin['"]/);
  assert.match(adminManifest, /scope['"]?\s*:\s*['"]\/admin['"]/);
});

test('WhatsApp production send mode comes from database channel settings, not Vercel legacy env', () => {
  const policy = read('src/lib/messaging/capability-policy.ts');
  const route = read('src/app/api/whatsapp/route.ts');
  const transport = read('src/lib/messaging/transports/whatsapp-cloud.ts');
  const remy = read('src/lib/ai/remy.ts');

  assert.doesNotMatch(policy, /META_WHATSAPP_SEND_MODE|META_SEND_MODE/);
  assert.doesNotMatch(route, /resolveWhatsAppSendMode/);
  assert.doesNotMatch(transport, /resolveWhatsAppSendMode/);
  assert.doesNotMatch(remy, /resolveWhatsAppSendMode/);
  assert.match(transport, /channel_settings/);
  assert.match(remy, /channel_settings/);
});

test('automatic opportunity recovery is controlled by Remy database runtime metadata', () => {
  const runner = read('src/lib/opportunities/runner.ts');
  assert.doesNotMatch(runner, /SALES_OPPORTUNITY_AUTO_SEND/);
  assert.doesNotMatch(runner, /SALES_OPPORTUNITY_CART_CUTOVER/);
  assert.match(runner, /opportunity_auto_send/);
  assert.match(runner, /opportunity_cart_cutover/);
  assert.match(runner, /agent_runtime_configs|getAgentRuntimeConfig/);
});

test('bulk Remy enable never touches conversations in human takeover', () => {
  const route = read('src/app/api/admin/conversations/bulk-enable-ai/route.ts');
  assert.match(route, /human_takeover/);
  assert.match(route, /!row\.human_takeover|row\.human_takeover\s*!==\s*true/);
});
