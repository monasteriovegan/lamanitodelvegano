import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

test('Especial fin de semana is a cross-sell campaign with canonical product slugs', () => {
  const sql = read('supabase/migrations/20261001090000_especial_fin_de_semana_catalog.sql');
  assert.match(sql, /campaign_tag\s*[,)]\s*[^\n]*especial-fin-de-semana/i);
  for (const slug of [
    'pack-parrillero-vegano-1',
    'pack-parrillero-vegano-2',
    'seitan-parrillero',
    'barra-dubai',
    'explosion-supernova',
    'alfajores-canamo',
    'protein-balls',
    'promocion-24-bombones',
    'brigadeiros-trufas-surtidos',
    'dulces-tipicos',
    'box-rollitos-canela',
  ]) assert.match(sql, new RegExp(`'${slug}'`));
  assert.match(sql, /on conflict \(business_unit_id, campaign_tag\)/i);
});

test('made-to-order Seitán is reopened without inherited finite stock', () => {
  const sql = read('supabase/migrations/20261001090000_especial_fin_de_semana_catalog.sql');
  const seitanUpdate = sql.match(/update public\.productos set\s+nombre = 'Seitán preparado'[\s\S]*?where business_unit_id = v_business and slug = 'seitan-parrillero';/i)?.[0] || '';
  assert.match(seitanUpdate, /maneja_stock = false/i);
  assert.match(seitanUpdate, /stock = null/i);
});

test('weekend campaign products have the approved October delivery window', () => {
  const sql = read('supabase/migrations/20261001170000_especial_fin_de_semana_delivery_dates.sql');
  for (const date of [
    '2026-10-03',
    '2026-10-05',
    '2026-10-06',
    '2026-10-07',
    '2026-10-08',
    '2026-10-09',
    '2026-10-10',
  ]) assert.match(sql, new RegExp(date));

  assert.doesNotMatch(sql, /2026-10-04/);
  assert.doesNotMatch(sql, /2026-10-11/);
  assert.match(sql, /campaign_tag\s*=\s*'especial-fin-de-semana'/i);
  assert.match(sql, /update public\.productos/i);
});

test('Home points to the weekend campaign and no longer renders the Fiestas hero block', () => {
  const home = read('src/app/page.tsx');
  const hero = read('src/components/layout/Hero.tsx');
  assert.match(home, /<Hero\s*\/>/);
  assert.doesNotMatch(home, /loadDefaultCatalogCampaign\('fiestas-patrias-2026'/);
  assert.doesNotMatch(home, /Fiestas Patrias 2026/);
  assert.match(hero, /ANTOJOS VEGANOS PARA EL FINDE/);
  assert.match(hero, /Ver especial de fin de semana/);
  assert.match(hero, /\/especial-fin-de-semana/);
});

test('Weekend campaign route uses the generic campaign catalog and keeps Fiestas route intact', () => {
  const page = read('src/app/especial-fin-de-semana/page.tsx');
  assert.match(page, /loadDefaultCatalogCampaign\('especial-fin-de-semana',\s*'web'\)/);
  assert.match(page, /<CampaignCatalog\s+campaign=/);
  const fiestasPage = read('src/app/fiestas-patrias-2026/page.tsx');
  assert.match(fiestasPage, /loadDefaultCatalogCampaign\('fiestas-patrias-2026',\s*'web',\s*true\)/);
});
