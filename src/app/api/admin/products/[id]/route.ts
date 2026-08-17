import { NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { getCurrentAdminUser } from '@/lib/supabase/server-auth';
import { BusinessRepository } from '@/lib/repositories/business-repository';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_: Request, { params }: RouteParams) {
  const admin = await getCurrentAdminUser();
  if (!admin || !['admin', 'soporte', 'bodega'].includes(admin.rol)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { id } = await params;
  const db = createSupabaseServiceClient();
  const business = await new BusinessRepository(db).requireDefault();
  const { data, error } = await db.from('productos')
    .select('*, category:categorias(nombre)')
    .eq('id', id)
    .eq('business_unit_id', business.id)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 404 });

  const mapped = {
    id: data.id,
    business_unit_id: data.business_unit_id,
    category_id: data.category_id,
    name: data.nombre,
    slug: data.slug,
    description: data.descripcion,
    price: data.precio,
    compare_price: data.compare_price,
    cost_price: data.cost_price,
    sku: data.sku,
    stock: data.stock !== undefined ? data.stock : 0,
    low_stock_alert: data.low_stock_alert !== undefined ? data.low_stock_alert : 5,
    weight_grams: data.weight_grams || data.gramaje || null,
    images: Array.isArray(data.images) ? data.images : (data.imagen_url ? [data.imagen_url] : []),
    ingredients: data.ingredients || [],
    allergens: data.allergens || [],
    is_active: data.activo !== undefined ? data.activo : true,
    is_featured: data.is_featured || false,
    is_new: data.is_new || false,
    story: data.story || '',
    category: data.category ? { name: data.category.nombre } : null,
  };

  return NextResponse.json({ data: mapped });
}

export async function PUT(req: Request, { params }: RouteParams) {
  const admin = await getCurrentAdminUser();
  if (!admin || !['admin', 'bodega'].includes(admin.rol)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { id } = await params;
  const db = createSupabaseServiceClient();
  const business = await new BusinessRepository(db).requireDefault();
  const body = await req.json();

  const payload: any = {};
  if (body.category_id !== undefined || body.categoriaId !== undefined) payload.category_id = body.category_id || body.categoriaId || null;
  if (body.name !== undefined || body.nombre !== undefined) payload.nombre = body.name || body.nombre;
  if (body.slug !== undefined) payload.slug = body.slug;
  if (body.description !== undefined || body.descripcion !== undefined) payload.descripcion = body.description || body.descripcion;
  if (body.price !== undefined || body.precio !== undefined) payload.precio = Number(body.price !== undefined ? body.price : body.precio);
  if (body.compare_price !== undefined) payload.compare_price = body.compare_price !== null ? Number(body.compare_price) : null;
  if (body.cost_price !== undefined) payload.cost_price = body.cost_price !== null ? Number(body.cost_price) : null;
  if (body.sku !== undefined) payload.sku = body.sku || null;
  if (body.stock !== undefined) payload.stock = Number(body.stock);
  if (body.low_stock_alert !== undefined) payload.low_stock_alert = Number(body.low_stock_alert);
  if (body.weight_grams !== undefined) payload.weight_grams = body.weight_grams !== null ? Number(body.weight_grams) : null;
  if (body.images !== undefined) payload.images = Array.isArray(body.images) ? body.images : [body.images];
  if (body.ingredients !== undefined) payload.ingredients = body.ingredients;
  if (body.allergens !== undefined) payload.allergens = body.allergens;
  if (body.is_active !== undefined || body.activo !== undefined) payload.activo = body.is_active !== undefined ? body.is_active : body.activo;
  if (body.is_featured !== undefined) payload.is_featured = body.is_featured;
  if (body.is_new !== undefined) payload.is_new = body.is_new;
  if (body.story !== undefined) payload.story = body.story || '';

  const { data, error } = await db.from('productos')
    .update(payload)
    .eq('id', id)
    .eq('business_unit_id', business.id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}

export async function DELETE(_: Request, { params }: RouteParams) {
  const admin = await getCurrentAdminUser();
  if (!admin || !['admin'].includes(admin.rol)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { id } = await params;
  const db = createSupabaseServiceClient();
  const business = await new BusinessRepository(db).requireDefault();

  const { error } = await db.from('productos')
    .delete()
    .eq('id', id)
    .eq('business_unit_id', business.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true });
}
