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
  const offers = { ...dto, products: dto.products.filter((p) => p.featured) };
  const rest = { ...dto, products: dto.products.filter((p) => !p.featured) };
  return (
    <SiteShell>
      <main className="min-h-screen bg-[#180f09] px-4 pb-16 pt-24">
        <section className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-3xl py-8 text-center">
            <span className="pill">🍫 La Manito del Vegano · Makangru</span>
            <h1 className="mt-4 font-display text-4xl font-extrabold text-[#f3d59b] sm:text-6xl">Cyber Day Chocolatoso</h1>
            <p className="mt-4 text-lg font-bold text-white">Entrega sábado 10 de octubre de 2026</p>
            <p className="mt-3 text-sm leading-7 text-white/75">Elige tus sabores y formatos. Los precios Cyber se aplican automáticamente en el carrito.</p>
          </div>
          <CampaignCatalog campaign={offers} />
          {rest.products.length > 0 && <section className="mt-12">
            <h2 className="mb-4 font-display text-3xl font-extrabold text-[#f3d59b]">25% de descuento en el resto del catálogo</h2>
            <p className="mb-6 text-sm text-white/70">Descuento automático sobre el precio vigente. Las ofertas especiales mantienen el valor publicado en los flyers.</p>
            <CampaignCatalog campaign={rest} />
          </section>}
        </section>
      </main>
    </SiteShell>
  );
}
