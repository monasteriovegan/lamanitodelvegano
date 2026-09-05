import Link from 'next/link';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/supabase/require-role';
import ManualOrderForm from './ManualOrderForm';

export const dynamic = 'force-dynamic';

const BUSINESS_UNIT_ID = 'f3b57ce7-0796-40e5-94f1-07cb2b48ba85';

function activeOptionLabels(product: any, prefix = ''): string[] {
  const groups = Array.isArray(product?.product_option_groups) ? product.product_option_groups : [];
  return groups
    .filter((group: any) => group?.is_active !== false)
    .flatMap((group: any) => (Array.isArray(group?.product_option_values) ? group.product_option_values : [])
      .filter((value: any) => value?.is_active !== false)
      .map((value: any) => `${prefix}${group.name}: ${value.label}`));
}

export default async function NuevoPedidoPage() {
  await requireRole(['admin', 'soporte']);
  const db = createSupabaseServiceClient();
  const [{ data: products, error: productError }, { data: customers, error: customerError }] = await Promise.all([
    db.from('productos')
      .select('id,nombre,precio,gramaje,variedades,maneja_stock,stock,product_option_groups(*,product_option_values(*)),product_pack_components:product_pack_components!product_pack_components_pack_product_id_business_unit_id_fkey(*)')
      .eq('business_unit_id', BUSINESS_UNIT_ID)
      .eq('activo', true)
      .order('nombre'),
    db.from('omnichannel_contacts')
      .select('id,nombre,display_name,phone,email,direccion,metadata')
      .eq('business_unit_id', BUSINESS_UNIT_ID)
      .order('updated_at', { ascending: false })
      .limit(150),
  ]);
  if (productError) throw productError;
  if (customerError) throw customerError;

  const productRows = (products || []) as any[];
  const byId = new Map(productRows.map((row) => [String(row.id), row]));
  const manualProducts = productRows.map((row) => {
    const ownOptions = activeOptionLabels(row);
    const inheritedOptions = (Array.isArray(row.product_pack_components) ? row.product_pack_components : []).flatMap((component: any) => {
      const child = component?.component_product_id ? byId.get(String(component.component_product_id)) : null;
      return child ? activeOptionLabels(child, `${component.component_name} · `) : [];
    });
    return {
      id: row.id,
      nombre: row.nombre,
      precio: Number(row.precio || 0),
      gramaje: row.gramaje,
      variedades: row.variedades,
      maneja_stock: row.maneja_stock,
      stock: row.stock == null ? null : Number(row.stock),
      orderOptions: Array.from(new Set([...ownOptions, ...inheritedOptions])),
    };
  });

  return (
    <div className="max-w-[1100px] w-full">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <p className="text-[11px] tracking-[4px] text-neon uppercase font-display mb-1">✦ Gestión Comercial</p>
          <h1 className="font-display font-bold text-3xl text-white">Nuevo pedido manual</h1>
          <p className="text-sm text-muted mt-1">Quedará en el mismo sistema de ventas, CRM, stock e impresión que Web, Instagram y WhatsApp.</p>
        </div>
        <Link href="/admin/pedidos" className="border border-white/10 px-4 py-2 rounded-lg text-sm text-white hover:border-neon/40">← Pedidos</Link>
      </div>
      <ManualOrderForm products={manualProducts} customers={(customers || []) as any} />
    </div>
  );
}
