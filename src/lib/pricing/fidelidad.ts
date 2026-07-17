import 'server-only';
import { createHash } from 'crypto';
import { createSupabaseServiceClient } from '@/lib/supabase/server';

/**
 * Reemplaza buscarPuntosCliente() del app.js viejo.
 * ANTES: el navegador hacía `select('*')` de TODA la tabla `pedidos` (con nombre,
 * dirección, teléfono de todos los clientes) solo para calcular puntos de uno.
 * AHORA: el cálculo ocurre 100% en el servidor; el navegador solo recibe el
 * resultado agregado (puntos disponibles, si tiene PIN registrado).
 *
 * Usa columnas reales en camelCase (total, descuentoFidelidad, puntosCanjeados).
 */

export function getClienteIdentifier(email?: string, telefono?: string): string | null {
  if (email && email.trim()) return email.trim().toLowerCase();
  if (telefono && telefono.trim()) return telefono.replace(/\D/g, '');
  return null;
}

function hashPin(pin: string, identifier: string): string {
  return createHash('sha256').update(`${identifier}:${pin}:lmv-salt-v1`).digest('hex');
}

export async function consultarPuntosCliente(email?: string, telefono?: string) {
  const identifier = getClienteIdentifier(email, telefono);
  if (!identifier) return { ok: false as const, error: 'Datos insuficientes.' };

  const supabase = createSupabaseServiceClient();

  const { data: ajustesRow } = await supabase.from('ajustes').select('data').eq('id', 'global').maybeSingle();
  const tasaPuntos = ajustesRow?.data?.tasaPuntos || 1000;

  const { data: pedidos, error } = await supabase
    .from('pedidos')
    .select('total, descuentoFidelidad, puntosCanjeados, status, cliente')
    .or(`cliente->>email.eq.${email?.trim().toLowerCase() || ''},cliente->>telefono.eq.${telefono?.trim() || ''}`);

  if (error) return { ok: false as const, error: 'Error al consultar pedidos.' };

  let totalGanados = 0;
  let totalCanjeados = 0;
  for (const p of pedidos || []) {
    if (p.status !== 'Cancelado' && p.status !== 'Pendiente') {
      totalGanados += Math.floor((p.total + (p.descuentoFidelidad || 0)) / tasaPuntos);
    }
    totalCanjeados += p.puntosCanjeados || 0;
  }

  const puntosDisponibles = Math.max(0, totalGanados - totalCanjeados);

  const { data: pinRow } = await supabase
    .from('puntos_pins')
    .select('id')
    .eq('id', identifier)
    .maybeSingle();

  return {
    ok: true as const,
    puntosDisponibles,
    pinRegistrado: !!pinRow,
  };
}

export async function registrarPin(email: string | undefined, telefono: string | undefined, pin: string) {
  const identifier = getClienteIdentifier(email, telefono);
  if (!identifier) return { ok: false as const, error: 'No se pudo identificar al cliente.' };
  if (!/^\d{4}$/.test(pin)) return { ok: false as const, error: 'El PIN debe ser de 4 dígitos.' };

  const supabase = createSupabaseServiceClient();
  const pin_hash = hashPin(pin, identifier);

  // Nota: la tabla vieja `puntos_pins` tiene columna `pin` (texto plano). Guardamos
  // el hash en esa misma columna para no romper el esquema, pero ya nunca en plano.
  const { error } = await supabase.from('puntos_pins').upsert({ id: identifier, pin: pin_hash });
  if (error) return { ok: false as const, error: 'Error al guardar el PIN.' };
  return { ok: true as const };
}

export async function validarPin(email: string | undefined, telefono: string | undefined, pin: string) {
  const identifier = getClienteIdentifier(email, telefono);
  if (!identifier) return { ok: false as const, error: 'No se pudo identificar al cliente.' };

  const supabase = createSupabaseServiceClient();
  const { data } = await supabase.from('puntos_pins').select('pin').eq('id', identifier).maybeSingle();
  if (!data) return { ok: false as const, error: 'No hay PIN registrado para este cliente.' };

  const valido = data.pin === hashPin(pin, identifier);
  return { ok: valido, error: valido ? undefined : 'PIN incorrecto.' };
}
