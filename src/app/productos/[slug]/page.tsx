import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SiteShell } from '@/components/layout/SiteShell';
import { VistaProducto } from './VistaProducto';
import { getProductoBySlug } from '@/lib/data/catalogo';

export const dynamic = 'force-dynamic';

/**
 * Metadata real (título, descripción, imagen Open Graph) por producto —
 * esto es lo que hace que un anuncio de Meta/Google o un link compartido
 * en WhatsApp muestre la foto y el nombre del producto en vez de la
 * portada genérica del sitio.
 */
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const producto = await getProductoBySlug(slug);
  if (!producto) return { title: 'Producto no encontrado' };

  const titulo = `${producto.nombre} — La Manito Del Vegano`;
  const descripcion = producto.descripcion || 'Comida vegana artesanal en Santiago y Pucón.';

  return {
    title: titulo,
    description: descripcion,
    openGraph: {
      title: titulo,
      description: descripcion,
      images: producto.imagen_url ? [{ url: producto.imagen_url }] : undefined,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: titulo,
      description: descripcion,
      images: producto.imagen_url ? [producto.imagen_url] : undefined,
    },
  };
}

export default async function ProductoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const producto = await getProductoBySlug(slug);
  if (!producto) notFound();

  return (
    <SiteShell>
      <VistaProducto producto={producto} />
    </SiteShell>
  );
}
