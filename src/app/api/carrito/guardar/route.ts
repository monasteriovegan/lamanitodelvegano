import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import type { ItemCarrito } from '@/types/domain';

/**
 * Guarda (upsert) el estado del carrito en progreso apenas el cliente deja
 * un email o teléfono en el checkout — sin esperar a que complete la
 * compra. Lo llama el checkout con debounce (ver ClienteFormExtras), no en
 * cada tecla.
 *
 * No es información sensible de pago (no hay tarjetas ni tokens acá), así
 * que usar el service client directo es aceptable — igual queda detrás de
 * RLS para cualquier lectura desde el cliente (anon no puede leer esta
 * tabla, ver rls-policies.sql).
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { nombre, email, telefono, items, subtotal } = body as {
    nombre?: string;
    email?: string;
    telefono?: string;
    items: ItemCarrito[];
    subtotal: number;
  };

  const identificador = email || telefono;
  if (!identificador || !items || items.length === 0) {
    return NextResponse.json({ ok: true }); // nada que guardar todavía
  }

  const supabase = createSupabaseServiceClient();

  // upsert manual por identificador: busca un carrito no recuperado con el
  // mismo email o teléfono en las últimas 24h y lo actualiza; si no existe,
  // crea uno nuevo. Evita duplicar filas por cada guardado incremental.
  const { data: existente } = await supabase
    .from('carritos_abandonados')
    .select('id')
    .eq('recuperado', false)
    .or(`email.eq.${email || ''},telefono.eq.${telefono || ''}`)
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const payload = {
    identificador,
    nombre: nombre || null,
    email: email || null,
    telefono: telefono || null,
    items,
    subtotal,
    last_activity_at: new Date().toISOString(),
    contactado: false,
  };

  if (existente) {
    await supabase.from('carritos_abandonados').update(payload).eq('id', existente.id);
  } else {
    await supabase.from('carritos_abandonados').insert(payload);
  }

  return NextResponse.json({ ok: true });
}
