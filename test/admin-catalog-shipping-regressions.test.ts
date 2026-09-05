import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

function read(path: string) { return fs.readFileSync(path, 'utf8'); }

test('product delete archives referenced products instead of crashing on cart history', () => {
  const source = read('src/app/admin/productos/actions.ts');
  const list = read('src/app/admin/productos/page.tsx');
  assert.match(source, /cart_items/);
  assert.match(source, /activo\s*:\s*false/);
  assert.match(source, /archivad|archiv/i);
  assert.match(source, /delete\(\)/);
  assert.match(list, /\.eq\(['"]activo['"],\s*true\)/);
});

test('saving a product gives visible confirmation before the operator moves on', () => {
  const action = read('src/app/admin/productos/actions.ts');
  const page = read('src/app/admin/productos/[id]/page.tsx');
  assert.match(action, /redirect\(/);
  assert.match(action, /saved=1|guardado=1/);
  assert.match(page, /Cambios guardados|Producto guardado/);
});

test('shipping zones can always be edited manually from admin', () => {
  const actions = read('src/app/admin/zonas/actions.ts');
  const page = read('src/app/admin/zonas/page.tsx');
  assert.match(actions, /actualizarZona/);
  assert.match(actions, /\.update\(\{/);
  assert.match(page, /actualizarZona/);
  for (const field of ['nombre', 'comunas', 'precio']) assert.match(page, new RegExp(`name=["']${field}["']`));
});

test('checkout shipping is free from CLP 50000 product subtotal and remains server authoritative', () => {
  const pricing = read('src/lib/pricing/calcular-pedido.ts');
  const checkout = read('src/app/checkout/page.tsx');
  assert.match(pricing, /FREE_SHIPPING_MINIMUM\s*=\s*50_?000/);
  assert.match(pricing, /subtotal\s*>=\s*FREE_SHIPPING_MINIMUM/);
  assert.match(pricing, /costoEnvio\s*=\s*0/);
  assert.match(checkout, /50\.000|50000/);
  assert.match(checkout, /Gratis|GRATIS|gratis/);
});

test('RM shipping tariff migration contains the approved zones and base prices', () => {
  const path = 'supabase/migrations/20260905110000_rm_shipping_zones.sql';
  assert.equal(fs.existsSync(path), true);
  const sql = read(path);
  const expected = [
    ['SUR', '3500'], ['CENTRO', '4000'], ['PONIENTE', '5000'], ['NORTE', '6000'],
    ['ORIENTE', '5000'], ['CORDILLERA', '6000'], ['SUR RM', '7000'], ['PONIENTE RM', '8000'],
  ];
  for (const [name, price] of expected) {
    assert.match(sql, new RegExp(name.replace(' ', '\\s*'), 'i'));
    assert.match(sql, new RegExp(price));
  }
  assert.match(sql, /San Miguel/i);
  assert.match(sql, /Santiago Centro/i);
  assert.match(sql, /Maip[uú]/i);
  assert.match(sql, /Las Condes/i);
  assert.match(sql, /Puente Alto/i);
  assert.match(sql, /San Bernardo/i);
});
