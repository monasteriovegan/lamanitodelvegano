'use client';

import Link from 'next/link';

export function Footer() {
  return (
    <footer className="bg-v1 text-white/60 border-t border-[rgba(0,255,179,0.1)] py-8 px-4 text-[11px] leading-relaxed text-center mt-12">
      <strong className="block text-white text-sm font-display font-extrabold mb-1.5">
        La Manito Del Vegano 🌱
      </strong>
      Santiago y Pucón · Chile · @lamanitodelvegano
      <br />
      Taller 100% Plant Based · Solo pedidos bajo encargo
      <div className="flex gap-3 justify-center mt-3">
        <Link href="/nosotros" className="text-white/50 hover:text-neon text-[11px] transition-colors">
          Nosotros
        </Link>
        <span className="text-white/20">|</span>
        <Link href="/contacto" className="text-white/50 hover:text-neon text-[11px] transition-colors">
          Contacto
        </Link>
        <span className="text-white/20">|</span>
        <Link href="/seguimiento" className="text-white/50 hover:text-neon text-[11px] transition-colors">
          Rastrear Pedido
        </Link>
      </div>
    </footer>
  );
}
