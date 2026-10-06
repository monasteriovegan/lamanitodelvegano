import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SiteShell } from '@/components/layout/SiteShell';
import { CampaignCatalog } from '@/components/tienda/CampaignCatalog';
import { loadDefaultCatalogCampaign } from '@/lib/catalog/catalog-data';
import { toPublicCatalogCampaign } from '@/lib/catalog/public-dto';
import { CYBER_TAG } from '@/lib/catalog/cyber-pricing';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Cyber Day Chocolatoso — La Manito del Vegano',
  description: 'Ofertas en barras, bombones, trufas y alfajores. 25% de descuento en el resto del catálogo. Entrega sábado 10 de octubre de 2026.',
  alternates: { canonical: '/cyber-day-chocolatoso-2026' },
};
export default async function CyberPage() {
  const campaign = await loadDefaultCatalogCampaign(CYBER_TAG);
  if (!campaign) notFound();
  const dto = toPublicCatalogCampaign(campaign);
  const visibleProducts = dto.products.filter((product) => product.presentationSlot !== 'target_only');
  const heroOffer = { ...dto, products: visibleProducts.filter((product) => product.presentationSlot === 'hero_offer') };
  const featured = { ...dto, products: visibleProducts.filter((product) => product.presentationSlot === 'featured') };
  const catalog = { ...dto, products: visibleProducts.filter((product) => product.presentationSlot === 'catalog') };
  return (
    <SiteShell>
      <main className="min-h-screen bg-[#180f09] px-4 pb-16 pt-24">
        <section className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-3xl py-8 text-center">
            <span className="pill">🍫 La Manito del Vegano · Makangru</span>
            <h1 className="mt-4 break-words font-display text-3xl font-extrabold text-[#f3d59b] sm:text-6xl">Cyber Day Chocolatoso</h1>
            <p className="mt-4 text-lg font-bold text-white">Entrega sábado 10 de octubre de 2026</p>
            <p className="mt-3 text-sm leading-7 text-white/75">Elige tus sabores y formatos. Los precios Cyber se aplican automáticamente en el carrito.</p>
          </div>
          {heroOffer.products.length > 0 && <section aria-labelledby="oferta-principal-cyber">
            <h2 id="oferta-principal-cyber" className="mb-5 font-display text-3xl font-extrabold text-[#f3d59b]">Oferta principal</h2>
            <CampaignCatalog campaign={heroOffer} />
          </section>}
          {featured.products.length > 0 && <section className="mt-12" aria-labelledby="destacados-cyber">
            <h2 id="destacados-cyber" className="mb-5 font-display text-3xl font-extrabold text-[#f3d59b]">Destacados Cyber Chocolatoso</h2>
            <CampaignCatalog campaign={featured} />
          </section>}
          {catalog.products.length > 0 && <section className="mt-12">
            <h2 className="mb-4 font-display text-3xl font-extrabold text-[#f3d59b]">25% de descuento en el resto del catálogo</h2>
            <p className="mb-6 text-sm text-white/70">Descuento automático sobre el precio vigente. Las ofertas especiales mantienen el valor publicado en los flyers.</p>
            <CampaignCatalog campaign={catalog} />
          </section>}
        </section>
      </main>
    </SiteShell>
  );
}
