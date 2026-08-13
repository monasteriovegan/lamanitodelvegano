import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { BusinessRepository } from './business-repository';
import {
  getSchemaCapabilities,
  requireSchemaCapability,
  type SchemaCapabilities,
} from './schema-capabilities';

type JsonRecord = Record<string, any>;

export class DeliveryRepository {
  private readonly capabilities: SchemaCapabilities;

  constructor(
    private readonly db: SupabaseClient,
    capabilities: SchemaCapabilities = getSchemaCapabilities(),
  ) {
    this.capabilities = capabilities;
  }

  async getSettings(): Promise<JsonRecord | null> {
    if (!this.capabilities.supportTables) return null;
    const business = await new BusinessRepository(this.db).requireDefault();
    const { data, error } = await this.db
      .from('delivery_settings')
      .select('*')
      .eq('business_unit_id', business.id)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async saveSettings(input: JsonRecord): Promise<JsonRecord> {
    requireSchemaCapability(this.capabilities, 'supportTables');
    const business = await new BusinessRepository(this.db).requireDefault();
    const payload = { ...input, business_unit_id: business.id, updated_at: new Date().toISOString() };
    const { data, error } = await this.db
      .from('delivery_settings')
      .upsert(payload, { onConflict: 'business_unit_id' })
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  async listBlockedDates(): Promise<JsonRecord[]> {
    if (!this.capabilities.supportTables) return [];
    const business = await new BusinessRepository(this.db).requireDefault();
    const { data, error } = await this.db
      .from('blocked_delivery_dates')
      .select('*')
      .eq('business_unit_id', business.id)
      .gte('date', new Date().toISOString().split('T')[0])
      .order('date');
    if (error) throw error;
    return data || [];
  }

  async blockDate(input: { date: string; reason?: string | null }): Promise<JsonRecord> {
    requireSchemaCapability(this.capabilities, 'supportTables');
    const business = await new BusinessRepository(this.db).requireDefault();
    const { data, error } = await this.db
      .from('blocked_delivery_dates')
      .insert({ business_unit_id: business.id, date: input.date, reason: input.reason ?? null })
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  async unblockDate(id: string): Promise<void> {
    requireSchemaCapability(this.capabilities, 'supportTables');
    const { error } = await this.db.from('blocked_delivery_dates').delete().eq('id', id);
    if (error) throw error;
  }
}

