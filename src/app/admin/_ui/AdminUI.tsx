import type { ReactNode } from 'react';

/**
 * Kit visual compartido del panel admin. Todo deriva de los tokens reales
 * de la marca (globals.css: --v1..v4, --neon, --gold, --rojo, --am) — nada
 * de colores nuevos inventados. La idea es que cada pantalla del admin se
 * sienta parte del mismo producto, no una colección de páginas sueltas.
 */

export function PageHeader({ eyebrow, title, action }: { eyebrow: string; title: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-8 flex-wrap">
      <div>
        <p className="text-[11px] uppercase tracking-[0.18em] text-neon font-semibold mb-1.5">{eyebrow}</p>
        <h1 className="font-display font-bold text-2xl md:text-3xl text-white">{title}</h1>
      </div>
      {action}
    </div>
  );
}

const ACCENTOS = {
  neon: { border: 'rgba(0,255,179,0.35)', glow: 'rgba(0,255,179,0.12)', texto: 'text-neon' },
  gold: { border: 'rgba(212,175,55,0.35)', glow: 'rgba(212,175,55,0.12)', texto: 'text-gold' },
  rojo: { border: 'rgba(239,68,68,0.35)', glow: 'rgba(239,68,68,0.12)', texto: 'text-rojo' },
  am: { border: 'rgba(245,158,11,0.35)', glow: 'rgba(245,158,11,0.12)', texto: 'text-am' },
} as const;

/**
 * Tarjeta de KPI con el mismo glow radial que usa el Hero del sitio público
 * (radial-gradient detrás del número) — es la firma visual que conecta el
 * admin con la marca, en vez de sentirse como un dashboard genérico
 * pegado encima.
 */
export function StatCard({
  label,
  value,
  hint,
  accento = 'neon',
}: {
  label: string;
  value: string;
  hint?: string;
  accento?: keyof typeof ACCENTOS;
}) {
  const a = ACCENTOS[accento];
  return (
    <div
      className="glass rounded-2xl p-5 relative overflow-hidden"
      style={{ borderColor: a.border }}
    >
      <div
        className="absolute -top-10 -right-10 w-32 h-32 rounded-full pointer-events-none"
        style={{ background: `radial-gradient(circle, ${a.glow}, transparent 70%)` }}
      />
      <p className="text-[11px] uppercase tracking-wider text-muted font-medium relative">{label}</p>
      <p className={`font-display font-bold text-3xl mt-2 relative ${a.texto}`}>{value}</p>
      {hint && <p className="text-xs text-muted mt-1.5 relative">{hint}</p>}
    </div>
  );
}

export function SectionCard({ title, children, action }: { title?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="glass rounded-2xl p-5 md:p-6">
      {title && (
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-bold text-base text-white">{title}</h2>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

export function EmptyState({ emoji, texto }: { emoji: string; texto: string }) {
  return (
    <div className="text-center py-10 text-muted">
      <p className="text-3xl mb-2">{emoji}</p>
      <p className="text-sm">{texto}</p>
    </div>
  );
}

export function Badge({ children, tono = 'neutro' }: { children: ReactNode; tono?: 'neutro' | 'neon' | 'rojo' | 'am' }) {
  const estilos = {
    neutro: 'bg-white/5 text-muted border-white/10',
    neon: 'bg-[rgba(0,255,179,0.1)] text-neon border-[rgba(0,255,179,0.25)]',
    rojo: 'bg-[rgba(239,68,68,0.1)] text-rojo border-[rgba(239,68,68,0.25)]',
    am: 'bg-[rgba(245,158,11,0.1)] text-am border-[rgba(245,158,11,0.25)]',
  };
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full border ${estilos[tono]}`}>
      {children}
    </span>
  );
}
