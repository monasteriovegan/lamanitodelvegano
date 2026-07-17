import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { enviarMensajeWhatsApp } from '@/lib/whatsapp/client';
import { enviarEmail } from '@/lib/email/resend';
import { plantillaCarritoAbandonado } from '@/lib/email/templates';
import type { ItemCarrito } from '@/types/domain';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const HORAS_INACTIVIDAD = 2;

/**
 * Corre periódicamente vía Vercel Cron (ver vercel.json). Busca carritos
 * sin actividad hace más de HORAS_INACTIVIDAD, sin recuperar y sin
 * contactar todavía, y les manda UN recordatorio (por WhatsApp si hay
 * teléfono, si no por email) — nunca más de uno por carrito, controlado
 * por el flag `contactado`.
 *
 * Protegido con CRON_SECRET: Vercel Cron manda ese secreto en el header
 * Authorization automáticamente si está configurado en el proyecto — sin
 * esto, cualquiera podría llamar este endpoint y hacer spam a clientes.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const supabase = createSupabaseServiceClient();
  const limite = new Date(Date.now() - HORAS_INACTIVIDAD * 60 * 60 * 1000).toISOString();

  const { data: carritos, error } = await supabase
    .from('carritos_abandonados')
    .select('*')
    .eq('contactado', false)
    .eq('recuperado', false)
    .lte('last_activity_at', limite)
    .limit(50); // tope por corrida, para no mandar cientos de golpe si el cron estuvo caído

  if (error) {
    console.error('Error buscando carritos abandonados:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let enviados = 0;
  let fallidos = 0;

  for (const carrito of carritos || []) {
    const items = carrito.items as ItemCarrito[];
    const nombre = carrito.nombre || '';
    let resultado: { ok: boolean };

    if (carrito.telefono) {
      const mensaje = `Hola${nombre ? ' ' + nombre.split(' ')[0] : ''} 🌱 Notamos que dejaste productos en tu carrito de La Manito Del Vegano (total: $${(carrito.subtotal || 0).toLocaleString('es-CL')}). ¿Te ayudamos a completar el pedido? lamanitodelvegano.cl`;
      resultado = await enviarMensajeWhatsApp(carrito.telefono, mensaje);
    } else if (carrito.email) {
      resultado = await enviarEmail({
        to: carrito.email,
        subject: 'Dejaste algo en tu carrito 🌿',
        html: plantillaCarritoAbandonado(nombre, items, carrito.subtotal || 0),
      });
    } else {
      continue; // no debería pasar (guardar/route.ts exige uno de los dos), pero por seguridad
    }

    if (resultado.ok) {
      enviados++;
      await supabase.from('carritos_abandonados').update({ contactado: true }).eq('id', carrito.id);
    } else {
      fallidos++;
    }
  }

  return NextResponse.json({ ok: true, revisados: carritos?.length || 0, enviados, fallidos });
}
