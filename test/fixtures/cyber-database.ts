import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
export const BUSINESS_ID = 'f3b57ce7-0796-40e5-94f1-07cb2b48ba85';
export const CYBER_MIGRATION = readFileSync(resolve('supabase/migrations/20261006013933_cyber_day_chocolatoso_2026.sql'), 'utf8');
export async function cyberDatabase() {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create table business_units(id uuid primary key);
    insert into business_units values ('${BUSINESS_ID}');
    create table productos(id uuid primary key default gen_random_uuid(),business_unit_id uuid references business_units(id),nombre text,slug text,categoria text,descripcion text,
      precio integer,precio_anterior integer,emoji text,color_fondo text,imagen_url text,images text[],sku text,activo boolean default true,maneja_stock boolean default false,
      destacado boolean default false,is_featured boolean default false,stock integer,gramaje text,variedades text,disponibilidad text,unique(id,business_unit_id));
    create table seasons(id uuid primary key default gen_random_uuid(),business_unit_id uuid references business_units(id),name text,slug text,description text,starts_at timestamptz,ends_at timestamptz,
      color_start text,color_end text,is_active boolean,banner_image text,badge_text text,created_at timestamptz default now(),updated_at timestamptz default now());
    create table season_products(season_id uuid references seasons(id),product_id uuid references productos(id),unique(season_id,product_id));
  `);
  const catalogSchema = readFileSync(resolve('supabase/migrations/20260901180147_fiestas_patrias_catalog_master.sql'), 'utf8');
  await db.exec(catalogSchema.split('alter table public.product_variants enable row level security;')[0]);
  const overridesSchema = readFileSync(resolve('supabase/migrations/20260904020000_season_variant_overrides.sql'), 'utf8');
  await db.exec(overridesSchema.split('alter table public.season_variant_overrides enable row level security;')[0]);
  const fixture = JSON.parse(readFileSync(resolve('test/fixtures/cyber-baseline-catalog.json'), 'utf8'));
  for (const p of fixture.products) {
    await db.query('insert into productos(id,business_unit_id,nombre,slug,descripcion,precio,imagen_url,activo) values ($1,$2,$3,$4,$5,$6,$7,true)', [p.id,BUSINESS_ID,p.name,p.slug,p.description,p.variants[0]?.price||0,p.imageUrl]);
    for (const v of p.variants.filter((v: any)=>!v.id.startsWith('legacy:'))) {
      await db.query('insert into product_variants(id,business_unit_id,product_id,sku,name,price,compare_at_price,weight_grams,units_included,selection_quantity,manages_stock,stock,sort_order) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)',[v.id,BUSINESS_ID,p.id,v.sku,v.name,v.price,v.compareAtPrice,v.weightGrams,v.unitsIncluded,v.selectionQuantity,v.managesStock,v.stock,p.variants.indexOf(v)*10]);
    }
    for (const g of (p.packComponents.length ? [] : p.optionGroups).filter((g: any)=>!g.id.startsWith('legacy:'))) {
      await db.query('insert into product_option_groups(id,business_unit_id,product_id,code,name,selection_mode,is_required) values ($1,$2,$3,$4,$5,$6,$7)',[g.id,BUSINESS_ID,p.id,g.code,g.name,g.selectionMode,g.required]);
      for (const v of g.values) await db.query('insert into product_option_values(id,business_unit_id,option_group_id,code,label,price_delta) values ($1,$2,$3,$4,$5,$6)',[v.id,BUSINESS_ID,g.id,v.code,v.label,v.priceDelta]);
    }
  }
  return db;
}
