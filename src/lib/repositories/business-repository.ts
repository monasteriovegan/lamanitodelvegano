import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

export const DEFAULT_BUSINESS_SLUG = 'la-manito-del-vegano';

export type BusinessUnit = {
  id: string;
  name: string;
  slug: string;
  agent_enabled: boolean;
};

export class BusinessRepository {
  private readonly db: SupabaseClient;

  constructor(db: SupabaseClient) {
    this.db = db;
  }

  async getDefault(): Promise<BusinessUnit | null> {
    const { data, error } = await this.db
      .from('business_units')
      .select('id,name,slug,agent_enabled')
      .eq('slug', DEFAULT_BUSINESS_SLUG)
      .maybeSingle();
    if (error) throw error;
    return data as BusinessUnit | null;
  }

  async requireDefault(): Promise<BusinessUnit> {
    const business = await this.getDefault();
    if (!business) throw new Error(`Unidad comercial no encontrada: ${DEFAULT_BUSINESS_SLUG}`);
    return business;
  }
}

