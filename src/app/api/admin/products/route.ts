import { NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { getCurrentAdminUser } from '@/lib/supabase/server-auth';

export async function GET() {
  const admin = await getCurrentAdminUser();
  if (!admin || !['admin', 'soporte', 'bodega'].includes(admin.rol)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const db = createSupabaseServiceClient();
  const { data, error } = await db.from('productos').select('*, category:categorias(nombre)').order('nombre');
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Map to Makangru structure
  const mapped = (data || []).map(p => ({
    id: p.id,
    category_id: p.categoriaId || p.category_id,
    name: p.nombre,
    slug: p.slug,
    description: p.descripcion,
    price: p.precio,
    compare_price: p.compare_price,
    cost_price: p.cost_price,
    sku: p.sku,
    stock: p.stock !== undefined ? p.stock : 0,
    low_stock_alert: p.low_stock_alert !== undefined ? p.low_stock_alert : 5,
    weight_grams: p.weight_grams || p.gramaje || null,
    images: Array.isArray(p.images) ? p.images : (p.imagenUrl ? [p.imagenUrl] : []),
    ingredients: p.ingredients || [],
    allergens: p.allergens || [],
    is_active: p.activo !== undefined ? p.activo : true,
    is_featured: p.is_featured || false,
    is_new: p.is_new || false,
    story: p.story || '',
    category: p.category ? { name: p.category.nombre } : null,
  }));

  return NextResponse.json({ data: mapped });
}

export async function POST(req: Request) {
  const admin = await getCurrentAdminUser();
  if (!admin || !['admin', 'bodega'].includes(admin.rol)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const db = createSupabaseServiceClient();
  const body = await req.json();

  const payload = {
    categoriaId: body.category_id || body.categoriaId || null,
    nombre: body.name || body.nombre,
    slug: body.slug,
    descripcion: body.description || body.descripcion || '',
    precio: Number(body.price !== undefined ? body.price : (body.precio !== undefined ? body.precio : 0)),
    compare_price: body.compare_price !== undefined ? Number(body.compare_price) : null,
    cost_price: body.cost_price !== undefined ? Number(body.cost_price) : null,
    sku: body.sku || null,
    stock: Number(body.stock !== undefined ? body.stock : 0),
    low_stock_alert: Number(body.low_stock_alert !== undefined ? body.low_stock_alert : 5),
    weight_grams: Number(body.weight_grams || body.gramaje || null),
    images: Array.isArray(body.images) ? body.images : (body.image_url ? [body.image_url] : []),
    ingredients: body.ingredients || [],
    allergens: body.allergens || [],
    activo: body.is_active !== undefined ? body.is_active : (body.activo !== undefined ? body.activo : true),
    is_featured: body.is_featured || false,
    is_new: body.is_new || false,
    story: body.story || '',
  };

  const { data, error } = await db.from('productos').insert(payload).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data }, { status: 201 });
}
