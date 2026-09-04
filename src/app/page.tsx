import Link from 'next/link';
import { SiteShell } from '@/components/layout/SiteShell';
import { Hero } from '@/components/layout/Hero';
import { CatalogoGrid } from '@/components/tienda/CatalogoGrid';
import { PromoEspecial } from '@/components/tienda/PromoEspecial';
import { getProductosActivos, getCategorias, getZonas, getAjustesPublicos } from '@/lib/data/catalogo';
import { loadDefaultCatalogCampaign } from '@/lib/catalog/catalog-data';
import { formatPriceSummary } from '@/lib/catalog/price-summary';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const [productos, categorias, zonas, ajustes, fiestasPatrias] = await Promise.all([
    getProductosActivos(),
    getCategorias(),
    getZonas(),
    getAjustesPublicos(),
    loadDefaultCatalogCampaign('fiestas-patrias-2026', 'web'),
  ]);

  const destacados = productos.filter((p) => p.destacado);

  return (
    <SiteShell>
      <main>
        <Hero />

        {fiestasPatrias && (
          <section className="px-4 py-6">
            <Link href="/fiestas-patrias-2026" className="group mx-auto grid max-w-5xl overflow-hidden rounded-3xl border border-white/10 bg-[#0a1b13] shadow-[0_18px_70px_rgba(0,0,0,0.35)] md:grid-cols-[1.15fr_0.85fr]">
              {fiestasPatrias.bannerImage && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={fiestasPatrias.bannerImage} alt="Fiestas Patrias 2026" className="h-full min-h-[240px] w-full object-cover" />
              )}
              <div className="flex flex-col justify-center p-7 sm:p-10">
                <span className="text-xs font-bold uppercase tracking-[0.2em] text-neon">🇨🇱 Solo por encargo</span>
                <h2 className="mt-3 font-display text-3xl font-extrabold text-white">Fiestas Patrias 2026</h2>
                <p className="mt-3 text-sm leading-6 text-white/65">Empanadas, parrilla y postres 100% veganos. Elige formatos y sabores desde el catálogo oficial.</p>
                <span className="mt-6 inline-flex w-fit rounded-full bg-neon px-5 py-3 text-sm font-extrabold text-[#020705] transition group-hover:bg-white">Ver las promociones →</span>
              </div>
            </Link>
          </section>
        )}

        {ajustes?.data && (
          <PromoEspecial ajustes={ajustes.data} productos={productos} />
        )}

        {destacados.length > 0 && (
          <section className="px-4 py-6">
            <h2 className="font-display font-extrabold text-xl text-white mb-4 flex items-center gap-2">
              ⭐ Destacados &amp; Ofertas
            </h2>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
              {destacados.map((p) => {
                const priceSummary = formatPriceSummary(p);
                return (
                  <Link
                    key={p.id}
                    href={`/productos/${p.slug}`}
                    className="rounded-2xl overflow-hidden relative border border-[rgba(0,255,179,0.2)] shadow-[0_8px_32px_rgba(0,0,0,0.5)] transition-transform hover:-translate-y-1.5 focus:outline-none focus:ring-2 focus:ring-neon"
                    style={{ background: p.color_fondo || '#1B4332' }}
                  >
                    <div className="h-[180px] flex items-center justify-center text-6xl relative">
                      {p.imagen_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.imagen_url} alt={p.nombre} className="absolute inset-0 w-full h-full object-cover" />
                      ) : (
                        p.emoji
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-[rgba(3,9,7,0.97)] via-[rgba(3,9,7,0.4)] to-transparent flex flex-col justify-end p-3.5">
                        <p className="font-display font-bold text-base text-white mb-0.5">{p.nombre}</p>
                        <div className="mb-2">
                          <p className="text-sm text-neon font-bold">{priceSummary.formattedDisplayPrice}</p>
                          {priceSummary.formattedOriginalPrice && <p className="text-[10px] text-white/45 line-through">{priceSummary.formattedOriginalPrice}</p>}
                          {priceSummary.packSummary && <p className="mt-0.5 text-[10px] font-bold text-neon/90">🔥 {priceSummary.packSummary}</p>}
                        </div>
                        <span className="text-[11px] text-white/80 font-semibold">Ver producto</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        <CatalogoGrid productos={productos} categorias={categorias} />

        <p className="sec font-display font-extrabold text-xl text-white px-4 pt-8 pb-3">💬 Lo que dicen nuestros clientes</p>
        <div className="reswrap">
          <div className="res">
            <div className="ress">★★★★★</div>
            <div className="rest">"Las empanadas de soya son increíbles. No puedo creer que sean veganas, están mejor que las de carne que comía antes."</div>
            <div className="resa">
              <div className="w-[30px] h-[30px] rounded-full bg-gradient-to-br from-[#40916c] to-[#52b788] flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0">VM</div>
              Valentina M. · Santiago
              <span className="ml-auto bg-[#e8f5e9]/10 text-neon text-[9px] px-1.5 py-0.5 rounded-full font-bold">✓ Verificado</span>
            </div>
          </div>
          <div className="res">
            <div className="ress">★★★★★</div>
            <div className="rest">"El manjar de cáñamo es lo mejor que he probado. Único en Chile, lo comparto con toda la familia y todos quedan sorprendidos."</div>
            <div className="resa">
              <div className="w-[30px] h-[30px] rounded-full bg-gradient-to-br from-[#2d6a4f] to-[#40916c] flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0">RP</div>
              Rodrigo P. · Pucón
              <span className="ml-auto bg-[#e8f5e9]/10 text-neon text-[9px] px-1.5 py-0.5 rounded-full font-bold">✓ Verificado</span>
            </div>
          </div>
          <div className="res">
            <div className="ress">★★★★★</div>
            <div className="rest">"El pie de arándanos es una obra de arte. Se nota el amor con el que lo elaboran, volvería a pedir mil veces más."</div>
            <div className="resa">
              <div className="w-[30px] h-[30px] rounded-full bg-gradient-to-br from-[#52b788] to-[#74c69d] flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0">CR</div>
              Camila R. · Providencia
              <span className="ml-auto bg-[#e8f5e9]/10 text-neon text-[9px] px-1.5 py-0.5 rounded-full font-bold">✓ Verificado</span>
            </div>
          </div>
          <div className="res">
            <div className="ress">★★★★★</div>
            <div className="rest">"Super puntual el despacho y la presentación es hermosa. Se nota el amor y conciencia en cada detalle."</div>
            <div className="resa">
              <div className="w-[30px] h-[30px] rounded-full bg-gradient-to-br from-[#1b4332] to-[#2d6a4f] flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0">FA</div>
              Felipe A. · Ñuñoa
              <span className="ml-auto bg-[#e8f5e9]/10 text-neon text-[9px] px-1.5 py-0.5 rounded-full font-bold">✓ Verificado</span>
            </div>
          </div>
        </div>

        <p className="sec font-display font-extrabold text-xl text-white px-4 pt-8 pb-3">📦 Info importante</p>
        <div className="infog">
          <div className="ic"><div className="ii">⏰</div><div className="it">Programa tu pedido</div><div className="id">Mínimo 3 días para tu pedido</div></div>
          <div className="ic"><div className="ii">🚚</div><div className="it">Delivery a todo Santiago</div><div className="id">Todo Santiago y Pucón con tarifas fijas</div></div>
          <div className="ic"><div className="ii">💳</div><div className="it">Pagos</div><div className="id">Transferencia o Mercado Pago</div></div>
          <div className="ic"><div className="ii">🌱</div><div className="it">Sin crueldad</div><div className="id">100% ingredientes vegetales</div></div>
        </div>

        {zonas.length > 0 && (
          <section className="px-4 mb-4">
            <div className="bg-white/[0.04] border border-[rgba(0,255,179,0.15)] rounded-2xl p-4">
              <h3 className="font-display font-bold text-base text-white mb-2.5">🚚 Zonas de despacho</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {zonas.map((z) => (
                  <div key={z.id} className="bg-white/5 rounded-lg px-3 py-2 flex justify-between items-center border border-[rgba(0,255,179,0.08)]">
                    <div>
                      <p className="text-[11px] font-semibold text-texto">{z.nombre}</p>
                      <p className="text-[9px] text-muted">{z.comunas}</p>
                    </div>
                    <span className="text-[13px] text-neon font-bold">${z.precio.toLocaleString('es-CL')}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>
    </SiteShell>
  );
}
