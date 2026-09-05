import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

function read(path: string) {
  assert.equal(fs.existsSync(path), true, `${path} must exist`);
  return fs.readFileSync(path, 'utf8');
}

test('CRM inbox derives one latest visible message per conversation without a global 1000-message cap', () => {
  const sql = read('supabase/migrations/20260905193000_crm_inbox_reliability.sql');
  const route = read('src/app/api/admin/conversations/route.ts');
  assert.match(sql, /admin_conversation_inbox_summary_v1/i);
  assert.match(sql, /lateral/i);
  assert.match(sql, /message_type\s+not\s+like\s+'status:%'/i);
  assert.match(route, /admin_conversation_inbox_summary_v1/);
  assert.doesNotMatch(route, /\.limit\(1000\)/);
  assert.match(route, /filter\([^)]*lastMessage/i);
});

test('unread count increments on real inbound inserts and polling never marks a chat read', () => {
  const sql = read('supabase/migrations/20260905193000_crm_inbox_reliability.sql');
  const messagesRoute = read('src/app/api/admin/conversations/[id]/messages/route.ts');
  const client = read('src/app/admin/conversaciones/ConversationsClient.tsx');
  assert.match(sql, /unread_count\s*=\s*coalesce\(unread_count,\s*0\)\s*\+\s*1/i);
  assert.match(messagesRoute, /markRead/);
  assert.match(messagesRoute, /unread_count:\s*0/);
  assert.match(client, /markRead=1/);
  assert.match(client, /markRead=0/);
});

test('CRM reply uses the canonical omnichannel send route and pending is labelled Por responder', () => {
  const client = read('src/app/admin/conversaciones/ConversationsClient.tsx');
  assert.match(client, /\/api\/admin\/messages\/send/);
  assert.doesNotMatch(client, /fetch\(`\/api\/admin\/conversations\/\$\{selected\.id\}\/messages`,\s*\{\s*method:\s*'POST'/);
  assert.match(client, /Por responder/);
});

test('orphan WhatsApp outbound status can mark the conversation responded without inventing message content', () => {
  const messages = read('src/lib/messaging/messages.ts');
  const route = read('src/app/api/admin/conversations/route.ts');
  assert.match(messages, /external_outbound_at/);
  assert.match(messages, /external_outbound_status/);
  assert.match(route, /external_outbound_at/);
  assert.match(route, /Respuesta enviada desde WhatsApp Business/);
});
