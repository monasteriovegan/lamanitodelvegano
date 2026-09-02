import { CatalogRepository } from '@/lib/catalog/catalog-repository';
import { toPublicCatalogProduct } from '@/lib/catalog/public-dto';
import { BusinessRepository } from '@/lib/repositories/business-repository';
import { createSupabaseServiceClient } from '@/lib/supabase/server';

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const db = createSupabaseServiceClient();
    const business = await new BusinessRepository(db).requireDefault();
    const product = await new CatalogRepository(db).getBySlug(business.id, slug);
    if (!product) return Response.json({ error: 'Producto no encontrado.' }, { status: 404 });
    return Response.json({ product: toPublicCatalogProduct(product) });
  } catch {
    return Response.json({ error: 'No se pudo cargar el producto.' }, { status: 500 });
  }
}
