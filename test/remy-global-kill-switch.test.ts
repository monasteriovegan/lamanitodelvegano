import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const remy = readFileSync('src/lib/ai/remy.ts', 'utf8');
const globalState = readFileSync('src/lib/ai/remy-global-state.ts', 'utf8');
const globalRoute = readFileSync('src/app/api/admin/conversations/remy-global/route.ts', 'utf8');
const agentsAction = readFileSync('src/app/admin/agentes/actions.ts', 'utf8');
const conversationsPage = readFileSync('src/app/admin/conversaciones/page.tsx', 'utf8');
const instagramToggle = readFileSync('src/app/admin/conversaciones/RemyInstagramToggle.tsx', 'utf8');
const migration = readFileSync('supabase/migrations/20260906011500_remy_global_kill_switch.sql', 'utf8');

test('Remy non-web generation keeps the persisted hard global gate', () => {
  assert.match(remy, /integraciones_secretas/);
  assert.match(remy, /input\.channel\s*!==\s*['"]web['"][\s\S]+!config\?\.ai_enabled[\s\S]+remy_global_off/);
});

test('the admin global switch reads and writes the same hard gate used by Remy', () => {
  assert.match(globalState, /integraciones_secretas/);
  assert.match(globalState, /set_remy_global_enabled/);
  assert.match(globalRoute, /getRemyGlobalEnabled/);
  assert.match(globalRoute, /setRemyGlobalEnabled/);
  assert.match(conversationsPage, /RemyGlobalToggle/);
});

test('saving Remy as disabled in Agents also flips the canonical global kill switch', () => {
  assert.match(agentsAction, /setRemyGlobalEnabled\(db,\s*enabled\)/);
});

test('the database changes Remy global and runtime enabled atomically and fails closed to clients', () => {
  assert.match(migration, /create or replace function public\.set_remy_global_enabled/i);
  assert.match(migration, /update public\.integraciones_secretas[\s\S]+ai_enabled\s*=\s*p_enabled/i);
  assert.match(migration, /update public\.agent_runtime_configs[\s\S]+enabled\s*=\s*p_enabled/i);
  assert.match(migration, /revoke all on function public\.set_remy_global_enabled\(boolean\) from public, anon, authenticated/i);
  assert.match(migration, /grant execute on function public\.set_remy_global_enabled\(boolean\) to service_role/i);
});

test('Instagram switch is clearly channel-specific instead of presenting itself as global', () => {
  assert.doesNotMatch(instagramToggle, /Remy Instagram global/);
  assert.match(instagramToggle, /Instagram/);
});
