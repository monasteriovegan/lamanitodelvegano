import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const runner = readFileSync('src/lib/opportunities/runner.ts', 'utf8');
const policy = readFileSync('src/lib/opportunities/policy.ts', 'utf8');
const page = readFileSync('src/app/admin/pedidos/[id]/page.tsx', 'utf8');
const editForm = readFileSync('src/app/admin/pedidos/[id]/OrderEditForm.tsx', 'utf8');
const actions = readFileSync('src/app/admin/pedidos/actions.ts', 'utf8');

test('automatic recovery is independent from the Remy conversation global kill switch', () => {
  assert.match(runner, /opportunity_auto_send/);
  assert.doesNotMatch(runner, /automaticExecutionEnabled\s*=\s*remyRuntime\.enabled/);
  assert.doesNotMatch(runner, /select\(['"]ai_enabled['"]\)/);
  assert.doesNotMatch(policy, /input\.aiEnabled/);
});

test('automatic recovery requires explicit Remy authorization for the target channel', () => {
  assert.match(runner, /metadata\?\.channels/);
  assert.match(runner, /opportunity\.channel/);
  assert.match(runner, /channelRecoveryEnabled/);
});

test('recovery keeps the existing customer-safety gates', () => {
  assert.match(runner, /humanTakeover/);
  assert.match(runner, /personal/);
  assert.match(runner, /paidOrder/);
  assert.match(runner, /followup_count/);
  assert.match(runner, /metaWindowOpen/);
  assert.match(runner, /conversationEnabled/);
});

test('order detail exposes a single full edit entry point', () => {
  assert.match(page, /<OrderEditForm/);
  assert.doesNotMatch(page, /hide-legacy-order-editor/);
  assert.match(page, /single-order-editor/);
});

test('full order editor preserves explicit CRM sync opt-in', () => {
  assert.match(editForm, /updateCrm/);
  assert.match(editForm, /Actualizar también la ficha maestra del contacto en CRM/);
  assert.match(editForm, /updateCrm,/);
  assert.match(actions, /updateCrm\?:\s*boolean/);
  assert.match(actions, /update_crm:\s*true/);
});
