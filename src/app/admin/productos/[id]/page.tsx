import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/supabase/require-role';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { BusinessRepository } from '@/lib/repositories/business-repository';
import { ProductoForm } from '../ProductoForm';
import { ProductStructureEditor } from '../ProductStructureEditor';
import type { Producto } from '@/types/domain';

export default async function EditarProductoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  await requireRole(['admin', 'bodega']);
  const { id } = await params;
  const { saved } = await searchParams;
  const supabase = createSupabaseServiceClient();
  const business = await new BusinessRepository(supabase).requireDefault();

  const [{ data: producto }, { data: catalogProducts, error: catalogError }] = await Promise.all([
    supabase
      .from('productos')
      .select('*, product_variants(*), product_option_groups(*, product_option_values(*)), product_pack_components:product_pack_components!product_pack_components_pack_product_id_business_unit_id_fkey(*)')
      .eq('id', id)
      .eq('business_unit_id', business.id)
      .maybeSingle(),
    supabase
      .from('productos')
      .select('id,nombre,product_option_groups(*,product_option_values(*))')
      .eq('business_unit_id', business.id)
      .eq('activo', true)
      .order('nombre'),
  ]);

  if (catalogError) throw catalogError;
  if (!producto) notFound();

  const variants = Array.isArray((producto as any).product_variants) ? (producto as any).product_variants : [];
  const optionGroups = Array.isArray((producto as any).product_option_groups) ? (producto as any).product_option_groups : [];
  const packComponents = Array.isArray((producto as any).product_pack_components) ? (producto as any).product_pack_components : [];

  return (
    <div>
      <Link href="/admin/productos" className="text-xs text-neon hover:underline mb-4 inline-block">
        ← Volver a productos
      </Link>
      <h1 className="font-display font-bold text-xl text-white mb-4">Editar producto</h1>
      {saved === '1' && (
        <div className="mb-5 rounded-xl border border-neon/30 bg-neon/10 px-4 py-3 text-sm font-semibold text-neon" role="status">
          ✓ Cambios guardados correctamente. Ya puedes salir de esta página.
        </div>
      )}
      <ProductoForm
        producto={producto as unknown as Producto}
        variants={variants}
        optionGroups={optionGroups}
        packComponents={packComponents}
      />
      <ProductStructureEditor
        productId={id}
        optionGroups={optionGroups}
        packComponents={packComponents}
        catalogProducts={(catalogProducts || []) as any}
      />
    </div>
  );
}
