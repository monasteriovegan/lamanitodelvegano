import assert from 'node:assert/strict';
import test from 'node:test';
import { cyberDatabase, CYBER_MIGRATION, CYBER_IMAGE_FIX, CYBER_PRESENTATION_MIGRATION, BUSINESS_ID } from './fixtures/cyber-database.ts';
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

test('Cyber presentation migration isolates campaign media and maps every advertised option', async () => {
  const db = await cyberDatabase();
  try {
    await db.exec(CYBER_MIGRATION);
    await db.exec(CYBER_IMAGE_FIX);
    const masterImagesBefore = (await db.query('select slug,imagen_url,images from productos order by slug')).rows;
    const masterVariantPricesBefore = (await db.query('select sku,price,compare_at_price from product_variants order by sku')).rows;

    assert.ok(CYBER_PRESENTATION_MIGRATION, 'the Cyber presentation migration must exist');
    await db.exec(CYBER_PRESENTATION_MIGRATION);
    await db.exec(CYBER_PRESENTATION_MIGRATION);

    const slots = (await db.query<{presentation_slot:string;count:number}>(
      `select presentation_slot,count(*)::integer count from season_products sp
       join seasons s on s.id=sp.season_id
       where s.campaign_tag='cyber-day-chocolatoso-2026'
       group by presentation_slot`,
    )).rows;
    const slotCount = (slot: string) => slots.find((row) => row.presentation_slot === slot)?.count || 0;
    assert.equal(slotCount('featured'), 6);
    assert.equal(slotCount('hero_offer'), 1);
    assert.equal(slotCount('target_only'), 2);

    const barTargetSkus = (await db.query<{sku:string}>(
      `select v.sku from season_product_variant_targets t
       join product_variants v on v.id=t.target_variant_id
       order by v.sku`,
    )).rows.map((row) => row.sku);
    assert.equal(barTargetSkus.length, 6);
    assert.deepEqual(barTargetSkus.sort(), [
      'LMV-DUBAI-120G', 'LMV-DUBAI-240G',
      'LMV-TERREMOTO-120G', 'LMV-TERREMOTO-240G',
      'LMV-SUPERNOVA-110', 'LMV-SUPERNOVA-230',
    ].sort());

    const bombonFlavorCount = (await db.query<{count:number}>(
      `select count(*)::integer count from product_option_values value
       join product_option_groups grouping on grouping.id=value.option_group_id
       join productos product on product.id=grouping.product_id
       where product.slug='promocion-24-bombones' and grouping.code='sabores' and value.is_active`,
    )).rows[0].count;
    assert.equal(bombonFlavorCount, 6);

    const selectionsFor = async (slug: string) => (await db.query<{selection_quantity:number}>(
      `select variant.selection_quantity from product_variants variant
       join productos product on product.id=variant.product_id
       where product.slug=$1 and variant.is_active
       order by variant.selection_quantity`, [slug],
    )).rows.map((row) => row.selection_quantity);
    const flavorsFor = async (slug: string) => (await db.query<{count:number}>(
      `select count(*)::integer count from product_option_values value
       join product_option_groups grouping on grouping.id=value.option_group_id
       join productos product on product.id=grouping.product_id
       where product.slug=$1 and grouping.is_active and value.is_active`, [slug],
    )).rows[0].count;
    assert.deepEqual({ flavors: await flavorsFor('brigadeiros-trufas-surtidos'), selections: await selectionsFor('brigadeiros-trufas-surtidos') }, { flavors: 6, selections: [9, 15, 24] });
    assert.deepEqual({ flavors: await flavorsFor('protein-balls'), selections: await selectionsFor('protein-balls') }, { flavors: 3, selections: [9, 15, 24] });
    assert.equal(await flavorsFor('alfajores-canamo'), 4);
    assert.ok((await selectionsFor('alfajores-canamo')).includes(4));
    assert.deepEqual({ flavors: await flavorsFor('box-chocolatosa'), selections: await selectionsFor('box-chocolatosa') }, { flavors: 3, selections: [0] });
    assert.deepEqual({ flavors: await flavorsFor('duo-barras-rellenas'), selections: await selectionsFor('duo-barras-rellenas') }, { flavors: 2, selections: [2] });

    assert.deepEqual((await db.query('select slug,imagen_url,images from productos order by slug')).rows, masterImagesBefore);
    assert.deepEqual((await db.query('select sku,price,compare_at_price from product_variants order by sku')).rows, masterVariantPricesBefore);

    assert.equal((await db.query<{relrowsecurity:boolean}>("select relrowsecurity from pg_class where relname='season_product_variant_targets'")).rows[0].relrowsecurity, true);
    await db.exec('set role anon');
    await assert.rejects(db.query('select * from season_product_variant_targets'), /permission denied/);
    await db.exec('reset role');
    await db.exec('set role authenticated');
    await assert.rejects(db.query('select * from season_product_variant_targets'), /permission denied/);
    await db.exec('reset role');
    await db.exec('set role service_role');
    assert.equal((await db.query('select * from season_product_variant_targets')).rows.length, 6);
    await db.exec('reset role');
  } finally { await db.close(); }
});
