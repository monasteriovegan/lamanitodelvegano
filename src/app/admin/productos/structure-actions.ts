'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerAuthClient } from '@/lib/supabase/server-auth';
import { requireRole } from '@/lib/supabase/require-role';
import { BusinessRepository } from '@/lib/repositories/business-repository';
import { slugify } from '@/lib/slugify';

async function context(productId: string) {
  await requireRole(['admin', 'bodega']);
  const db = await createSupabaseServerAuthClient();
  const business = await new BusinessRepository(db).requireDefault();
  const { data: product, error } = await db.from('productos')
    .select('id')
    .eq('id', productId)
    .eq('business_unit_id', business.id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!product) throw new Error('Producto no encontrado.');
  return { db, business };
}

function refresh(productId: string) {
  revalidatePath(`/admin/productos/${productId}`);
  revalidatePath('/admin/productos');
  revalidatePath('/');
}

function parseOptionValues(raw: string) {
  const seen = new Set<string>();
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const [labelRaw, priceRaw = '0'] = line.split('|').map((part) => part.trim());
      const label = labelRaw.trim();
      const code = slugify(label);
      const price = Number.parseInt(priceRaw.replace(/[^0-9-]/g, '') || '0', 10);
      return { label, code, priceDelta: Number.isInteger(price) ? price : 0, sortOrder: (index + 1) * 10 };
    })
    .filter((value) => value.label && value.code && !seen.has(value.code) && Boolean(seen.add(value.code)));
}

export async function guardarGrupoOpciones(formData: FormData) {
  const productId = String(formData.get('product_id') || '');
  const groupId = String(formData.get('group_id') || '');
  const { db, business } = await context(productId);
  const name = String(formData.get('name') || '').trim();
  if (!name) throw new Error('El nombre del grupo de opciones es obligatorio.');
  const selectionMode = formData.get('selection_mode') === 'quantity' ? 'quantity' : 'single';
  const values = parseOptionValues(String(formData.get('values') || ''));
  if (!values.length) throw new Error('Agrega al menos una opción o sabor.');

  let savedGroupId = groupId;
  const groupPayload = {
    business_unit_id: business.id,
    product_id: productId,
    code: slugify(name),
    name,
    selection_mode: selectionMode,
    is_required: formData.get('is_required') === 'on',
    is_active: true,
    sort_order: Number.parseInt(String(formData.get('sort_order') || '10'), 10) || 10,
    updated_at: new Date().toISOString(),
  };

  if (groupId) {
    const { error } = await db.from('product_option_groups').update(groupPayload)
      .eq('id', groupId).eq('product_id', productId).eq('business_unit_id', business.id);
    if (error) throw new Error(error.message);
  } else {
    const { data, error } = await db.from('product_option_groups').insert(groupPayload).select('id').single();
    if (error) throw new Error(error.message);
    savedGroupId = String(data.id);
  }

  const { data: existing, error: existingError } = await db.from('product_option_values')
    .select('id,code')
    .eq('option_group_id', savedGroupId)
    .eq('business_unit_id', business.id);
  if (existingError) throw new Error(existingError.message);
  const existingByCode = new Map((existing || []).map((row) => [String(row.code), row]));
  const activeCodes = new Set(values.map((value) => value.code));

  for (const value of values) {
    const current = existingByCode.get(value.code);
    const payload = {
      business_unit_id: business.id,
      option_group_id: savedGroupId,
      code: value.code,
      label: value.label,
      price_delta: value.priceDelta,
      is_active: true,
      sort_order: value.sortOrder,
      updated_at: new Date().toISOString(),
    };
    if (current) {
      const { error } = await db.from('product_option_values').update(payload).eq('id', current.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await db.from('product_option_values').insert(payload);
      if (error) throw new Error(error.message);
    }
  }

  const idsToDeactivate = (existing || []).filter((row) => !activeCodes.has(String(row.code))).map((row) => row.id);
  if (idsToDeactivate.length) {
    const { error } = await db.from('product_option_values').update({ is_active: false, updated_at: new Date().toISOString() }).in('id', idsToDeactivate);
    if (error) throw new Error(error.message);
  }

  refresh(productId);
}

export async function eliminarGrupoOpciones(productId: string, groupId: string) {
  const { db, business } = await context(productId);
  const { error } = await db.from('product_option_groups')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', groupId).eq('product_id', productId).eq('business_unit_id', business.id);
  if (error) throw new Error(error.message);
  const { error: valueError } = await db.from('product_option_values')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('option_group_id', groupId).eq('business_unit_id', business.id);
  if (valueError) throw new Error(valueError.message);
  refresh(productId);
}

export async function guardarComponentePack(formData: FormData) {
  const productId = String(formData.get('product_id') || '');
  const componentId = String(formData.get('component_id') || '');
  const { db, business } = await context(productId);
  const componentProductId = String(formData.get('component_product_id') || '').trim() || null;
  let componentName = String(formData.get('component_name') || '').trim();

  if (componentProductId) {
    const { data: child, error } = await db.from('productos')
      .select('id,nombre')
      .eq('id', componentProductId)
      .eq('business_unit_id', business.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!child) throw new Error('El producto componente no existe.');
    componentName = String(child.nombre);
  }
  if (!componentName) throw new Error('Indica el componente del pack.');

  const quantity = Number(String(formData.get('quantity') || '1').replace(',', '.'));
  if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('La cantidad del componente debe ser mayor a 0.');
  const weightRaw = String(formData.get('weight_grams') || '').trim();
  const payload = {
    business_unit_id: business.id,
    pack_product_id: productId,
    component_product_id: componentProductId,
    component_name: componentName,
    quantity,
    unit: String(formData.get('unit') || 'unidad').trim() || 'unidad',
    weight_grams: weightRaw ? Number.parseInt(weightRaw, 10) : null,
    sort_order: Number.parseInt(String(formData.get('sort_order') || '10'), 10) || 10,
  };

  if (componentId) {
    const { error } = await db.from('product_pack_components').update(payload)
      .eq('id', componentId).eq('pack_product_id', productId).eq('business_unit_id', business.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await db.from('product_pack_components').insert(payload);
    if (error) throw new Error(error.message);
  }
  refresh(productId);
}

export async function eliminarComponentePack(productId: string, componentId: string) {
  const { db, business } = await context(productId);
  const { error } = await db.from('product_pack_components').delete()
    .eq('id', componentId).eq('pack_product_id', productId).eq('business_unit_id', business.id);
  if (error) throw new Error(error.message);
  refresh(productId);
}
