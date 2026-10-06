import Link from 'next/link';
import { SafeStorageImage } from '@/components/media/SafeStorageImage';
import { loadDefaultCatalogCampaign } from '@/lib/catalog/catalog-data';
import { CYBER_TAG } from '@/lib/catalog/cyber-pricing';

export async function Hero() {
  const cyber = await loadDefaultCatalogCampaign(CYBER_TAG);
  if (cyber) return (
    <section className="relative overflow-hidden bg-[#24170e] px-4 py-10 sm:py-16">
      <div className="mx-auto grid max-w-5xl items-center gap-8 md:grid-cols-2">
        <div className="text-center md:text-left">
          <span className="hpill mb-4">🍫 La Manito del Vegano · Makangru</span>
          <h1 className="font-display text-4xl font-extrabold leading-tight text-[#f3d59b] sm:text-6xl">CYBER DAY CHOCOLATOSO</h1>
          <p className="mt-5 text-base leading-7 text-white/85">Chocolatería artesanal, barras rellenas y dulces de cáñamo. Ofertas especiales y <strong>25% de descuento en el resto del catálogo.</strong></p>
          <p className="my-5 font-bold text-[#f3d59b]">📅 Entrega sábado 10 de octubre de 2026</p>
          <Link href="/cyber-day-chocolatoso-2026" className="btnw inline-block">Ver ofertas Cyber 🛒</Link>
        </div>
        <Link href="/cyber-day-chocolatoso-2026" className="mx-auto block w-full max-w-[420px] overflow-hidden rounded-2xl border border-[#c99942]/40">
          <SafeStorageImage src={cyber.bannerImage} alt="Cyber Chocolatoso: dos barras rellenas de 120 g por $17.900" className="h-auto w-full" fallback={null} />
        </Link>
      </div>
    </section>
  );
  const archivedCyber = await loadDefaultCatalogCampaign(CYBER_TAG, 'web', true);
  return (
    <section className="hero relative overflow-hidden text-center">
      {/* Glows animados de fondo */}
      <div className="hero-glow-1" />
      <div className="hero-glow-2" />
      <span className="pointer-events-none absolute text-[120px] opacity-[0.03] -bottom-[15px] -right-2 -rotate-[20deg] z-[1]">
        🌿
      </span>

      <div className="relative z-[2]">
        <SafeStorageImage
          src="/campaigns/especial-fin-de-semana/antojos-veganos-finde.png"
          alt="Antojos veganos para el finde"
          className="absolute inset-0 -z-10 h-full w-full object-cover opacity-45"
          fallback={null}
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-[#102c1b]/70 via-[#102c1b]/80 to-[#06130c]" />
        <span className="hpill mb-3">{archivedCyber ? '🍫 Chocolatería artesanal' : '🌿 Especial de fin de semana'}</span>

        <h1 className="font-display font-extrabold text-[clamp(28px,8vw,48px)] text-white leading-[1.1] mb-3">
          <span className="text-white">{archivedCyber ? 'ANTOJOS VEGANOS ARTESANALES' : 'ANTOJOS VEGANOS PARA EL FINDE'}</span>
        </h1>

        <p className="text-white/75 text-sm leading-relaxed max-w-[600px] mx-auto mb-6">
          <strong className="text-white">DULCE + SALADO</strong><br />
          Proteínas veganas, alfajores y chocolatería artesanal
        </p>

        <div className="flex gap-[7px] justify-center flex-wrap mb-6">
          {['🌱 100% Vegano', '✋ Artesanal', '📅 Programa tus pedidos', '🚚 Delivery a todo stgo'].map((tag) => (
            <span
              key={tag}
              className="htag bg-white/15 text-white px-3 py-[5px] rounded-full text-[11px] border border-white/20 backdrop-blur-sm"
            >
              {tag}
            </span>
          ))}
        </div>

        <div className="hbtns">
          <Link
            href={archivedCyber ? '/#catalogo' : '/especial-fin-de-semana'}
            className="btnw"
          >
            {archivedCyber ? 'Ver catálogo 🛒' : 'Ver especial de fin de semana 🛒'}
          </Link>
          <Link
            href="/nosotros"
            className="btno"
          >
            Nuestra historia ↓
          </Link>
        </div>
      </div>
    </section>
  );
}
