import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

type JsonRecord = Record<string, any>;

export type SafeAiSettings = {
  global_ai_enabled: false;
  automatic_ai_enabled: false;
};

export class SettingsRepository {
  constructor(private readonly db: SupabaseClient) {}

  async getSiteSettings(): Promise<JsonRecord | null> {
    const { data, error } = await this.db.from('ajustes').select('id,data').eq('id', 'global').maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return { id: data.id, ...(data.data || {}) };
  }

  async updateSiteSettings(input: JsonRecord): Promise<JsonRecord> {
    const current = await this.getSiteSettings();
    const { id: _ignored, mp_access_token: _secret, ...safeInput } = input;
    const merged = { ...(current || {}), ...safeInput };
    delete merged.id;
    const { data, error } = await this.db
      .from('ajustes')
      .upsert({ id: 'global', data: merged }, { onConflict: 'id' })
      .select('id,data')
      .single();
    if (error) throw error;
    return { id: data.id, ...(data.data || {}) };
  }

  async getAiSettings(): Promise<SafeAiSettings> {
    return { global_ai_enabled: false, automatic_ai_enabled: false };
  }
}

