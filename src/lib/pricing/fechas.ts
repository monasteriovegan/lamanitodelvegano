// Migrado de genFechas() del app.js viejo.
// Reglas:
// - Por defecto: mínimo 3 días de anticipación, solo lunes a sábado (no domingo).
// - Si algún producto del carrito tiene fechas especiales FUTURAS (disponibilidad),
//   se usa la INTERSECCIÓN de las fechas disponibles de todos los productos restringidos.
// - Fechas especiales completamente vencidas se consideran históricas y dejan de
//   bloquear pedidos futuros; el producto vuelve a la regla general de despacho.

export interface FechaDespacho {
  fecha: Date;
  ok: boolean;
  dias: number;
  isSpecial?: boolean;
}

interface ProductoConDisponibilidad {
  disponibilidad: string[] | null;
}

function dateFromYmd(value: string) {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function genFechas(productosEnCarrito: ProductoConDisponibilidad[]): FechaDespacho[] {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  // Sólo una fecha futura vigente puede restringir el calendario. Esto evita que
  // promociones/ventanas antiguas queden bloqueando el checkout para siempre.
  const productosConRestriccion = productosEnCarrito
    .map((producto) => ({
      ...producto,
      disponibilidad: (producto.disponibilidad || []).filter((value) => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
        return dateFromYmd(value).getTime() >= hoy.getTime();
      }),
    }))
    .filter((producto) => producto.disponibilidad.length > 0);

  if (productosConRestriccion.length > 0) {
    let fechasRestringidas: string[] | null = null;
    for (const producto of productosConRestriccion) {
      const dates = producto.disponibilidad;
      fechasRestringidas =
        fechasRestringidas === null ? dates : fechasRestringidas.filter((date) => dates.includes(date));
    }

    const res: FechaDespacho[] = (fechasRestringidas || []).map((dateStr) => {
      const fecha = dateFromYmd(dateStr);
      const diffDays = Math.ceil((fecha.getTime() - hoy.getTime()) / 86400000);
      return { fecha, ok: true, dias: diffDays, isSpecial: true };
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
