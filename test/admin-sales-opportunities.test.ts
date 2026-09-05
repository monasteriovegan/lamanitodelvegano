import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const files = [
  'src/app/api/admin/sales-opportunities/route.ts',
  'src/app/api/admin/sales-opportunities/[id]/route.ts',
  'src/app/api/admin/sales-opportunities/[id]/send/route.ts',
  'src/app/admin/oportunidades/page.tsx',
  'src/app/admin/oportunidades/OpportunityActions.tsx',
];

test('admin opportunity inbox exposes safe copilot actions', () => {
  for (const path of files) assert.equal(fs.existsSync(path), true, `${path} must exist`);
  const page = fs.readFileSync('src/app/admin/oportunidades/page.tsx', 'utf8');
  const actions = fs.readFileSync('src/app/admin/oportunidades/OpportunityActions.tsx', 'utf8');
  assert.match(page, /requireRole\(\['admin'\]\)/);
  assert.match(page, /Oportunidades de venta/);
  for (const label of ['Enviar ahora', 'Editar mensaje', 'Recordarme después', 'Descartar', 'Abrir conversación']) {
    assert.match(`${page}\n${actions}`, new RegExp(label));
  }
});

test('manual opportunity send uses canonical messaging and persists audit metadata', () => {
  const source = fs.readFileSync('src/app/api/admin/sales-opportunities/[id]/send/route.ts', 'utf8');
  assert.match(source, /sendMessage/);
  assert.match(source, /mode:\s*'manual'/);
  assert.match(source, /persistMessage/);
  assert.match(source, /opportunity_id/);
});
