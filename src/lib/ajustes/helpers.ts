import { createSupabaseServiceClient } from '@/lib/supabase/server';
import type { AjustesData } from '@/types/domain';

/**
 * La tabla `ajustes` guarda todo en una única fila con una columna `data`
 * JSON. Cada pantalla del admin (Ajustes generales, Promo Flyer, etc.)
 * solo conoce un subconjunto de esos campos — por eso NUNCA hay que hacer
 * `.upsert({ id: 'global', data: {...soloLoQueEstaFormularioConoce} })`
 * directo, porque eso borra en silencio cualquier campo que otra pantalla
 * haya guardado antes (esto ya pasaba con Ajustes generales pisando los
 * campos de la Promo Especial — bug preexistente, corregido acá).
 *
 * Todas las pantallas que escriben en `ajustes` deben pasar por
 * `guardarAjustesParcial`, nunca escribir la tabla directo.
 */
export async function leerAjustes(): Promise<AjustesData> {
  const supabase = createSupabaseServiceClient();
  const { data: row } = await supabase.from('ajustes').select('data').eq('id', 'global').maybeSingle();
  return (row?.data as AjustesData) || {};
}

export async function guardarAjustesParcial(cambios: Partial<AjustesData>): Promise<void> {
  const supabase = createSupabaseServiceClient();
  const { data: row } = await supabase.from('ajustes').select('data').eq('id', 'global').maybeSingle();
  const actual = (row?.data as AjustesData) || {};
  const nuevo = { ...actual, ...cambios };

  const { error } = await supabase.from('ajustes').upsert({ id: 'global', data: nuevo });
  if (error) throw new Error(error.message);
}
