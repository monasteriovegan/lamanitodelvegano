import { CatalogRepository } from '@/lib/catalog/catalog-repository';
import { toPublicCatalogProduct } from '@/lib/catalog/public-dto';
import { BusinessRepository } from '@/lib/repositories/business-repository';
import { createSupabaseServiceClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const db = createSupabaseServiceClient();
    const business = await new BusinessRepository(db).requireDefault();
    const products = await new CatalogRepository(db).listActive(business.id);
    return Response.json({ products: products.map(toPublicCatalogProduct) });
  } catch {
    return Response.json({ error: 'No se pudo cargar el catálogo.' }, { status: 500 });
  }
}
