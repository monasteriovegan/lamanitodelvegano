/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { CatalogRepository } from '@/lib/catalog/catalog-repository';
import { parseCatalogAdminUpdate } from '@/lib/catalog/admin-catalog';
import { toPublicCatalogProduct } from '@/lib/catalog/public-dto';
import { BusinessRepository } from '@/lib/repositories/business-repository';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { getCurrentAdminUser } from '@/lib/supabase/server-auth';

const CAMPAIGN_TAG = 'fiestas-patrias-2026';

async function context() {
  const admin = await getCurrentAdminUser();
  if (!admin || admin.rol !== 'admin') return null;
  const db = createSupabaseServiceClient();
  const business = await new BusinessRepository(db).requireDefault();
  return { db, business };
}

export async function GET() {
  const ctx = await context();
  if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const { data: season, error } = await ctx.db.from('seasons')
    .select('id,name,campaign_tag,is_active,visible_web,visible_whatsapp,visible_instagram,available_to_remy,season_products(*)')
    .eq('business_unit_id', ctx.business.id).eq('campaign_tag', CAMPAIGN_TAG).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!season) return NextResponse.json({ error: 'campaign_not_found' }, { status: 404 });
  const productIds = (season.season_products || []).map((link: any) => String(link.product_id));
  const [{ data: variants }, { data: groups }, { data: values }] = await Promise.all([
    ctx.db.from('product_variants').select('*').eq('business_unit_id', ctx.business.id).in('product_id', productIds).order('sort_order'),
    ctx.db.from('product_option_groups').select('*').eq('business_unit_id', ctx.business.id).in('product_id', productIds).order('sort_order'),
    ctx.db.from('product_option_values').select('*').eq('business_unit_id', ctx.business.id).order('sort_order'),
  ]);
  const repo = new CatalogRepository(ctx.db);
  const products = await Promise.all((season.season_products || []).map(async (link: any) => {
    const product = await repo.getById(ctx.business.id, String(link.product_id), true);
    const dto = product ? toPublicCatalogProduct(product) : null;
    const productGroups = (groups || []).filter((group: any) => String(group.product_id) === String(link.product_id));
    return product && dto ? { ...dto,
      variants: (variants || []).filter((variant: any) => String(variant.product_id) === product.id).map((variant: any) => ({
        id: variant.id, sku: variant.sku, name: variant.name, price: Number(variant.price), active: Boolean(variant.is_active),
        stock: variant.stock === null ? null : Number(variant.stock), managesStock: Boolean(variant.manages_stock),
      })),
      optionGroups: productGroups.map((group: any) => ({ id: group.id, name: group.name, active: Boolean(group.is_active), values: (values || [])
        .filter((value: any) => String(value.option_group_id) === String(group.id))
        .map((value: any) => ({ id: value.id, label: value.label, active: Boolean(value.is_active) })) })),
      active: product.active, visibility: {
      web: Boolean(link.visible_web), whatsapp: Boolean(link.visible_whatsapp),
      instagram: Boolean(link.visible_instagram), remy: Boolean(link.available_to_remy),
    }, sortOrder: Number(link.sort_order || 0) } : null;
  }));
  return NextResponse.json({ data: { campaign: season, products: products.filter(Boolean).sort((a: any, b: any) => a.sortOrder - b.sortOrder) } });
}

export async function PATCH(request: Request) {
  const ctx = await context();
  if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  let update;
  try { update = parseCatalogAdminUpdate(await request.json()); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'invalid_payload' }, { status: 400 }); }

  const { data: product } = await ctx.db.from('productos').select('id').eq('id', update.productId)
    .eq('business_unit_id', ctx.business.id).maybeSingle();
  if (!product) return NextResponse.json({ error: 'product_not_found' }, { status: 404 });

  if (update.productActive !== undefined) {
    const { error } = await ctx.db.from('productos').update({ activo: update.productActive }).eq('id', update.productId).eq('business_unit_id', ctx.business.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (update.variantId) {
    const variantPatch: Record<string, unknown> = {};
    if (update.price !== undefined) variantPatch.price = update.price;
    if (update.variantActive !== undefined) variantPatch.is_active = update.variantActive;
    if (update.stock !== undefined) variantPatch.stock = update.stock;
    if (Object.keys(variantPatch).length) {
      const { error } = await ctx.db.from('product_variants').update(variantPatch)
        .eq('id', update.variantId).eq('product_id', update.productId).eq('business_unit_id', ctx.business.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    }
  }
  if (update.optionValueId && update.optionActive !== undefined) {
    const { error } = await ctx.db.from('product_option_values').update({ is_active: update.optionActive })
      .eq('id', update.optionValueId).eq('business_unit_id', ctx.business.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }
  const linkPatch: Record<string, boolean> = {};
  if (update.visibleWeb !== undefined) linkPatch.visible_web = update.visibleWeb;
  if (update.visibleWhatsapp !== undefined) linkPatch.visible_whatsapp = update.visibleWhatsapp;
  if (update.visibleInstagram !== undefined) linkPatch.visible_instagram = update.visibleInstagram;
  if (update.availableToRemy !== undefined) linkPatch.available_to_remy = update.availableToRemy;
  if (Object.keys(linkPatch).length) {
    const { data: season } = await ctx.db.from('seasons').select('id').eq('business_unit_id', ctx.business.id).eq('campaign_tag', CAMPAIGN_TAG).single();
    if (!season) return NextResponse.json({ error: 'campaign_not_found' }, { status: 404 });
    const { error } = await ctx.db.from('season_products').update(linkPatch).eq('season_id', season.id).eq('product_id', update.productId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
