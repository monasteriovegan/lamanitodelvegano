import Link from 'next/link';
import { requireRole } from '@/lib/supabase/require-role';
import { ProductoForm } from '../ProductoForm';

export default async function NuevoProductoPage() {
  await requireRole(['admin', 'bodega']);

  return (
    <div>
      <Link href="/admin/productos" className="text-xs text-neon hover:underline mb-4 inline-block">
        ← Volver a productos
      </Link>
      <h1 className="font-display font-bold text-xl text-white mb-6">+ Nuevo producto</h1>
      <ProductoForm />
    </div>
  );
}
