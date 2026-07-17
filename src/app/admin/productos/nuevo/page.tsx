import Link from 'next/link';
import { ProductoForm } from '../ProductoForm';

export default function NuevoProductoPage() {
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
