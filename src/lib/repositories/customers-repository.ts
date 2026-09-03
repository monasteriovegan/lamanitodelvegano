import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizePhone } from '@/lib/messaging/normalize';
import {
  getSchemaCapabilities,
  requireSchemaCapability,
  type SchemaCapabilities,
} from './schema-capabilities';
import { OrderRepository, type AdminOrder } from './orders-repository';

type JsonRecord = Record<string, any>;

export type AdminCustomer = {
  id: string;
  business_unit_id: string;
  nombre: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  direccion: string | null;
  crm_status: string;
  stage: string;
  total_orders: number;
  total_spent: number;
  channels: string[];
  instagram_username: string | null;
  instagram_name: string | null;
  conversation_labels: string[];
  last_contact_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  metadata: JsonRecord;
};

export type CustomerDetail = {
  customer: AdminCustomer;
  notes: JsonRecord[];
  allTags: JsonRecord[];
  assignedTags: JsonRecord[];
  unassignedTags: JsonRecord[];
  activities: JsonRecord[];
  orders: AdminOrder[];
};

export function mapContactToAdminCustomer(row: JsonRecord): AdminCustomer {
  const metadata = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
  const channel = String(row.channel || 'manual');
  const phone = row.phone ?? metadata.phone ?? (channel === 'whatsapp' ? row.external_id : null);
  const email = row.email ?? metadata.email ?? null;
  const instagramUsername = metadata.instagram_username ? String(metadata.instagram_username) : null;
  const instagramName = metadata.instagram_name ? String(metadata.instagram_name) : null;
  const fallbackName = instagramName || (instagramUsername ? `@${instagramUsername}` : null);
  const nombre = String(row.nombre ?? row.display_name ?? fallbackName ?? metadata.name ?? `Contacto ${row.external_id || ''}`).trim();
  const status = String(row.crm_status ?? metadata.crm_status ?? 'new');
  return {
    id: String(row.id),
    business_unit_id: String(row.business_unit_id),
    nombre,
    full_name: nombre,
    email,
    phone,
    whatsapp: phone,
    direccion: row.direccion ?? metadata.address ?? null,
    crm_status: status,
    stage: status,
    total_orders: Number(row.total_orders ?? metadata.total_orders ?? 0),
    total_spent: Number(row.total_spent ?? metadata.total_spent ?? 0),
    channels: Array.from(new Set([channel, ...(Array.isArray(metadata.channels) ? metadata.channels : [])])),
    instagram_username: instagramUsername,
    instagram_name: instagramName,
    conversation_labels: Array.isArray(row.conversation_labels) ? row.conversation_labels.map(String) : [],
    last_contact_at: row.last_order_at ?? row.updated_at ?? null,
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
    metadata,
  };
}

export class CustomerRepository {
  private readonly capabilities: SchemaCapabilities;

  constructor(
    private readonly db: SupabaseClient,
    capabilities: SchemaCapabilities = getSchemaCapabilities(),
  ) {
    this.capabilities = capabilities;
  }

  private async upsertIdentities(
    businessUnitId: string,
    customerId: string,
    identities: JsonRecord[],
  ): Promise<void> {
    if (!this.capabilities.customerCrm || identities.length === 0) return;
    const rows = identities.map((identity) => ({
      business_unit_id: businessUnitId,
      customer_id: customerId,
      provider: identity.provider,
      identity_type: identity.identity_type,
      external_id: identity.external_id,
      normalized_value: identity.normalized_value,
      verified: false,
      updated_at: new Date().toISOString(),
    }));
    const { error } = await this.db
      .from('customer_identities')
      .upsert(rows, { onConflict: 'business_unit_id,provider,external_id' });
    if (error) throw error;
  }

  private async attachConversationLabels(customers: AdminCustomer[]): Promise<AdminCustomer[]> {
    const customerIds = customers.map((customer) => customer.id);
    if (customerIds.length === 0) return customers;

    const [{ data: byCustomer, error: customerError }, { data: byContact, error: contactError }] = await Promise.all([
      this.db.from('conversations').select('customer_id,contact_id,labels').in('customer_id', customerIds),
      this.db.from('conversations').select('customer_id,contact_id,labels').in('contact_id', customerIds),
    ]);
    const error = customerError || contactError;
    if (error) throw error;

    const wanted = new Set(customerIds);
    const labelMap = new Map<string, Set<string>>();
    for (const row of [...(byCustomer || []), ...(byContact || [])] as JsonRecord[]) {
      const ids = [row.customer_id, row.contact_id].filter((value): value is string => typeof value === 'string' && wanted.has(value));
      for (const id of ids) {
        const labels = labelMap.get(id) || new Set<string>();
        for (const label of Array.isArray(row.labels) ? row.labels : []) {
          const normalized = String(label || '').trim().toLowerCase();
          if (normalized && normalized !== 'personal') labels.add(normalized);
        }
        labelMap.set(id, labels);
      }
    }

    return customers.map((customer) => ({
      ...customer,
      conversation_labels: Array.from(labelMap.get(customer.id) || []).sort(),
    }));
  }

  async list(filters: { crmStatus?: string } = {}): Promise<AdminCustomer[]> {
    const { data, error } = await this.db.from('omnichannel_contacts').select('*');
    if (error) throw error;
    let customers = await this.attachConversationLabels((data || []).map(mapContactToAdminCustomer));
    if (filters.crmStatus && filters.crmStatus !== 'Todos') {
      customers = customers.filter((customer) => customer.crm_status === filters.crmStatus);
    }
    return customers.sort((a, b) => b.total_spent - a.total_spent);
  }

  async getById(id: string): Promise<AdminCustomer | null> {
    const { data, error } = await this.db
      .from('omnichannel_contacts')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const [customer] = await this.attachConversationLabels([mapContactToAdminCustomer(data)]);
    return customer || null;
  }

  async getDetail(id: string): Promise<CustomerDetail | null> {
    const customer = await this.getById(id);
    if (!customer) return null;
    if (!this.capabilities.supportTables) {
      return { customer, notes: [], allTags: [], assignedTags: [], unassignedTags: [], activities: [], orders: [] };
    }

    const [{ data: notes, error: notesError }, { data: allTags, error: tagsError }, { data: assignedRows, error: assignedError }, { data: activities, error: activityError }, orders] = await Promise.all([
      this.db.from('customer_notes').select('*').eq('customer_id', id).order('created_at', { ascending: false }),
      this.db.from('customer_tags').select('*').eq('business_unit_id', customer.business_unit_id),
      this.db.from('customer_tag_assignments').select('tag_id').eq('customer_id', id),
      this.db.from('crm_activities').select('*').eq('customer_id', id).order('created_at', { ascending: false }),
      new OrderRepository(this.db, this.capabilities).list({ customerId: id }),
    ]);
    const error = notesError || tagsError || assignedError || activityError;
    if (error) throw error;
    const assignedIds = new Set((assignedRows || []).map((row: JsonRecord) => row.tag_id));
    const tags = allTags || [];
    return {
      customer,
      notes: notes || [],
      allTags: tags,
      assignedTags: tags.filter((tag: JsonRecord) => assignedIds.has(tag.id)),
      unassignedTags: tags.filter((tag: JsonRecord) => !assignedIds.has(tag.id)),
      activities: activities || [],
      orders,
    };
  }

  async resolveIdentity(
    businessUnitId: string,
    input: { channel: string; externalId: string; phone?: string; email?: string; name?: string | null },
  ): Promise<string> {
    const phone = input.phone ? normalizePhone(input.phone) : null;
    const email = input.email?.trim().toLowerCase() || null;
    const identityCandidates = [
      { provider: input.channel, identity_type: 'platform_user_id', external_id: input.externalId, normalized_value: input.externalId },
      phone && { provider: 'manual', identity_type: 'phone', external_id: phone, normalized_value: phone },
      email && { provider: 'manual', identity_type: 'email', external_id: email, normalized_value: email },
    ].filter(Boolean) as JsonRecord[];

    if (this.capabilities.customerCrm) {
      for (const candidate of identityCandidates) {
        const { data, error } = await this.db
          .from('customer_identities')
          .select('customer_id')
          .eq('business_unit_id', businessUnitId)
          .eq('provider', candidate.provider)
          .eq('external_id', candidate.external_id)
          .maybeSingle();
        if (error) throw error;
        if (data?.customer_id) {
          await this.upsertIdentities(businessUnitId, data.customer_id, identityCandidates);
          return data.customer_id;
        }
      }
    }

    let query = this.db
      .from('omnichannel_contacts')
      .select('id')
      .eq('business_unit_id', businessUnitId);
    if (this.capabilities.customerCrm && phone) query = query.eq('phone', phone);
    else if (this.capabilities.customerCrm && email) query = query.eq('email', email);
    else query = query.eq('channel', input.channel).eq('external_id', input.externalId);
    const { data: existing, error: existingError } = await query.maybeSingle();
    if (existingError) throw existingError;
    if (existing?.id) {
      if (this.capabilities.customerCrm) {
        await this.upsertIdentities(businessUnitId, existing.id, identityCandidates);
      }
      return existing.id;
    }

    const insert: JsonRecord = {
      business_unit_id: businessUnitId,
      channel: input.channel,
      external_id: input.externalId,
      display_name: input.name ?? null,
      metadata: { phone, email },
    };
    if (this.capabilities.customerCrm) {
      insert.phone = phone;
      insert.email = email;
      insert.nombre = input.name || `Cliente ${phone || email || input.externalId}`;
      insert.crm_status = 'new';
    }
    const { data: created, error: createError } = await this.db
      .from('omnichannel_contacts')
      .insert(insert)
      .select('id')
      .single();
    if (createError) throw createError;
    if (this.capabilities.customerCrm) {
      await this.upsertIdentities(businessUnitId, created.id, identityCandidates);
    }
    return created.id;
  }

  async upsertCheckoutContact(
    businessUnitId: string,
    input: { email?: string | null; phone: string; nombre: string; direccion?: string | null; comuna?: string | null },
    preferredCustomerId?: string | null,
  ): Promise<AdminCustomer> {
    requireSchemaCapability(this.capabilities, 'customerCrm');
    const email = input.email?.trim().toLowerCase() || null;
    const phone = normalizePhone(input.phone);
    let existing: JsonRecord | null = null;

    if (preferredCustomerId) {
      const result = await this.db
        .from('omnichannel_contacts')
        .select('*')
        .eq('business_unit_id', businessUnitId)
        .eq('id', preferredCustomerId)
        .maybeSingle();
      if (result.error) throw result.error;
      existing = result.data;
    }
    if (!existing && email) {
      const result = await this.db.from('omnichannel_contacts').select('*').eq('business_unit_id', businessUnitId).eq('email', email).maybeSingle();
      if (result.error) throw result.error;
      existing = result.data;
    }
    if (!existing) {
      const result = await this.db.from('omnichannel_contacts').select('*').eq('business_unit_id', businessUnitId).eq('phone', phone).maybeSingle();
      if (result.error) throw result.error;
      existing = result.data;
    }
    if (existing) {
      const metadata = existing.metadata && typeof existing.metadata === 'object' ? existing.metadata : {};
      const { data, error } = await this.db
        .from('omnichannel_contacts')
        .update({
          email: email ?? existing.email,
          phone,
          nombre: input.nombre,
          direccion: input.direccion ?? existing.direccion ?? null,
          crm_status: 'customer',
          metadata: input.comuna ? { ...metadata, comuna: input.comuna } : metadata,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select('*')
        .single();
      if (error) throw error;
      await this.upsertIdentities(businessUnitId, data.id, [
        { provider: 'manual', identity_type: 'phone', external_id: phone, normalized_value: phone },
        ...(email ? [{ provider: 'manual', identity_type: 'email', external_id: email, normalized_value: email }] : []),
      ]);
      return mapContactToAdminCustomer(data);
    }
    const { data, error } = await this.db
      .from('omnichannel_contacts')
      .insert({
        business_unit_id: businessUnitId,
        channel: 'web',
        external_id: email || phone,
        display_name: input.nombre,
        metadata: input.comuna ? { comuna: input.comuna } : {},
        email,
        phone,
        nombre: input.nombre,
        direccion: input.direccion ?? null,
        crm_status: 'customer',
        total_orders: 0,
        total_spent: 0,
      })
      .select('*')
      .single();
    if (error) throw error;
    await this.upsertIdentities(businessUnitId, data.id, [
      { provider: 'manual', identity_type: 'phone', external_id: phone, normalized_value: phone },
      ...(email ? [{ provider: 'manual', identity_type: 'email', external_id: email, normalized_value: email }] : []),
    ]);
    return mapContactToAdminCustomer(data);
  }

  async update(id: string, input: JsonRecord): Promise<AdminCustomer> {
    requireSchemaCapability(this.capabilities, 'customerCrm');
    const allowed = ['nombre', 'email', 'phone', 'direccion', 'crm_status'];
    const update = Object.fromEntries(Object.entries(input).filter(([key]) => allowed.includes(key)));
    const { data, error } = await this.db
      .from('omnichannel_contacts')
      .update({ ...update, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return mapContactToAdminCustomer(data);
  }

  async recordOrder(id: string, total: number): Promise<AdminCustomer> {
    requireSchemaCapability(this.capabilities, 'customerCrm');
    const current = await this.getById(id);
    if (!current) throw new Error('Contacto no encontrado.');
    const { data, error } = await this.db
      .from('omnichannel_contacts')
      .update({
        total_orders: current.total_orders + 1,
        total_spent: current.total_spent + total,
        last_order_at: new Date().toISOString(),
        crm_status: 'customer',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return mapContactToAdminCustomer(data);
  }

  async addActivity(customerId: string, activity: JsonRecord): Promise<void> {
    requireSchemaCapability(this.capabilities, 'supportTables');
    const { error } = await this.db.from('crm_activities').insert({ customer_id: customerId, ...activity });
    if (error) throw error;
  }

  async addNote(customerId: string, content: string, createdBy: string): Promise<void> {
    requireSchemaCapability(this.capabilities, 'supportTables');
    const { error } = await this.db.from('customer_notes').insert({
      customer_id: customerId,
      content,
      created_by: createdBy,
    });
    if (error) throw error;
  }

  async deleteNote(noteId: string): Promise<void> {
    requireSchemaCapability(this.capabilities, 'supportTables');
    const { error } = await this.db.from('customer_notes').delete().eq('id', noteId);
    if (error) throw error;
  }

  async assignTag(customerId: string, tagId: string): Promise<string | null> {
    requireSchemaCapability(this.capabilities, 'supportTables');
    const { data: tag, error: tagError } = await this.db.from('customer_tags').select('name').eq('id', tagId).single();
    if (tagError) throw tagError;
    const { error } = await this.db.from('customer_tag_assignments').insert({ customer_id: customerId, tag_id: tagId });
    if (error) throw error;
    return tag?.name ?? null;
  }

  async unassignTag(customerId: string, tagId: string): Promise<string | null> {
    requireSchemaCapability(this.capabilities, 'supportTables');
    const { data: tag, error: tagError } = await this.db.from('customer_tags').select('name').eq('id', tagId).single();
    if (tagError) throw tagError;
    const { error } = await this.db
      .from('customer_tag_assignments')
      .delete()
      .eq('customer_id', customerId)
      .eq('tag_id', tagId);
    if (error) throw error;
    return tag?.name ?? null;
  }
}
