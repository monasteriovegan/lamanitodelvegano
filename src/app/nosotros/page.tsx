import { SiteShell } from '@/components/layout/SiteShell';

export default function NosotrosPage() {
  return (
    <SiteShell>
      <main className="pt-[100px] px-4 pb-16 max-w-[800px] mx-auto">
        <div className="text-center mb-10">
          <span className="pill mb-3">🌱 Nuestra Historia</span>
          <h1 className="font-display font-extrabold text-3xl md:text-4xl text-white mb-4 leading-tight">
            Más que comida — es un acto de{' '}
            <em className="text-[#B7E4C7] not-italic" style={{ fontStyle: 'italic', textShadow: '0 0 20px rgba(183,228,199,0.3)' }}>
              amor y revolución vegetal
            </em>
          </h1>
          <p className="text-sm text-white/70">Santiago y Pucón · Chile</p>
        </div>

        <div className="prose prose-invert max-w-none text-white/80 leading-relaxed text-sm flex flex-col gap-6 mb-12">
          <section>
            <h2 className="font-display font-bold text-lg text-neon mb-3">De una pequeña cocina a un movimiento plant based 🌿</h2>
            <p>
              Hubo un tiempo donde se creía que ser vegano significaba renunciar al sabor de nuestras tradiciones. <strong>La Manito Del Vegano</strong> nació para desafiar esa creencia. Todo comenzó en una pequeña cocina en Santiago, con las manos manchadas de harina y el corazón puesto en crear una alternativa ética que mantuviera la esencia de la comida casera chilena.
            </p>
            <p className="mt-3">
              Nos obsesionamos con una idea: demostrar que la cocina vegana puede ser <strong>tan cremosa, tan sabrosa y tan reconfortante</strong> como la comida tradicional. Y lo logramos.
            </p>
          </section>

          <section>
            <h2 className="font-display font-bold text-lg text-neon mb-3">El cáñamo: nuestro ingrediente estrella 🌱</h2>
            <p>
              Nuestra mayor revolución llegó con la <strong>semilla de cáñamo</strong>. Después de meses de investigación, pruebas y errores, desarrollamos el <strong>primer manjar de semilla de cáñamo de todo Chile</strong>: una receta 100% libre de crueldad, cremosísima y con un perfil nutricional excepcional.
            </p>
            <p className="mt-3">
              ¿Por qué el cáñamo? Porque es un <strong>superalimento completo</strong>: contiene los 9 aminoácidos esenciales (proteína completa), es rico en Omega 3 y Omega 6 en proporción ideal, aporta fibra, hierro, zinc, magnesio y vitamina E. Incorporamos el cáñamo en muchos de nuestros productos: desde nuestro icónico manjar hasta masas, rellenos y bases de pies.
            </p>
          </section>

          <section>
            <h2 className="font-display font-bold text-lg text-neon mb-3">Nuestro taller y filosofía de trabajo 🍞</h2>
            <p>
              Todo lo que hacemos es <strong>100% artesanal y por pedido anticipado</strong>. No trabajamos con producción industrial: cada empanada se arma a mano, cada pie se hornea con cariño y cada manjar se cocina en pequeñas tandas para garantizar la máxima frescura y calidad.
            </p>
            <p className="mt-3">
              Nuestro taller opera en <strong>Santiago y Pucón</strong>, y despachamos con logística propia para asegurar que tu pedido llegue en perfectas condiciones. Desde empanadas de pino de soya hasta pies de arándanos con base de cáñamo, cada producto cuenta una historia de consciencia y sabor.
            </p>
          </section>

          <section>
            <h2 className="font-display font-bold text-lg text-neon mb-3">Nuestros productos 🥟</h2>
            <p>
              Nuestra carta incluye una variedad que demuestra que lo vegano no tiene límites:
            </p>
            <ul className="list-disc pl-5 mt-2 flex flex-col gap-1">
              <li><strong>Empanadas veganas</strong> — Pino de soya, champiñón-queso vegano, y ediciones especiales de temporada.</li>
              <li><strong>Pies artesanales</strong> — Arándanos, frambuesa, manzana-canela, todos con bases enriquecidas con semilla de cáñamo.</li>
              <li><strong>Manjares de cáñamo</strong> — Nuestro producto insignia, disponible en formato individual y familiar.</li>
              <li><strong>Packs especiales</strong> — Combos pensados para compartir, regalar o disfrutar toda la semana.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display font-bold text-lg text-neon mb-3">Lo que nos mueve 💚</h2>
            <p>
              Creemos que la revolución comienza en nuestro plato. Cada producto que elaboramos es un acto de amor hacia los animales, hacia nuestro planeta y hacia ti. No se trata solo de alimentar el cuerpo — se trata de <strong>nutrir la consciencia</strong>. 🌱
            </p>
          </section>
        </div>

        {/* VALORES GRID */}
        <h2 className="font-display font-bold text-xl text-center text-white mb-6">🌿 Nuestros Valores</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          <div className="bg-[#0d1e16] border border-[rgba(0,255,179,0.2)] rounded-2xl p-5 text-center shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
            <div className="text-3xl mb-2">🌱</div>
            <h3 className="font-display font-bold text-sm text-neon mb-1">100% Plant Based</h3>
            <p className="text-[11px] text-white/70 leading-normal">Cero ingredientes de origen animal en absolutamente todo.</p>
          </div>
          <div className="bg-[#0d1e16] border border-[rgba(0,255,179,0.2)] rounded-2xl p-5 text-center shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
            <div className="text-3xl mb-2">✋</div>
            <h3 className="font-display font-bold text-sm text-neon mb-1">Artesanal por pedido</h3>
            <p className="text-[11px] text-white/70 leading-normal">Cada producto se elabora fresco y a mano.</p>
          </div>
          <div className="bg-[#0d1e16] border border-[rgba(0,255,179,0.2)] rounded-2xl p-5 text-center shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
            <div className="text-3xl mb-2">🌿</div>
            <h3 className="font-display font-bold text-sm text-neon mb-1">Cáñamo nutritivo</h3>
            <p className="text-[11px] text-white/70 leading-normal">Superalimento con proteína completa y Omegas.</p>
          </div>
          <div className="bg-[#0d1e16] border border-[rgba(0,255,179,0.2)] rounded-2xl p-5 text-center shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
            <div className="text-3xl mb-2">🚚</div>
            <h3 className="font-display font-bold text-sm text-neon mb-1">Delivery a todo Santiago</h3>
            <p className="text-[11px] text-white/70 leading-normal">Santiago y Pucón con logística directa.</p>
          </div>
          <div className="bg-[#0d1e16] border border-[rgba(0,255,179,0.2)] rounded-2xl p-5 text-center shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
            <div className="text-3xl mb-2">🌍</div>
            <h3 className="font-display font-bold text-sm text-neon mb-1">Consciente</h3>
            <p className="text-[11px] text-white/70 leading-normal">Respeto profundo por los animales y el planeta.</p>
          </div>
          <div className="bg-[#0d1e16] border border-[rgba(0,255,179,0.2)] rounded-2xl p-5 text-center shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
            <div className="text-3xl mb-2">💚</div>
            <h3 className="font-display font-bold text-sm text-neon mb-1">Con propósito</h3>
            <p className="text-[11px] text-white/70 leading-normal">Cada bocado tiene una historia de amor.</p>
          </div>
        </div>
      </main>
    </SiteShell>
  );
}
