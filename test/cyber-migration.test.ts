import assert from 'node:assert/strict';
import test from 'node:test';
import { cyberDatabase, CYBER_MIGRATION, CYBER_IMAGE_FIX, BUSINESS_ID } from './fixtures/cyber-database.ts';
import { mapCatalogProductRow } from '../src/lib/catalog/catalog-repository.ts';
import { applyCyberPricing } from '../src/lib/catalog/cyber-pricing.ts';
import { mapSeasonVariantOverride } from '../src/lib/catalog/seasonal-catalog.ts';
import { resolveCatalogCheckoutItem } from '../src/lib/catalog/catalog-checkout.ts';

test('Cyber migration executes twice without duplicate products, variants or offers; prices match approved flyers', async () => {
  const db = await cyberDatabase();
  try {
    await db.exec(CYBER_MIGRATION);
    await db.exec(CYBER_IMAGE_FIX);
    const before = (await db.query('select (select count(*) from productos) products,(select count(*) from product_variants) variants,(select count(*) from season_variant_overrides) offers')).rows;
    await db.exec(CYBER_MIGRATION);
    assert.deepEqual((await db.query('select (select count(*) from productos) products,(select count(*) from product_variants) variants,(select count(*) from season_variant_overrides) offers')).rows,before);
    const offers = (await db.query<any>('select v.sku,v.price normal,o.price_override cyber,o.compare_at_price_override original from product_variants v join season_variant_overrides o on o.variant_id=v.id')).rows;
    assert.equal(offers.length,18);
    for (const prefix of ['LMV-BOMB','LMV-PBALL','LMV-TRUFA']) for (const [size,normal,cyber] of [['09',11900,9900],['15',19900,14900],['24',23900,17900]]) {
      assert.deepEqual(offers.find((r)=>r.sku===`${prefix}-${size}`),{sku:`${prefix}-${size}`,normal,cyber,original:normal});
    }
    assert.equal(offers.find((r)=>r.sku==='LMV-CYBER-DUO-120G')?.cyber,17900);
    assert.equal(offers.find((r)=>r.sku==='LMV-ALF-HEMP-04')?.cyber,8900);
    assert.equal(offers.find((r)=>r.sku==='LMV-BOX-CHOCO-80G')?.cyber,21900);
    assert.equal((await db.query<any>("select count(*) count from season_products where is_featured")).rows[0].count,9);
    const images = (await db.query<any>("select slug,imagen_url from productos where slug in ('barra-dubai','explosion-supernova','protein-balls','brigadeiros-trufas-surtidos','promocion-24-bombones','alfajores-canamo') order by slug")).rows;
    assert.deepEqual(images, [
      { slug: 'alfajores-canamo', imagen_url: 'https://lamanitodelvegano.cl/products/alfajores-canamo.jpg' },
      { slug: 'barra-dubai', imagen_url: 'https://lamanitodelvegano.cl/products/barra-dubai.jpg' },
      { slug: 'brigadeiros-trufas-surtidos', imagen_url: 'https://lamanitodelvegano.cl/products/brigadeiros-trufas-surtidos.jpg' },
      { slug: 'explosion-supernova', imagen_url: 'https://lamanitodelvegano.cl/campaigns/especial-fin-de-semana/supernova.png' },
      { slug: 'promocion-24-bombones', imagen_url: 'https://supabase.lamanitodelvegano.cl/storage/v1/object/public/productos/ads-media/2026-10-01/1790877111796-232b67de-24d7-44cd-a433-5cb8d9be7c68.png' },
      { slug: 'protein-balls', imagen_url: 'https://lamanitodelvegano.cl/products/protein-balls.jpg' },
    ]);
    const row = (await db.query<any>(`select p.*, (select json_agg(v) from product_variants v where v.product_id=p.id) product_variants,
      (select json_agg(g) from (select g.*, (select json_agg(v) from product_option_values v where v.option_group_id=g.id) product_option_values from product_option_groups g where g.product_id=p.id) g) product_option_groups
      from productos p where slug='duo-barras-rellenas'`)).rows[0];
    const overrides = (await db.query<{variant_id:string;price_override:number;compare_at_price_override:number;is_active:boolean}>('select * from season_variant_overrides')).rows.map(mapSeasonVariantOverride);
    const product = applyCyberPricing(mapCatalogProductRow(BUSINESS_ID,row)!,{startsAt:'2026-10-05T03:00:00Z',endsAt:'2026-10-10T02:59:59Z',overrides},new Date('2026-10-06T12:00:00Z'));
    const values = product.optionGroups[0].values;
    const result = resolveCatalogCheckoutItem(product,{productoId:product.id,variantId:product.variants[0].id,qty:1,selections:values.map((v)=>({optionValueId:v.id,quantity:1})),clientPrice:1});
    assert.equal(result.ok && result.item.precio,17900);
    assert.equal(resolveCatalogCheckoutItem(product,{productoId:product.id,variantId:product.variants[0].id,qty:1,selections:[{optionValueId:values[0].id,quantity:1}]}).ok,false);
  } finally { await db.close(); }
});
test('Cyber aborts atomically if any required flyer variant is missing', async () => {
  const db = await cyberDatabase();
  try {
    await db.exec("delete from product_variants where sku='LMV-BOMB-09'");
    await assert.rejects(db.exec(CYBER_MIGRATION), /Variantes base Cyber incompletas/);
    await db.exec('rollback');
    assert.equal((await db.query<any>("select count(*) count from productos where slug='duo-barras-rellenas'")).rows[0].count,0);
    assert.equal((await db.query<any>("select price from product_variants where sku='LMV-DUBAI-240G'")).rows[0].price,18900);
  } finally { await db.close(); }
});
