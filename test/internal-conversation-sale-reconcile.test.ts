import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../src/app/api/internal/reconcile-conversation-sale/route.ts', import.meta.url), 'utf8');

test('reconciliador interno exige llave derivada y valida conversation_id UUID', () => {
  assert.match(source, /timingSafeEqual/);
  assert.match(source, /createHash\(['"]sha256['"]\)/);
  assert.match(source, /x-conversation-reconcile-key/);
  assert.match(source, /invalid_conversation_id/);
  assert.match(source, /unauthorized/);
});

test('reconciliador despacha por canal sin enviar mensajes al cliente', () => {
  assert.match(source, /autoRegisterInstagramConversationSale/);
  assert.match(source, /autoRegisterWhatsappConversationSale/);
  assert.match(source, /channel\s*===\s*['"]instagram['"]/);
  assert.match(source, /channel\s*===\s*['"]whatsapp['"]/);
  assert.doesNotMatch(source, /sendMessage|sendInstagram|sendWhatsapp|sendWhatsApp/);
});
