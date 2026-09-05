import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

function read(path: string) {
  assert.equal(fs.existsSync(path), true, `${path} must exist`);
  return fs.readFileSync(path, 'utf8');
}

test('product editor can create and edit normalized option groups and pack components', () => {
  const actions = read('src/app/admin/productos/structure-actions.ts');
  const editor = read('src/app/admin/productos/ProductStructureEditor.tsx');
  const page = read('src/app/admin/productos/[id]/page.tsx');

  for (const token of ['product_option_groups', 'product_option_values', 'product_pack_components']) assert.match(actions, new RegExp(token));
  for (const fn of ['guardarGrupoOpciones', 'eliminarGrupoOpciones', 'guardarComponentePack', 'eliminarComponentePack']) assert.match(actions, new RegExp(fn));
  assert.match(editor, /Opciones \/ sabores/i);
  assert.match(editor, /Componentes del pack/i);
  assert.match(editor, /selection_mode/);
  assert.match(editor, /values/);
  assert.match(editor, /component_product_id/);
  assert.match(page, /ProductStructureEditor/);
});

test('manual order builder exposes direct and inherited component options', () => {
  const page = read('src/app/admin/pedidos/nuevo/page.tsx');
  const form = read('src/app/admin/pedidos/nuevo/ManualOrderForm.tsx');
  assert.match(page, /product_option_groups/);
  assert.match(page, /product_pack_components/);
  assert.match(page, /orderOptions/);
  assert.match(page, /component_product_id/);
  assert.match(form, /orderOptions/);
  assert.match(form, /Opciones \/ sabores/);
  assert.match(form, /updateItem\([^\n]+variedad/);
});
