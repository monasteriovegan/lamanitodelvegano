import { loadDefaultCatalogCampaign } from '@/lib/catalog/catalog-data';
import { buildMetaFeedItem, serializeMetaCatalogCsv } from '@/lib/meta/catalog-feed';

export async function GET() {
  const campaign = await loadDefaultCatalogCampaign('fiestas-patrias-2026', 'whatsapp');
  if (!campaign) return new Response('campaign_not_available', { status: 404 });
  const items = campaign.products.flatMap((product) => product.variants
    .filter((variant) => variant.active && Boolean(product.imageUrl || variant.imageUrl))
    .map((variant) => buildMetaFeedItem({
      product: { slug: product.slug, name: product.name, description: product.description, imageUrl: product.imageUrl || variant.imageUrl },
      variant,
    })));
  return new Response(serializeMetaCatalogCsv(items), {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Cache-Control': 'public, max-age=300' },
  });
}
