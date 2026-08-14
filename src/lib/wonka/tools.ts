import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

export type WonkaToolContext = {
  actorType: 'wonka' | 'mcp' | 'admin';
  actorId?: string | null;
  allowWrite?: boolean;
};

export type WonkaTool = {
  name: string;
  description: string;
  write: boolean;
  inputSchema: Record<string, unknown>;
};

export const WONKA_TOOLS: WonkaTool[] = [
  {
    name: 'business_overview',
    description: 'Resumen operativo actual: pedidos recientes, conversaciones abiertas, clientes CRM y reservas próximas.',
    write: false,
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'recent_orders',
    description: 'Lista pedidos recientes con cliente, total, estado, pago y canal de origen.',
    write: false,
    inputSchema: {
      type: 'object',
      properties: { limit: { type: 'integer', minimum: 1, maximum: 30 } },
      additionalProperties: false,
    },
  },
  {
    name: 'recent_conversations',
    description: 'Lista conversaciones recientes de WhatsApp, Instagram o web, incluyendo estado de IA y takeover humano.',
    write: false,
    inputSchema: {
      type: 'object',
      properties: { channel: { type: 'string', enum: ['whatsapp', 'instagram', 'web'] }, limit: { type: 'integer', minimum: 1, maximum: 30 } },
      additionalProperties: false,
    },
  },
  {
    name: 'customer_search',
    description: 'Busca clientes CRM por nombre, teléfono, email o identificador externo.',
    write: false,
    inputSchema: {
      type: 'object',
      properties: { query: { type: 'string', minLength: 1 } },
      required: ['query'],
      additionalProperties: false,
    },
  },
  {
    name: 'catalog_search',
    description: 'Busca productos activos del catálogo y devuelve precio, disponibilidad y stock.',
    write: false,
    inputSchema: {
      type: 'object',
      properties: { query: { type: 'string' }, limit: { type: 'integer', minimum: 1, maximum: 40 } },
      additionalProperties: false,
    },
  },
  {
    name: 'set_remy_global',
    description: 'Activa o pausa la respuesta automática global de Remy. Es una acción de escritura y requiere permiso explícito.',
    write: true,
    inputSchema: {
      type: 'object',
      properties: { enabled: { type: 'boolean' } },
      required: ['enabled'],
      additionalProperties: false,
    },
  },
  {
    name: 'set_conversation_ai',
    description: 'Activa o pausa Remy en una conversación concreta. Es una acción de escritura y requiere permiso explícito.',
    write: true,
    inputSchema: {
      type: 'object',
      properties: { conversation_id: { type: 'string' }, enabled: { type: 'boolean' } },
      required: ['conversation_id', 'enabled'],
      additionalProperties: false,
    },
  },
];

async function audit(db: SupabaseClient, ctx: WonkaToolContext, toolName: string, args: unknown, result: unknown, status = 'ok') {
  await db.from('wonka_tool_audit').insert({
    actor_type: ctx.actorType,
    actor_id: ctx.actorId || null,
    tool_name: toolName,
    arguments: args || {},
    result: result ?? null,
    status,
  });
}

export async function runWonkaTool(db: SupabaseClient, toolName: string, args: any, ctx: WonkaToolContext) {
  const definition = WONKA_TOOLS.find((tool) => tool.name === toolName);
  if (!definition) throw new Error('unknown_tool');
  if (definition.write && !ctx.allowWrite) throw new Error('write_confirmation_required');

  let result: any;
  try {
    if (toolName === 'business_overview') {
      const now = new Date();
      const today = now.toISOString().slice(0, 10);
      const [orders, conversations, customers, reservations] = await Promise.all([
        db.from('pedidos').select('id,total,estado,payment_status,source_channel,created_at').order('created_at', { ascending: false }).limit(20),
        db.from('conversations').select('id,channel,status,unread_count,human_takeover,ai_enabled,last_message_at').order('last_message_at', { ascending: false }).limit(50),
        db.from('omnichannel_contacts').select('id,crm_status,total_spent,total_orders,last_order_at').limit(500),
        db.from('store_reservations').select('id,status,reservation_date,reservation_time,party_size').gte('reservation_date', today).order('reservation_date', { ascending: true }).limit(20),
      ]);
      const orderRows = orders.data || [];
      const conversationRows = conversations.data || [];
      result = {
        orders_recent: orderRows.length,
        sales_recent_total: orderRows.reduce((sum: number, row: any) => sum + Number(row.total || 0), 0),
        orders_pending: orderRows.filter((row: any) => !['entregado', 'cancelado', 'completed'].includes(String(row.estado || '').toLowerCase())).length,
        conversations: conversationRows.length,
        unread_messages: conversationRows.reduce((sum: number, row: any) => sum + Number(row.unread_count || 0), 0),
        human_takeovers: conversationRows.filter((row: any) => row.human_takeover).length,
        ai_enabled_conversations: conversationRows.filter((row: any) => row.ai_enabled).length,
        crm_customers: (customers.data || []).length,
        upcoming_reservations: (reservations.data || []).length,
      };
    } else if (toolName === 'recent_orders') {
      const limit = Math.max(1, Math.min(30, Number(args?.limit || 10)));
      const { data, error } = await db.from('pedidos')
        .select('id,nombre_cliente,telefono,total,estado,payment_status,source_channel,fecha_entrega,created_at')
        .order('created_at', { ascending: false }).limit(limit);
      if (error) throw error;
      result = data || [];
    } else if (toolName === 'recent_conversations') {
      const limit = Math.max(1, Math.min(30, Number(args?.limit || 10)));
      let query = db.from('conversations')
        .select('id,channel,external_conversation_id,status,unread_count,human_takeover,ai_enabled,last_message_at,customer_id')
        .order('last_message_at', { ascending: false }).limit(limit);
      if (args?.channel) query = query.eq('channel', String(args.channel));
      const { data, error } = await query;
      if (error) throw error;
      result = data || [];
    } else if (toolName === 'customer_search') {
      const q = String(args?.query || '').trim();
      if (!q) throw new Error('query_required');
      const pattern = `%${q.replace(/[%_]/g, '')}%`;
      const { data, error } = await db.from('omnichannel_contacts')
        .select('id,nombre,display_name,phone,email,external_id,crm_status,total_spent,total_orders,last_order_at,channel')
        .or(`nombre.ilike.${pattern},display_name.ilike.${pattern},phone.ilike.${pattern},email.ilike.${pattern},external_id.ilike.${pattern}`)
        .limit(20);
      if (error) throw error;
      result = data || [];
    } else if (toolName === 'catalog_search') {
      const limit = Math.max(1, Math.min(40, Number(args?.limit || 20)));
      const q = String(args?.query || '').trim();
      let query = db.from('productos')
        .select('id,nombre,precio,disponibilidad,maneja_stock,stock,categoria,slug')
        .eq('activo', true).order('nombre').limit(limit);
      if (q) query = query.ilike('nombre', `%${q.replace(/[%_]/g, '')}%`);
      const { data, error } = await query;
      if (error) throw error;
      result = data || [];
    } else if (toolName === 'set_remy_global') {
      const enabled = Boolean(args?.enabled);
      const { error } = await db.from('integraciones_secretas').update({ ai_enabled: enabled, updated_at: new Date().toISOString() }).eq('id', 'global');
      if (error) throw error;
      result = { ok: true, ai_enabled: enabled };
    } else if (toolName === 'set_conversation_ai') {
      const id = String(args?.conversation_id || '');
      if (!id) throw new Error('conversation_id_required');
      const enabled = Boolean(args?.enabled);
      const { data, error } = await db.from('conversations').update({ ai_enabled: enabled, updated_at: new Date().toISOString() }).eq('id', id).select('id,ai_enabled').maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('conversation_not_found');
      result = data;
    } else {
      throw new Error('unknown_tool');
    }

    await audit(db, ctx, toolName, args, result, 'ok');
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'tool_failed';
    await audit(db, ctx, toolName, args, { error: message }, 'error').catch(() => undefined);
    throw error;
  }
}
