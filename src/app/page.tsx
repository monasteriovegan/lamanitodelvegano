import { SiteShell } from '@/components/layout/SiteShell';
import { Hero } from '@/components/layout/Hero';
import { CatalogoGrid } from '@/components/tienda/CatalogoGrid';
import { CampaignFeaturedGrid } from '@/components/tienda/CampaignFeaturedGrid';
import { PromoEspecial } from '@/components/tienda/PromoEspecial';
import { getProductosActivos, getZonas, getAjustesPublicos } from '@/lib/data/catalogo';
import { publicCatalogCategories } from '@/lib/catalog/public-categories';
import { loadDefaultCatalogCampaign } from '@/lib/catalog/catalog-data';
import { toPublicCatalogCampaign } from '@/lib/catalog/public-dto';
import { CYBER_TAG } from '@/lib/catalog/cyber-pricing';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const [productos, zonas, ajustes, cyber] = await Promise.all([
    getProductosActivos(),
    getZonas(),
    getAjustesPublicos(),
    loadDefaultCatalogCampaign(CYBER_TAG),
  ]);

  const categorias = publicCatalogCategories(productos);
  const cyberDto = cyber ? toPublicCatalogCampaign(cyber) : null;
  const destacados = cyberDto?.products.filter((product) => product.presentationSlot === 'featured') || [];

  return (
    <SiteShell>
      <main>
        <Hero />

        {!cyber && ajustes?.data && (
          <PromoEspecial ajustes={ajustes.data} productos={productos} />
        )}

        {destacados.length > 0 && (
          <section className="px-4 py-6">
            <h2 className="font-display font-extrabold text-xl text-white mb-4 flex items-center gap-2">
              ⭐ Destacados &amp; Ofertas
            </h2>
            <CampaignFeaturedGrid products={destacados} />
          </section>
        )}

        <CatalogoGrid productos={productos} categorias={categorias} />

        <p className="sec font-display font-extrabold text-xl text-white px-4 pt-8 pb-3">💬 Lo que dicen nuestros clientes</p>
        <div className="reswrap">
          <div className="res">
            <div className="ress">★★★★★</div>
            <div className="rest">“Las empanadas de soya son increíbles. No puedo creer que sean veganas, están mejor que las de carne que comía antes.”</div>
            <div className="resa">
              <div className="w-[30px] h-[30px] rounded-full bg-gradient-to-br from-[#40916c] to-[#52b788] flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0">VM</div>
              Valentina M. · Santiago
              <span className="ml-auto bg-[#e8f5e9]/10 text-neon text-[9px] px-1.5 py-0.5 rounded-full font-bold">✓ Verificado</span>
            </div>
          </div>
          <div className="res">
            <div className="ress">★★★★★</div>
            <div className="rest">“El manjar de cáñamo es lo mejor que he probado. Único en Chile, lo comparto con toda la familia y todos quedan sorprendidos.”</div>
            <div className="resa">
              <div className="w-[30px] h-[30px] rounded-full bg-gradient-to-br from-[#2d6a4f] to-[#40916c] flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0">RP</div>
              Rodrigo P. · Pucón
              <span className="ml-auto bg-[#e8f5e9]/10 text-neon text-[9px] px-1.5 py-0.5 rounded-full font-bold">✓ Verificado</span>
            </div>
          </div>
          <div className="res">
            <div className="ress">★★★★★</div>
            <div className="rest">“El pie de arándanos es una obra de arte. Se nota el amor con el que lo elaboran, volvería a pedir mil veces más.”</div>
            <div className="resa">
              <div className="w-[30px] h-[30px] rounded-full bg-gradient-to-br from-[#52b788] to-[#74c69d] flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0">CR</div>
              Camila R. · Providencia
              <span className="ml-auto bg-[#e8f5e9]/10 text-neon text-[9px] px-1.5 py-0.5 rounded-full font-bold">✓ Verificado</span>
            </div>
          </div>
          <div className="res">
            <div className="ress">★★★★★</div>
            <div className="rest">“Super puntual el despacho y la presentación es hermosa. Se nota el amor y conciencia en cada detalle.”</div>
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
