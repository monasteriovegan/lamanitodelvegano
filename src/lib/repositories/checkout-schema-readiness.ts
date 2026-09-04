import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

export async function verifyCheckoutSchemaReady(db: SupabaseClient): Promise<boolean> {
  try {
    const { data, error } = await db.rpc('checkout_schema_ready_v2');
    if (error) {
      console.error('checkout_schema_readiness_failed', { code: error.code || 'unknown' });
      return false;
    }
    return data === true;
  } catch {
    console.error('checkout_schema_readiness_failed', { code: 'runtime_error' });
    return false;
  }
}
