import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const client = readFileSync(new URL('../src/app/admin/conversaciones/ConversationsClient.tsx', import.meta.url), 'utf8');

test('admin makes clear that the master switch is only for WhatsApp', () => {
  assert.match(client, /Remy WhatsApp global ON/);
  assert.match(client, /Remy WhatsApp global OFF/);
  assert.match(client, /Instagram[^\n]{0,200}interruptor individual|Instagram[^\n]{0,200}Agentes/i);
});
