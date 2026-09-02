import { loadCatalogCampaign } from '@/lib/catalog/catalog-data';
import { toPublicCatalogCampaign } from '@/lib/catalog/public-dto';
import { BusinessRepository } from '@/lib/repositories/business-repository';
import { createSupabaseServiceClient } from '@/lib/supabase/server';

export async function GET(_request: Request, { params }: { params: Promise<{ tag: string }> }) {
  try {
    const { tag } = await params;
    const db = createSupabaseServiceClient();
    const business = await new BusinessRepository(db).requireDefault();
    const campaign = await loadCatalogCampaign(db, business.id, tag, 'web');
    if (!campaign) return Response.json({ error: 'Campaña no encontrada.' }, { status: 404 });
    return Response.json({ campaign: toPublicCatalogCampaign(campaign) });
  } catch {
    return Response.json({ error: 'No se pudo cargar la campaña.' }, { status: 500 });
  }
}
