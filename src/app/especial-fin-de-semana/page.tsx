import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SiteShell } from '@/components/layout/SiteShell';
import { CampaignCatalog } from '@/components/tienda/CampaignCatalog';
import { loadDefaultCatalogCampaign } from '@/lib/catalog/catalog-data';
import { toPublicCatalogCampaign } from '@/lib/catalog/public-dto';
import { SafeStorageImage } from '@/components/media/SafeStorageImage';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Antojos veganos para el finde — La Manito del Vegano',
  description: 'Proteínas veganas, alfajores y chocolatería artesanal: dulce + salado para disfrutar el fin de semana.',
  alternates: { canonical: '/especial-fin-de-semana' },
};

export default async function EspecialFinDeSemanaPage() {
  const campaign = await loadDefaultCatalogCampaign('especial-fin-de-semana', 'web');
  if (!campaign) notFound();
  const dto = toPublicCatalogCampaign(campaign);

  return (
    <SiteShell>
      <main className="min-h-screen bg-[#030907] pb-16 pt-20">
        <section className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
          <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#0a1b13] shadow-[0_24px_90px_rgba(0,0,0,0.4)]">
            <SafeStorageImage
              src={dto.bannerImage}
              alt="Antojos veganos para el finde"
              className="h-auto w-full"
              fallback={<div className="flex min-h-52 items-center justify-center bg-[#132d22] text-6xl">🌱</div>}
            />
          </div>
          <div className="mx-auto max-w-3xl py-9 text-center">
            <span className="pill">🌿 {dto.badgeText || dto.name}</span>
            <h1 className="mt-4 font-display text-3xl font-extrabold text-white sm:text-5xl">Antojos veganos para el finde</h1>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-white/65 sm:text-base">Dulce + salado: proteínas veganas, alfajores y chocolatería artesanal para compartir.</p>
          </div>
          <CampaignCatalog campaign={dto} />
        </section>
      </main>
    </SiteShell>
  );
}
