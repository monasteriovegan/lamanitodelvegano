import Link from 'next/link';

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
        <span className="hpill mb-3">🌿 Taller Plant Based</span>

        <h1 className="font-display font-extrabold text-[clamp(28px,8vw,48px)] text-white leading-[1.1] mb-3">
          Comida vegana que <em className="italic text-[#B7E4C7] not-italic [font-style:italic]">enamora</em>
        </h1>

        <p className="text-white/75 text-sm leading-relaxed max-w-[600px] mx-auto mb-6">
          Elaboramos con amor y conciencia. Solo pedidos · Santiago y Pucón · Delivery a todo Santiago
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
            href="#catalogo"
            className="btnw"
          >
            Ver productos 🛒
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
