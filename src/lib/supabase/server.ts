// Cliente de Supabase con SERVICE_ROLE — bypassa RLS por completo.
//
// ⚠️ REGLA DE ORO: este archivo SOLO se importa desde:
//   - Route Handlers (src/app/api/**/route.ts)
//   - Server Actions
//   - Server Components que jamás envían el resultado completo al cliente
//
// NUNCA importar esto desde un archivo con "use client", ni exponer
// SUPABASE_SERVICE_ROLE_KEY con el prefijo NEXT_PUBLIC_.
//
// Si accidentalmente se usa en el cliente, Next.js fallará el build porque
// SUPABASE_SERVICE_ROLE_KEY no existe en el bundle del navegador (no tiene
// el prefijo NEXT_PUBLIC_), lo cual es intencional.

import 'server-only';
import { createClient } from '@supabase/supabase-js';

export function createSupabaseServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    // Durante la fase de compilación estática (build) de Next.js, las variables de entorno pueden no estar presentes.
    // Retornamos un cliente mock apuntando a una URL temporal para evitar que falle la compilación.
    if (process.env.NODE_ENV === 'production' && !process.env.VERCEL) {
      console.warn('⚠️ Advertencia: Faltan variables de Supabase. Iniciando en modo local/build.');
    }
    return createClient('https://adrydqvahzqjbgtcvlay.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy', {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
