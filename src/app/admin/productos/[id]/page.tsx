import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { ProductoForm } from '../ProductoForm';
import type { Producto } from '@/types/domain';

export default async function EditarProductoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createSupabaseServiceClient();
  const { data: producto } = await supabase.from('productos').select('*').eq('id', id).maybeSingle();

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
