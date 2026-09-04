import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

test('seasonal catalog stores temporary price overrides outside master variants', () => {
  const migrationPath = 'supabase/migrations/20260904020000_season_variant_overrides.sql';
  assert.ok(existsSync(join(root, migrationPath)), 'season override migration must exist');
  const sql = read(migrationPath);
  assert.match(sql, /create table if not exists public\.season_variant_overrides/i);
  assert.match(sql, /price_override integer/i);
  assert.match(sql, /compare_at_price_override integer/i);
  assert.match(sql, /unique\s*\(season_id,\s*variant_id\)/i);
  assert.doesNotMatch(sql, /update\s+public\.product_variants\s+set\s+price/i);
});

test('admin season catalog is generic and does not mutate master prices', () => {
  const routePath = 'src/app/api/admin/temporadas/[id]/catalogo/route.ts';
  const pagePath = 'src/app/admin/temporadas/[id]/catalogo/page.tsx';
  assert.ok(existsSync(join(root, routePath)), 'generic season catalog API must exist');
  assert.ok(existsSync(join(root, pagePath)), 'generic season catalog page must exist');
  const route = read(routePath);
  assert.doesNotMatch(route, /fiestas-patrias-2026/);
  assert.match(route, /season_variant_overrides/);
  assert.doesNotMatch(route, /product_variants['"]\)\.update\(\{\s*price/);

  const legacy = read('src/app/admin/catalogo-master/page.tsx');
  assert.match(legacy, /redirect\(['"]\/admin\/temporadas['"]\)/);
});

test('sidebar presents catalog master, seasons and categories without top-level Canales & Precios', () => {
  const desktop = read('src/app/admin/AdminSidebar.tsx');
  const mobile = read('src/app/admin/MobileAdminNav.tsx');
  assert.match(desktop, /Temporadas/);
  assert.doesNotMatch(desktop, /Canales & Precios/);
  assert.match(mobile, /Temporadas/);
  assert.doesNotMatch(mobile, /Canales & Precios/);
});

test('storefront loads normalized variants and featured cards use the shared promotion summary', () => {
  const loader = read('src/lib/data/catalogo.ts');
  const home = read('src/app/page.tsx');
  const card = read('src/components/tienda/ProductCard.tsx');
  assert.match(loader, /product_variants/);
  assert.match(loader, /variants/);
  assert.match(home, /formatPriceSummary/);
  assert.doesNotMatch(home, /\$\{p\.precio\.toLocaleString/);
  assert.match(card, /const\s+priceSummary\s*=\s*formatPriceSummary\(producto\)/);
});

test('season list links each season to its own product and channel editor', () => {
  const page = read('src/app/admin/temporadas/page.tsx');
  assert.match(page, /Gestionar productos y canales/);
  assert.match(page, /\/admin\/temporadas\/\$\{[^}]+\}\/catalogo/);
});
