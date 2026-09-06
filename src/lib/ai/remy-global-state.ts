import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

export async function getRemyGlobalEnabled(db: SupabaseClient): Promise<boolean> {
  const { data, error } = await db
    .from('integraciones_secretas')
    .select('ai_enabled')
    .eq('id', 'global')
    .maybeSingle();

  if (error) throw error;
  return data?.ai_enabled === true;
}

export async function setRemyGlobalEnabled(db: SupabaseClient, enabled: boolean): Promise<void> {
  const { error } = await db.rpc('set_remy_global_enabled', { p_enabled: enabled });
  if (error) throw error;
}
