import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const migrationsDir = join(process.cwd(), 'supabase', 'migrations');

function loadCampaignSeed() {
  const filename = readdirSync(migrationsDir).find((name) => name.endsWith('_seed_fiestas_patrias_2026.sql'));
  assert.ok(filename, 'Falta la migración idempotente de datos de Fiestas Patrias 2026');
  return readFileSync(join(migrationsDir, filename), 'utf8');
}

test('la campaña contiene los siete productos autorizados y el tag canónico', () => {
  const sql = loadCampaignSeed();
  assert.match(sql, /fiestas-patrias-2026/);
  for (const slug of [
    'empanada-del-18',
    'pack-parrillero-vegano-1',
    'pack-parrillero-vegano-2',
    'postres-en-frascos',
    'seitan-parrillero',
    'le-kostilles',
    'dulces-tipicos',
  ]) assert.match(sql, new RegExp(`'${slug}'`));
});

test('precios, SKUs y cantidades seleccionables coinciden con la oferta', () => {
  const sql = loadCampaignSeed();
  for (const contract of [
    "'FP26-EMP-UNIT', 'Unidad', 2900, 220, 1, 1",
    "'FP26-EMP-PACK10', 'Pack 10', 23900, 2200, 10, 10",
    "'FP26-PARR-01', 'Pack', 11900",
    "'FP26-PARR-02', 'Pack', 15000",
    "'FP26-POSTRE-UNIT', 'Unidad', 4000, 350, 1, 1",
    "'FP26-POSTRE-PACK3', 'Pack 3', 10000, 1050, 3, 3",
    "'FP26-SEITAN-550', '550 g', 6000, 550",
    "'FP26-SEITAN-1000', '1 kg', 9900, 1000",
    "'FP26-KOST-450', '450 g (aprox. 5 unidades)', 4900, 450",
    "'FP26-DULCES-25', 'Caja surtida 25 unidades', 14900",
  ]) assert.ok(sql.includes(contract), `Falta contrato: ${contract}`);
});

test('incluye sabores oficiales, fechas y componentes sin inventar datos', () => {
  const sql = loadCampaignSeed();
  for (const value of [
    'Pino de soya', 'Pino de seitán', 'Napolitana', 'Champiñón + queso vegano',
    'Ratatouille', 'Espinacas a la crema + queso vegano', 'Cheesecake maracuyá',
    'Barbecue', 'Mostaza', 'Finas hierbas', 'Criollo picante', 'Sin adobo',
    '2026-09-12', '2026-09-15', '2026-09-16', 'Chilenitos', 'Empolvados',
    'Merenguitos', 'Alfajores decorados', 'Cachitos',
  ]) assert.ok(sql.includes(value), `Falta valor autorizado: ${value}`);
  assert.match(sql, /'Dulces Típicos', 'dulces-tipicos', false, false, 70/);
});
