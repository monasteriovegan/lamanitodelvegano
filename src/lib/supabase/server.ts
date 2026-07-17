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
    throw new Error(
      'Faltan SUPABASE_SERVICE_ROLE_KEY o NEXT_PUBLIC_SUPABASE_URL en las variables de entorno del servidor.'
    );
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
