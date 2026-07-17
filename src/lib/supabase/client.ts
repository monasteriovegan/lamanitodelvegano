// Cliente de Supabase para el NAVEGADOR (componentes 'use client').
// Usa SOLO la anon key. Con la RLS configurada, este cliente únicamente
// puede leer catálogo público (productos activos, categorías, zonas, ajustes,
// cupones activos). No puede leer pedidos, pins, ni integraciones_secretas.

import { createBrowserClient } from '@supabase/ssr';

export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
