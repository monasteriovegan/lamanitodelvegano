import type { PublicCatalogCampaign } from '@/lib/catalog/public-dto';
import { CampaignProductCard } from './CampaignProductCard';
import { CampaignTargetCard } from './CampaignTargetCard';

export function CampaignCatalog({ campaign }: { campaign: PublicCatalogCampaign }) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      {campaign.products.map((product) => (
        <div key={product.id} id={`offer-${product.slug}`}>
          {product.purchaseTargets.length > 0
            ? <CampaignTargetCard product={product} campaignTag={campaign.campaignTag} />
            : <CampaignProductCard product={product} campaignTag={campaign.campaignTag} />}
        </div>
      ))}
    </div>
  );
}
