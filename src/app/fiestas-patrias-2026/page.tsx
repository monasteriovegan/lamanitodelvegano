import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { SiteShell } from '@/components/layout/SiteShell';
import { CampaignCatalog } from '@/components/tienda/CampaignCatalog';
import { loadDefaultCatalogCampaign } from '@/lib/catalog/catalog-data';
import { toPublicCatalogCampaign } from '@/lib/catalog/public-dto';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Fiestas Patrias 2026 — Promociones veganas',
  description: 'Empanadas, packs parrilleros, postres, seitán y Le Kostilles veganas por encargo para este 18.',
  alternates: { canonical: '/fiestas-patrias-2026' },
};

export default async function FiestasPatriasPage() {
  const campaign = await loadDefaultCatalogCampaign('fiestas-patrias-2026', 'web');
  if (!campaign) notFound();
  const dto = toPublicCatalogCampaign(campaign);

  return (
    <SiteShell>
      <main className="min-h-screen bg-[#030907] pb-16 pt-20">
        <section className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
          <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#0a1b13] shadow-[0_24px_90px_rgba(0,0,0,0.4)]">
            {dto.bannerImage && <Image src={dto.bannerImage} alt="Fiestas Patrias 2026 de La Manito del Vegano" width={1402} height={1122} priority className="h-auto w-full" />}
          </div>
          <div className="mx-auto max-w-3xl py-9 text-center">
            <span className="pill">🇨🇱 {dto.badgeText || dto.name}</span>
            <h1 className="mt-4 font-display text-3xl font-extrabold text-white sm:text-5xl">Sabores veganos para compartir este 18</h1>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-white/65 sm:text-base">{dto.description}</p>
            <p className="mt-3 text-sm font-bold text-neon">Entregas por encargo: 12, 15 y 16 de septiembre</p>
          </div>
          <CampaignCatalog campaign={dto} />
        </section>
      </main>
    </SiteShell>
  );
}
