'use client';

import type { PublicCatalogProduct } from '@/lib/catalog/public-dto';

type Group = PublicCatalogProduct['optionGroups'][number];

export function OptionQuantitySelector({
  group,
  values,
  target,
  onChange,
}: {
  group: Group;
  values: Record<string, number>;
  target: number;
  onChange: (next: Record<string, number>) => void;
}) {
  const total = Object.values(values).reduce((sum, quantity) => sum + quantity, 0);
  const single = group.selectionMode === 'single';

  function change(id: string, delta: number) {
    if (single) return onChange({ [id]: 1 });
    const current = values[id] || 0;
    const nextQuantity = Math.max(0, current + delta);
    if (delta > 0 && total >= target) return;
    onChange({ ...values, [id]: nextQuantity });
  }

  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 flex w-full items-center justify-between text-xs font-bold uppercase tracking-[0.12em] text-white/70">
        <span>{group.name}</span>
        {!single && <span className={total === target ? 'text-neon' : 'text-amber-300'}>{total}/{target}</span>}
      </legend>
      <div className="grid gap-2">
        {group.values.map((value) => {
          const quantity = values[value.id] || 0;
          if (single) {
            return (
              <button
                key={value.id}
                type="button"
                onClick={() => change(value.id, 1)}
                className={`rounded-xl border px-3 py-2 text-left text-sm transition ${quantity === 1 ? 'border-neon bg-neon/10 text-white' : 'border-white/10 bg-white/5 text-white/75 hover:border-white/25'}`}
              >
                {value.label}
              </button>
            );
          }
          return (
            <div key={value.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2">
              <span className="pr-3 text-sm text-white/85">{value.label}</span>
              <div className="flex items-center gap-2">
                <button type="button" aria-label={`Quitar ${value.label}`} onClick={() => change(value.id, -1)} className="h-7 w-7 rounded-lg bg-white/10 text-white">−</button>
                <span className="min-w-5 text-center text-sm font-bold text-white">{quantity}</span>
                <button type="button" aria-label={`Agregar ${value.label}`} onClick={() => change(value.id, 1)} disabled={total >= target} className="h-7 w-7 rounded-lg bg-neon font-bold text-[#020705] disabled:cursor-not-allowed disabled:opacity-35">+</button>
              </div>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
