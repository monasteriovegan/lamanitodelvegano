import Link from 'next/link';
import { SafeStorageImage } from '@/components/media/SafeStorageImage';
import type { PublicCatalogCampaign } from '@/lib/catalog/public-dto';

export function CampaignFeaturedGrid({ products }: {
  products: PublicCatalogCampaign['products'];
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {products.map((product) => {
        const image = product.campaignImageUrl || product.imageUrl;
        const name = product.campaignName || product.name;
        return (
          <Link
            key={product.id}
            href={`/cyber-day-chocolatoso-2026#offer-${product.slug}`}
            className="group overflow-hidden rounded-2xl border border-[#c99942]/35 bg-[#180f09] shadow-[0_8px_32px_rgba(0,0,0,0.45)] transition hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-neon"
          >
            <div className="relative aspect-[4/5] overflow-hidden bg-[#24170e]">
              <SafeStorageImage
                src={image}
                alt={product.campaignAltText || name}
                className="absolute inset-0 h-full w-full object-contain transition duration-500 group-hover:scale-[1.015]"
                fallback={<div className="flex h-full items-center justify-center text-5xl">🍫</div>}
              />
            </div>
            <div className="border-t border-white/10 p-3">
              <p className="line-clamp-2 font-display text-sm font-extrabold text-white">{name}</p>
              <span className="mt-1 block text-[11px] font-bold text-neon">Ver oferta →</span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
