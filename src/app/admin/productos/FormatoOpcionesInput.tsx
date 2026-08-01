'use client';

import { useMemo, useState } from 'react';

interface FilaFormato {
  id: number;
  label: string;
  precio: string;
}

function parseInicial(valor: string | null | undefined): FilaFormato[] {
  if (!valor?.trim()) return [];

  return valor
    .split(',')
    .map((parte, index) => {
      const [label, precio] = parte.split(':').map((item) => item.trim());
      return {
        id: Date.now() + index,
        label: label || '',
        precio: precio || '',
      };
    })
    .filter((fila) => fila.label || fila.precio);
}

function nuevaFila(): FilaFormato {
  return { id: Date.now() + Math.random(), label: '', precio: '' };
}

export function FormatoOpcionesInput({ defaultValue }: { defaultValue?: string | null }) {
  const [filas, setFilas] = useState<FilaFormato[]>(() => parseInicial(defaultValue));

  const valorSerializado = useMemo(() => {
    return filas
      .map((fila) => ({ label: fila.label.trim(), precio: fila.precio.trim() }))
      .filter((fila) => fila.label)
      .map((fila) => (fila.precio ? `${fila.label}:${fila.precio}` : fila.label))
      .join(',');
  }, [filas]);

  function updateFila(id: number, patch: Partial<FilaFormato>) {
    setFilas((actuales) => actuales.map((fila) => (fila.id === id ? { ...fila, ...patch } : fila)));
  }

  function agregarFila(label = '', precio = '') {
    setFilas((actuales) => [...actuales, { ...nuevaFila(), label, precio }]);
  }

  function eliminarFila(id: number) {
    setFilas((actuales) => actuales.filter((fila) => fila.id !== id));
  }

  return (
    <div className="rounded-xl border border-[rgba(0,255,179,0.12)] bg-white/[0.025] p-3">
      <input type="hidden" name="gramaje" value={valorSerializado} />

      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <label className="block text-xs text-muted mb-1.5">Opciones de peso y precio</label>
          <p className="text-[11px] text-white/35 leading-relaxed">
            Crea variantes como 500g, 1kg o pack familiar. Si lo dejas vacio, se usa solo el precio base.
          </p>
        </div>
        <button
          type="button"
          onClick={() => agregarFila()}
          className="w-fit rounded-full bg-neon px-3 py-2 text-xs font-bold text-[#020705] transition-colors hover:bg-white"
        >
          + Agregar opcion
        </button>
      </div>

      {filas.length === 0 ? (
        <div className="rounded-lg border border-dashed border-white/10 bg-white/[0.02] p-3 text-xs text-white/40">
          Sin opciones de peso. El cliente comprara este producto con el precio base.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filas.map((fila, index) => (
            <div key={fila.id} className="grid grid-cols-[1fr_1fr_auto] gap-2">
              <input
                value={fila.label}
                onChange={(e) => updateFila(fila.id, { label: e.target.value })}
                placeholder={index === 0 ? '500g' : '1kg'}
                className="min-w-0 bg-white/5 border border-[rgba(0,255,179,0.2)] rounded-lg px-3 py-2.5 text-sm text-white"
              />
              <input
                type="number"
                min="0"
                value={fila.precio}
                onChange={(e) => updateFila(fila.id, { precio: e.target.value })}
                placeholder={index === 0 ? '6500' : '12000'}
                className="min-w-0 bg-white/5 border border-[rgba(0,255,179,0.2)] rounded-lg px-3 py-2.5 text-sm text-white"
              />
              <button
                type="button"
                onClick={() => eliminarFila(fila.id)}
                aria-label="Eliminar opcion"
                className="h-[42px] w-[42px] rounded-lg border border-white/10 bg-white/[0.04] text-white/60 transition-colors hover:bg-white/[0.08] hover:text-white"
              >
                x
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => agregarFila('500g', '')}
          className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] text-white/65 hover:bg-white/[0.08]"
        >
          + 500g
        </button>
        <button
          type="button"
          onClick={() => agregarFila('1kg', '')}
          className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] text-white/65 hover:bg-white/[0.08]"
        >
          + 1kg
        </button>
        <button
          type="button"
          onClick={() => setFilas([])}
          className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] text-white/45 hover:bg-white/[0.08] hover:text-white/70"
        >
          Usar solo precio base
        </button>
      </div>
    </div>
  );
}
