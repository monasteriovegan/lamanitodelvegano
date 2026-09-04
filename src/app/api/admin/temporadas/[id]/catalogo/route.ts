/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { CatalogRepository } from '@/lib/catalog/catalog-repository';
import { toPublicCatalogProduct } from '@/lib/catalog/public-dto';
import { BusinessRepository } from '@/lib/repositories/business-repository';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { getCurrentAdminUser } from '@/lib/supabase/server-auth';

interface RouteParams { params: Promise<{ id: string }> }

async function context(id: string) {
  const admin = await getCurrentAdminUser();
  if (!admin || admin.rol !== 'admin') return null;
  const db = createSupabaseServiceClient();
  const business = await new BusinessRepository(db).requireDefault();
  const { data: season, error } = await db.from('seasons')
    .select('id,name,campaign_tag,is_active,starts_at,ends_at,visible_web,visible_whatsapp,visible_instagram,available_to_remy,season_products(*)')
    .eq('id', id)
    .eq('business_unit_id', business.id)
    .maybeSingle();
  if (error) throw error;
  if (!season) return { db, business, season: null };
  return { db, business, season };
}

export async function GET(_: Request, { params }: RouteParams) {
  const { id } = await params;
  let ctx;
  try { ctx = await context(id); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'season_load_failed' }, { status: 400 }); }
  if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!ctx.season) return NextResponse.json({ error: 'Temporada no encontrada.' }, { status: 404 });

  const links = ctx.season.season_products || [];
  const productIds = links.map((link: any) => String(link.product_id));
  if (!productIds.length) return NextResponse.json({ data: { season: ctx.season, products: [] } });

  const [{ data: variants, error: variantError }, { data: groups, error: groupError }, { data: values, error: valueError }, { data: overrides, error: overrideError }] = await Promise.all([
    ctx.db.from('product_variants').select('*').eq('business_unit_id', ctx.business.id).in('product_id', productIds).order('sort_order'),
    ctx.db.from('product_option_groups').select('*').eq('business_unit_id', ctx.business.id).in('product_id', productIds).order('sort_order'),
    ctx.db.from('product_option_values').select('*').eq('business_unit_id', ctx.business.id).order('sort_order'),
    ctx.db.from('season_variant_overrides').select('*').eq('business_unit_id', ctx.business.id).eq('season_id', ctx.season.id),
  ]);
  const readError = variantError || groupError || valueError || overrideError;
  if (readError) return NextResponse.json({ error: readError.message }, { status: 400 });

  const overrideByVariant = new Map((overrides || []).map((row: any) => [String(row.variant_id), row]));
  const repo = new CatalogRepository(ctx.db);
  const products = await Promise.all(links.map(async (link: any) => {
    const product = await repo.getById(ctx.business.id, String(link.product_id), true);
    const dto = product ? toPublicCatalogProduct(product) : null;
    if (!product || !dto) return null;
    const productGroups = (groups || []).filter((group: any) => String(group.product_id) === product.id);
    return {
      ...dto,
      active: product.active,
      visibility: {
        web: Boolean(link.visible_web),
        whatsapp: Boolean(link.visible_whatsapp),
        instagram: Boolean(link.visible_instagram),
        remy: Boolean(link.available_to_remy),
      },
      sortOrder: Number(link.sort_order || 0),
      variants: (variants || []).filter((variant: any) => String(variant.product_id) === product.id).map((variant: any) => {
        const override: any = overrideByVariant.get(String(variant.id));
        return {
          id: String(variant.id),
          sku: String(variant.sku),
          name: String(variant.name),
          masterPrice: Number(variant.price),
          masterCompareAtPrice: variant.compare_at_price == null ? null : Number(variant.compare_at_price),
          priceOverride: override?.price_override == null ? null : Number(override.price_override),
          compareAtPriceOverride: override?.compare_at_price_override == null ? null : Number(override.compare_at_price_override),
          stock: variant.stock == null ? null : Number(variant.stock),
          managesStock: Boolean(variant.manages_stock),
          active: Boolean(variant.is_active),
        };
      }),
      optionGroups: productGroups.map((group: any) => ({
        id: String(group.id),
        name: String(group.name),
        active: Boolean(group.is_active),
        values: (values || []).filter((value: any) => String(value.option_group_id) === String(group.id)).map((value: any) => ({
          id: String(value.id), label: String(value.label), active: Boolean(value.is_active),
        })),
      })),
    };
  }));

  return NextResponse.json({ data: { season: ctx.season, products: products.filter(Boolean).sort((a: any, b: any) => a.sortOrder - b.sortOrder) } });
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const { id } = await params;
  let ctx;
  try { ctx = await context(id); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'season_load_failed' }, { status: 400 }); }
  if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!ctx.season) return NextResponse.json({ error: 'Temporada no encontrada.' }, { status: 404 });

  const body = await request.json() as Record<string, unknown>;
  const productId = String(body.productId || '').trim();
  if (!productId) return NextResponse.json({ error: 'product_id_required' }, { status: 400 });

  const { data: product } = await ctx.db.from('productos').select('id').eq('id', productId).eq('business_unit_id', ctx.business.id).maybeSingle();
  if (!product) return NextResponse.json({ error: 'product_not_found' }, { status: 404 });
  const { data: link } = await ctx.db.from('season_products').select('season_id,product_id').eq('season_id', ctx.season.id).eq('product_id', productId).maybeSingle();
  if (!link) return NextResponse.json({ error: 'season_product_not_found' }, { status: 404 });

  const linkPatch: Record<string, boolean> = {};
  if (typeof body.visibleWeb === 'boolean') linkPatch.visible_web = body.visibleWeb;
  if (typeof body.visibleWhatsapp === 'boolean') linkPatch.visible_whatsapp = body.visibleWhatsapp;
  if (typeof body.visibleInstagram === 'boolean') linkPatch.visible_instagram = body.visibleInstagram;
  if (typeof body.availableToRemy === 'boolean') linkPatch.available_to_remy = body.availableToRemy;
  if (Object.keys(linkPatch).length) {
    const { error } = await ctx.db.from('season_products').update(linkPatch).eq('season_id', ctx.season.id).eq('product_id', productId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const variantId = body.variantId ? String(body.variantId) : null;
  if (variantId) {
    const { data: variant } = await ctx.db.from('product_variants').select('id,price').eq('id', variantId).eq('product_id', productId).eq('business_unit_id', ctx.business.id).maybeSingle();
    if (!variant) return NextResponse.json({ error: 'variant_not_found' }, { status: 404 });

    if (body.clearOverride === true) {
      const { error } = await ctx.db.from('season_variant_overrides').delete().eq('season_id', ctx.season.id).eq('variant_id', variantId).eq('business_unit_id', ctx.business.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    } else if ('priceOverride' in body || 'compareAtPriceOverride' in body) {
      const parseNullablePrice = (value: unknown, field: string) => {
        if (value === null || value === undefined || value === '') return null;
        const number = Number(value);
        if (!Number.isInteger(number) || number < 0) throw new Error(`invalid_${field}`);
        return number;
      };
      let priceOverride: number | null;
      let compareAtPriceOverride: number | null;
      try {
        priceOverride = parseNullablePrice(body.priceOverride, 'price_override');
        compareAtPriceOverride = parseNullablePrice(body.compareAtPriceOverride, 'compare_at_price_override');
      } catch (error) {
        return NextResponse.json({ error: error instanceof Error ? error.message : 'invalid_override' }, { status: 400 });
      }
      const effectivePrice = priceOverride ?? Number(variant.price);
      if (compareAtPriceOverride !== null && compareAtPriceOverride < effectivePrice) {
        return NextResponse.json({ error: 'compare_at_price_below_effective_price' }, { status: 400 });
      }
      const { error } = await ctx.db.from('season_variant_overrides').upsert({
        business_unit_id: ctx.business.id,
        season_id: ctx.season.id,
        variant_id: variantId,
        price_override: priceOverride,
        compare_at_price_override: compareAtPriceOverride,
        is_active: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'season_id,variant_id' });
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    }
  }

  return NextResponse.json({ ok: true });
}
