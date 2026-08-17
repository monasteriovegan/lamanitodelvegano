import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/supabase/require-role';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { BusinessRepository } from '@/lib/repositories/business-repository';
import { ProductoForm } from '../ProductoForm';
import type { Producto } from '@/types/domain';

export default async function EditarProductoPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(['admin', 'bodega']);
  const { id } = await params;
  const supabase = createSupabaseServiceClient();
  const business = await new BusinessRepository(supabase).requireDefault();
  const { data: producto } = await supabase
    .from('productos')
    .select('*')
    .eq('id', id)
    .eq('business_unit_id', business.id)
    .maybeSingle();

  if (!producto) notFound();

  return (
    <div>
      <Link href="/admin/productos" className="text-xs text-neon hover:underline mb-4 inline-block">
        ← Volver a productos
      </Link>
      <h1 className="font-display font-bold text-xl text-white mb-6">Editar producto</h1>
      <ProductoForm producto={producto as Producto} />
    </div>
  );
}
