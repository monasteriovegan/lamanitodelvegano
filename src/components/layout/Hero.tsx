import Link from 'next/link';
import { SafeStorageImage } from '@/components/media/SafeStorageImage';

export function Hero() {
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
        <span className="hpill mb-3">🌿 Especial de fin de semana</span>

        <h1 className="font-display font-extrabold text-[clamp(28px,8vw,48px)] text-white leading-[1.1] mb-3">
          <span className="text-white">ANTOJOS VEGANOS PARA EL FINDE</span>
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
            href="/especial-fin-de-semana"
            className="btnw"
          >
            Ver especial de fin de semana 🛒
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
