import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const siteShell = readFileSync(
  join(process.cwd(), 'src/components/layout/SiteShell.tsx'),
  'utf8',
);

test('Remy web visibility is explicit and fail-closed', () => {
  assert.match(siteShell, /remy_web_visible/);
  assert.match(siteShell, /useState\(false\)/);
  assert.match(
    siteShell,
    /setRemyWebVisible\(data\.data\.remy_web_visible === true\)/,
  );
  assert.match(siteShell, /\{remyWebVisible && <Chatbot \/>\}/);
});
