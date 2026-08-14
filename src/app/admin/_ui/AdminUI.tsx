import type { ReactNode } from 'react';

/**
 * Kit visual compartido del panel admin. Todo deriva de los tokens reales
 * de la marca (globals.css: --v1..v4, --neon, --gold, --rojo, --am) — nada
 * de colores nuevos inventados. La idea es que cada pantalla del admin se
 * sienta parte del mismo producto, no una colección de páginas sueltas.
 */

export function PageHeader({ eyebrow, title, action }: { eyebrow: string; title: string; action?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-4 md:mb-8">
      <div className="min-w-0">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-neon sm:text-[11px] sm:tracking-[0.18em]">{eyebrow}</p>
        <h1 className="font-display text-xl font-bold leading-tight text-white sm:text-2xl md:text-3xl">{title}</h1>
      </div>
      {action && <div className="min-w-0 max-w-full overflow-x-auto sm:overflow-visible">{action}</div>}
    </div>
  );
}

const ACCENTOS = {
  neon: { border: 'rgba(0,255,179,0.35)', glow: 'rgba(0,255,179,0.12)', texto: 'text-neon' },
  gold: { border: 'rgba(212,175,55,0.35)', glow: 'rgba(212,175,55,0.12)', texto: 'text-gold' },
  rojo: { border: 'rgba(239,68,68,0.35)', glow: 'rgba(239,68,68,0.12)', texto: 'text-rojo' },
  am: { border: 'rgba(245,158,11,0.35)', glow: 'rgba(245,158,11,0.12)', texto: 'text-am' },
} as const;

/** Tarjeta KPI compartida y responsive. */
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
    <div className="glass relative min-w-0 overflow-hidden rounded-2xl p-3.5 sm:p-5" style={{ borderColor: a.border }}>
      <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full" style={{ background: `radial-gradient(circle, ${a.glow}, transparent 70%)` }} />
      <p className="relative text-[9px] font-medium uppercase leading-4 tracking-wider text-muted sm:text-[11px]">{label}</p>
      <p className={`relative mt-1.5 break-words font-display text-xl font-bold leading-tight sm:mt-2 sm:text-3xl ${a.texto}`}>{value}</p>
      {hint && <p className="relative mt-1.5 text-[10px] leading-4 text-muted sm:text-xs">{hint}</p>}
    </div>
  );
}

export function SectionCard({ title, children, action }: { title?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="glass min-w-0 rounded-2xl p-4 sm:p-5 md:p-6">
      {title && (
        <div className="mb-4 flex min-w-0 items-center justify-between gap-3">
          <h2 className="min-w-0 font-display text-sm font-bold text-white sm:text-base">{title}</h2>
          <div className="shrink-0">{action}</div>
        </div>
      )}
      {children}
    </div>
  );
}

export function EmptyState({ emoji, texto }: { emoji: string; texto: string }) {
  return (
    <div className="py-8 text-center text-muted sm:py-10">
      <p className="mb-2 text-3xl">{emoji}</p>
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
  return <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold ${estilos[tono]}`}>{children}</span>;
}
