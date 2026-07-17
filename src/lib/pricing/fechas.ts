// Migrado de genFechas() del app.js viejo.
// Reglas:
// - Por defecto: mínimo 3 días de anticipación, solo lunes a sábado (no domingo).
// - Si algún producto del carrito tiene fechas especiales (disponibilidad),
//   se usa la INTERSECCIÓN de las fechas disponibles de todos los productos restringidos.

export interface FechaDespacho {
  fecha: Date;
  ok: boolean;
  dias: number;
  isSpecial?: boolean;
}

interface ProductoConDisponibilidad {
  disponibilidad: string[] | null;
}

export function genFechas(productosEnCarrito: ProductoConDisponibilidad[]): FechaDespacho[] {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const productosConRestriccion = productosEnCarrito.filter(
    (p) => p.disponibilidad && p.disponibilidad.length > 0
  );

  if (productosConRestriccion.length > 0) {
    let fechasRestringidas: string[] | null = null;
    for (const p of productosConRestriccion) {
      const dates = p.disponibilidad as string[];
      fechasRestringidas =
        fechasRestringidas === null ? dates : fechasRestringidas.filter((d) => dates.includes(d));
    }

    const res: FechaDespacho[] = (fechasRestringidas || []).map((dateStr) => {
      const [y, m, d] = dateStr.split('-').map(Number);
      const fecha = new Date(y, m - 1, d);
      const diffDays = Math.ceil((fecha.getTime() - hoy.getTime()) / 86400000);
      const isPast = hoy.getTime() > fecha.getTime();
      return { fecha, ok: !isPast, dias: diffDays, isSpecial: true };
    });

    res.sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
    return res;
  }

  // Comportamiento default: próximos días hábiles (lun-sáb), mínimo 3 días de anticipación.
  const diasHabiles = [1, 2, 3, 4, 5, 6]; // 0 = domingo excluido
  const res: FechaDespacho[] = [];
  let i = 1;
  while (res.length < 9) {
    const fecha = new Date(hoy);
    fecha.setDate(hoy.getDate() + i);
    const ok = i >= 3 && diasHabiles.includes(fecha.getDay());
    res.push({ fecha, ok, dias: i });
    const validas = res.filter((x) => x.ok).length;
    if (validas >= 6 && i >= 5) break;
    i++;
  }
  return res;
}
