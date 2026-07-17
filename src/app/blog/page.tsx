'use client';

import { useState } from 'react';
import { SiteShell } from '@/components/layout/SiteShell';

const BLOG_POSTS = [
  {
    emoji: '🌿',
    cat: 'Nutrición',
    title: '¿Por qué la semilla de cáñamo es el superalimento que necesitas?',
    ex: 'Rica en proteína completa, Omega 3 y 6. Descubre por qué la integramos en casi todo lo que hacemos.',
    content: (
      <>
        <p className="mb-3">
          La <strong className="text-neon">semilla de cáñamo</strong> (hemp seed) es considerada uno de los superalimentos más completos del planeta. A diferencia de otras proteínas vegetales, el cáñamo contiene los <strong className="text-white">9 aminoácidos esenciales</strong>, lo que la convierte en una fuente de proteína completa — algo poco común en el reino vegetal.
        </p>
        <p className="mb-3">
          🧬 <strong>Perfil nutricional por cada 30g:</strong>
          <br />
          • Proteína: 10g de proteína completa
          <br />
          • Omega 3 (ALA): 2.6g — antiinflamatorio natural
          <br />
          • Omega 6 (GLA): 0.9g — salud hormonal y piel
          <br />
          • Fibra: 1.2g — digestión saludable
          <br />
          • Hierro: 15% del valor diario
          <br />
          • Magnesio: 45% del valor diario
          <br />
          • Zinc: 20% del valor diario
          <br />• Vitamina E: potente antioxidante
        </p>
        <p className="mb-3">
          Lo que hace único al cáñamo es su <strong className="text-neon">proporción ideal de Omega 3 a Omega 6 (1:3)</strong>, considerada óptima para la salud cardiovascular. Además, es la única semilla que contiene <strong className="text-white">ácido gamma-linolénico (GLA)</strong>, un ácido graso que ayuda a regular la inflamación, el equilibrio hormonal y la salud de la piel.
        </p>
        <p>
          En <strong className="text-neon">La Manito Del Vegano</strong>, incorporamos el cáñamo en nuestro icónico manjar, en las bases de nuestros pies y en varias recetas especiales. No es solo un ingrediente — es nuestra filosofía: <em>nutrición real, sin crueldad</em>. 🌱
        </p>
      </>
    )
  },
  {
    emoji: '🥟',
    cat: 'Recetas',
    title: 'Cómo hacer empanadas veganas perfectas en casa',
    ex: 'Todos los secretos de nuestra masa crocante y rellenos irresistibles.',
    content: (
      <>
        <p className="mb-3">
          La empanada es el alma de la cocina chilena, y demostrar que puede ser <strong className="text-neon">100% vegana sin perder un gramo de sabor</strong> ha sido uno de nuestros mayores orgullos.
        </p>
        <p className="mb-3">
          <strong>🔑 Secretos de nuestra masa:</strong>
          <br />
          • Usamos una mezcla de harina de trigo y un toque de aceite de coco para lograr esa textura dorada y crocante.
          <br />
          • El secreto está en el reposo: dejamos la masa descansar mínimo 30 minutos en frío.
          <br />• El horneado es a temperatura alta (220°C) los primeros 10 minutos para sellar, y luego bajamos a 180°C.
        </p>
        <p className="mb-3">
          <strong>🥄 Nuestro pino de soya:</strong>
          <br />
          • Soya texturizada hidratada con caldo de verduras especiado.
          <br />
          • Cebolla caramelizada lentamente (mínimo 20 minutos) — este es EL secreto del sabor.
          <br />
          • Comino, merkén, pimentón ahumado y un toque de ají de color.
          <br />• Aceitunas y pasas opcionales para el toque clásico.
        </p>
        <p>
          El resultado: una empanada que cierra los ojos de quien la prueba. Crujiente por fuera, jugosa por dentro, y con el sabor de casa. <em>Sin crueldad, con todo el amor.</em> 🌱
        </p>
      </>
    )
  },
  {
    emoji: '🍯',
    cat: 'Innovación',
    title: 'El manjar vegano que nadie creía posible: nuestra historia con el cáñamo',
    ex: 'Cómo creamos el primer manjar de semilla de cáñamo de Chile.',
    content: (
      <>
        <p className="mb-3">
          Cuando dijimos que íbamos a crear un <strong className="text-neon">manjar sin leche condensada, sin azúcar refinada y con semillas de cáñamo</strong>, nos miraron con escepticismo. "Eso no va a funcionar", nos dijeron. Pero nosotros teníamos una visión.
        </p>
        <p className="mb-3">
          <strong>🧪 El proceso de desarrollo:</strong>
          <br />
          Pasamos más de 3 meses probando diferentes proporciones. La clave fue descubrir que la leche de cáñamo, al cocinarla a fuego bajo con panela y un toque de vainilla, desarrolla una <strong className="text-neon">caramelización natural</strong> que recuerda al dulce de leche tradicional. La textura cremosa viene de los aceites naturales del cáñamo.
        </p>
        <p className="mb-3">
          <strong>💪 Lo que hace especial a nuestro manjar:</strong>
          <br />
          • Sin lácteos, sin huevo, sin soya
          <br />
          • Rico en proteína vegetal y Omegas del cáñamo
          <br />
          • Endulzado con panela orgánica (bajo índice glucémico)
          <br />
          • Libre de gluten
          <br />• Textura sedosa que se derrite en la boca
        </p>
        <p>
          Hoy nuestro manjar de cáñamo es el <strong className="text-neon">producto más pedido del taller</strong>. Lo usamos como relleno de pies, lo vendemos en frascos y es la estrella de nuestros packs de regalo. Es la prueba de que la creatividad vegana no tiene límites. 🍯🌱
        </p>
      </>
    )
  },
  {
    emoji: '🇨🇱',
    cat: 'Cultura',
    title: 'El veganismo en Chile: de nicho a movimiento masivo',
    ex: 'Cómo Chile se convirtió en uno de los países más veggie-friendly de Latinoamérica.',
    content: (
      <>
        <p className="mb-3">
          Chile ha experimentado una <strong className="text-neon">revolución plant based silenciosa pero poderosa</strong>. En los últimos 5 años, el número de personas que se identifican como veganas o vegetarianas en Chile se ha triplicado, y cada vez más emprendimientos como el nuestro demuestran que la comida consciente puede ser deliciosa.
        </p>
        <p className="mb-3">
          Lo más emocionante es ver cómo las recetas tradicionales chilenas se reinventan: la empanada de pino con soya texturizada, el pastel de choclo con carne vegetal, el manjar sin lácteos. <strong className="text-white">No se trata de renunciar a nuestra identidad culinaria, sino de evolucionarla.</strong>
        </p>
        <p>
          En La Manito Del Vegano somos parte de este movimiento. Cada pedido que despachamos, cada persona que prueba nuestras empanadas y dice <em>"no puedo creer que esto es vegano"</em>, es un paso más hacia un Chile más consciente. 🌱🇨🇱
        </p>
      </>
    )
  }
];

export default function BlogPage() {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  return (
    <SiteShell>
      <main className="pt-[100px] px-4 pb-16 max-w-[600px] mx-auto">
        <h1 className="font-display font-bold text-xl text-white mb-2">Blog Vegano 🌿</h1>
        <p className="text-xs text-muted mb-6">Recetas, tips y todo sobre el mundo plant based</p>

        <div className="flex flex-col gap-4">
          {BLOG_POSTS.map((post, idx) => (
            <div
              key={idx}
              onClick={() => setOpenIdx(openIdx === idx ? null : idx)}
              className="bg-white/[0.03] border border-[rgba(0,255,179,0.15)] rounded-2xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.5)] cursor-pointer hover:border-[rgba(0,255,179,0.35)] transition-all"
            >
              <div className="h-[120px] flex items-center justify-center text-5xl bg-[#06100c]">
                {post.emoji}
              </div>
              <div className="p-4">
                <span className="inline-block bg-[rgba(0,255,179,0.1)] text-neon px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase border border-[rgba(0,255,179,0.2)] mb-2">
                  {post.cat}
                </span>
                <h2 className="font-display font-bold text-base text-white mb-1.5 leading-snug">
                  {post.title}
                </h2>
                <p className="text-xs text-white/60 leading-relaxed">{post.ex}</p>

                {openIdx === idx && (
                  <div className="mt-4 pt-4 border-t border-[rgba(0,255,179,0.15)] text-xs text-white/80 leading-relaxed">
                    {post.content}
                    <p className="text-[10px] text-neon/50 mt-3">📖 Haz clic para cerrar artículo</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </main>
    </SiteShell>
  );
}
