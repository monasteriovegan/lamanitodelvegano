// Parser de "formatos" de producto.
// Migrado de parseFormatos() / parseWeightValue() / cleanGramajeLabel() del app.js viejo.
//
// Formato de string en BD: "250g:6500,500g:12000,1kg" (precio opcional tras ':')
// Si un formato no especifica precio, se calcula proporcional al peso vs. el primer formato con precio.

export interface FormatoParseado {
  label: string;
  precio: number;
}

function parseWeightValue(str: string): number {
  // Extrae un valor numérico comparable en gramos desde "250g", "1kg", "1.5kg", etc.
  const match = str.match(/([\d.]+)\s*(kg|g)?/i);
  if (!match) return 0;
  const value = parseFloat(match[1]);
  const unit = (match[2] || 'g').toLowerCase();
  return unit === 'kg' ? value * 1000 : value;
}

export function parseFormatos(gramajeStr: string | null | undefined, precioBase: number): FormatoParseado[] {
  if (!gramajeStr || !gramajeStr.trim()) {
    return [{ label: '', precio: precioBase }];
  }

  const partes = gramajeStr.split(',').map((s) => s.trim()).filter(Boolean);
  const parsed: { label: string; precio: number | null; peso: number }[] = partes.map((p) => {
    const [label, precioStr] = p.split(':').map((s) => s.trim());
    return {
      label,
      precio: precioStr ? parseInt(precioStr, 10) : null,
      peso: parseWeightValue(label),
    };
  });

  // Referencia para calcular proporcionales: el primer formato que sí tenga precio explícito.
  const referencia = parsed.find((p) => p.precio !== null && p.peso > 0);

  return parsed.map((p) => {
    if (p.precio !== null) return { label: p.label, precio: p.precio };
    if (referencia && referencia.peso > 0 && p.peso > 0) {
      const proporcional = Math.round((p.peso / referencia.peso) * (referencia.precio as number));
      return { label: p.label, precio: proporcional };
    }
    return { label: p.label, precio: precioBase };
  });
}

export function parseVariedades(variedadesStr: string | null | undefined): string[] {
  if (!variedadesStr || !variedadesStr.trim()) return [];
  return variedadesStr.split(',').map((s) => s.trim()).filter(Boolean);
}
