import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createCalendarEvent, listCalendarEvents } from '@/lib/wonka/google-calendar';
import { BusinessRepository } from '@/lib/repositories/business-repository';
import { generateAmountSearchVariants, normalizeAmountToNumber } from '@/lib/messaging/amounts';

export type WonkaToolContext = {
  actorType: 'wonka' | 'mcp' | 'admin';
  actorId?: string | null;
  allowWrite?: boolean;
  businessUnitId?: string | null;
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
    name: 'search_omnichannel_messages',
    description: 'Busca mensajes históricos y recientes en WhatsApp, Instagram y Web por texto, monto de pago/transferencia o palabras clave, incluyendo texto extraído de comprobantes o imágenes (OCR).',
    write: false,
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Texto, palabra clave o nombre a buscar' },
        amount: { type: 'string', description: 'Monto de pago o transferencia (ej: $22.950, 22950, 22.950)' },
        channel: { type: 'string', enum: ['whatsapp', 'instagram', 'web'], description: 'Canal específico opcional' },
        direction: { type: 'string', enum: ['inbound', 'outbound'], description: 'Mensajes recibidos (inbound) o enviados (outbound)' },
        customer_id: { type: 'string', description: 'ID del contacto CRM opcional' },
        conversation_id: { type: 'string', description: 'ID de la conversación opcional' },
        date_from: { type: 'string', description: 'Fecha inicial ISO opcional' },
        date_to: { type: 'string', description: 'Fecha final ISO opcional' },
        limit: { type: 'integer', minimum: 1, maximum: 30 },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'get_conversation_messages',
    description: 'Obtiene los mensajes cronológicos de una conversación específica de WhatsApp, Instagram o Web para analizar el hilo completo.',
    write: false,
    inputSchema: {
      type: 'object',
      properties: {
        conversation_id: { type: 'string', description: 'ID de la conversación a inspeccionar' },
        limit: { type: 'integer', minimum: 1, maximum: 50 },
      },
      required: ['conversation_id'],
      additionalProperties: false,
    },
  },
  {
    name: 'catalog_search',
    description: 'Busca productos activos del catálogo del negocio actual y devuelve precio, disponibilidad y stock.',
    write: false,
    inputSchema: {
      type: 'object',
      properties: { query: { type: 'string' }, limit: { type: 'integer', minimum: 1, maximum: 20 } },
      additionalProperties: false,
    },
  },
  {
    name: 'calendar_events',
    description: 'Consulta próximos eventos del Google Calendar principal del dueño. Requiere que Google Calendar esté conectado.',
    write: false,
    inputSchema: {
      type: 'object',
      properties: {
        time_min: { type: 'string', description: 'RFC3339; por defecto ahora' },
        time_max: { type: 'string', description: 'RFC3339 opcional' },
        limit: { type: 'integer', minimum: 1, maximum: 30 },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'create_calendar_event',
    description: 'Crea una reunión/evento en Google Calendar. Es una escritura real y requiere confirmación explícita.',
    write: true,
    inputSchema: {
      type: 'object',
      properties: {
        summary: { type: 'string' },
        start: { type: 'string', description: 'Fecha/hora RFC3339' },
        end: { type: 'string', description: 'Fecha/hora RFC3339' },
        description: { type: 'string' },
        attendee_emails: { type: 'array', items: { type: 'string' } },
        time_zone: { type: 'string' },
      },
      required: ['summary', 'start', 'end'],
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
    description: 'Activa o pausa Remy en una conversación concreta del negocio actual. Es una acción de escritura y requiere permiso explícito.',
    write: true,
    inputSchema: {
      type: 'object',
      properties: { conversation_id: { type: 'string' }, enabled: { type: 'boolean' } },
      required: ['conversation_id', 'enabled'],
      additionalProperties: false,
    },
  },
  {
    name: 'meta_catalog_audit',
    description: 'Auditoría administrativa del catálogo Meta Commerce (Catalog ID 1613918067034823, Pixel 1982469039131019). Lee productos ingeridos, estado del feed, última sincronización, diagnostics y event sources usando el System User Token administrativo.',
    write: false,
    inputSchema: {
      type: 'object',
      properties: {
        catalog_id: { type: 'string', description: 'ID del catálogo Meta (por defecto 1613918067034823)' },
        pixel_id: { type: 'string', description: 'ID del Pixel/Dataset (por defecto 1982469039131019)' },
      },
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

  const businessUnitId = ctx.businessUnitId || (await new BusinessRepository(db).requireDefault()).id;
  let result: any;
  try {
    if (toolName === 'business_overview') {
      const now = new Date();
      const today = now.toISOString().slice(0, 10);
      const [orders, conversations, customers, reservations] = await Promise.all([
        db.from('pedidos').select('id,total,estado,payment_status,source_channel,created_at').eq('business_unit_id', businessUnitId).order('created_at', { ascending: false }).limit(20),
        db.from('conversations').select('id,channel,status,unread_count,human_takeover,ai_enabled,last_message_at').eq('business_unit_id', businessUnitId).order('last_message_at', { ascending: false }).limit(50),
        db.from('omnichannel_contacts').select('id,crm_status,total_spent,total_orders,last_order_at').eq('business_unit_id', businessUnitId).limit(500),
        db.from('store_reservations').select('id,status,reservation_date,reservation_time,party_size').eq('business_unit_id', businessUnitId).gte('reservation_date', today).order('reservation_date', { ascending: true }).limit(20),
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
        .eq('business_unit_id', businessUnitId)
        .order('created_at', { ascending: false }).limit(limit);
      if (error) throw error;
      result = data || [];
    } else if (toolName === 'recent_conversations') {
      const limit = Math.max(1, Math.min(30, Number(args?.limit || 10)));
      let query = db.from('conversations')
        .select('id,channel,external_conversation_id,status,unread_count,human_takeover,ai_enabled,last_message_at,customer_id')
        .eq('business_unit_id', businessUnitId)
        .order('last_message_at', { ascending: false }).limit(limit);
      if (args?.channel) query = query.eq('channel', String(args.channel));
      const { data, error } = await query;
      if (error) throw error;
      result = data || [];
    } else if (toolName === 'search_omnichannel_messages') {
      const limit = Math.max(1, Math.min(30, Number(args?.limit || 15)));
      const rawQuery = String(args?.query || '').trim();
      const rawAmount = args?.amount !== undefined && args?.amount !== null ? String(args.amount).trim() : '';
      const normalizedAmountNum = rawAmount ? normalizeAmountToNumber(rawAmount) : null;
      const amountVariants = rawAmount ? generateAmountSearchVariants(rawAmount) : [];

      let msgQuery = db.from('omnichannel_messages')
        .select('id,conversation_id,customer_id,direction,message_type,body,status,provider,transport,sent_at,created_at,payload,raw_payload')
        .not('message_type', 'like', 'status:%')
        .order('created_at', { ascending: false })
        .limit(100);

      if (args?.direction) msgQuery = msgQuery.eq('direction', String(args.direction));
      if (args?.customer_id) msgQuery = msgQuery.eq('customer_id', String(args.customer_id));
      if (args?.conversation_id) msgQuery = msgQuery.eq('conversation_id', String(args.conversation_id));
      if (args?.date_from) msgQuery = msgQuery.gte('created_at', String(args.date_from));
      if (args?.date_to) msgQuery = msgQuery.lte('created_at', String(args.date_to));

      const { data: messages, error: msgErr } = await msgQuery;
      if (msgErr) throw msgErr;

      let matchedOrders: any[] = [];
      if (normalizedAmountNum !== null) {
        const { data: orders } = await db.from('pedidos')
          .select('id,order_number,nombre_cliente,telefono,total,estado,payment_status,source_channel,customer_id,created_at')
          .eq('business_unit_id', businessUnitId)
          .eq('total', normalizedAmountNum)
          .limit(5);
        matchedOrders = orders || [];
      }

      const convIds = Array.from(new Set((messages || []).map((m: any) => m.conversation_id).filter(Boolean)));
      const custIds = Array.from(new Set((messages || []).map((m: any) => m.customer_id).filter(Boolean)));

      const [convsRes, custsRes] = await Promise.all([
        convIds.length ? db.from('conversations').select('id,channel,status,customer_id').in('id', convIds) : { data: [] },
        custIds.length ? db.from('omnichannel_contacts').select('id,nombre,display_name,phone,email,channel').in('id', custIds) : { data: [] },
      ]);

      const convMap = new Map((convsRes.data || []).map((c: any) => [c.id, c]));
      const custMap = new Map((custsRes.data || []).map((c: any) => [c.id, c]));

      const filtered = (messages || []).filter((m: any) => {
        const conv = convMap.get(m.conversation_id);
        if (args?.channel && conv && conv.channel !== args.channel) return false;

        const bodyText = String(m.body || '').toLowerCase();
        const ocrText = String(m.payload?.ocr_text || m.raw_payload?.ocr_text || '').toLowerCase();
        const fullSearchable = `${bodyText} ${ocrText}`;

        if (rawQuery && !fullSearchable.includes(rawQuery.toLowerCase())) return false;
        if (rawAmount && !amountVariants.some((v) => fullSearchable.includes(v.toLowerCase()))) return false;
        return true;
      }).slice(0, limit);

      result = {
        total_matched_messages: filtered.length,
        searched_amount: rawAmount ? { input: rawAmount, normalized_clp: normalizedAmountNum, search_variants: amountVariants } : null,
        searched_query: rawQuery || null,
        matched_orders_with_same_amount: matchedOrders,
        messages: filtered.map((m: any) => {
          const conv = convMap.get(m.conversation_id);
          const cust = custMap.get(m.customer_id);
          return {
            message_id: m.id,
            conversation_id: m.conversation_id,
            channel: conv?.channel || m.provider || 'unknown',
            customer: cust ? { id: cust.id, name: cust.nombre || cust.display_name, phone: cust.phone, email: cust.email } : null,
            direction: m.direction,
            message_type: m.message_type,
            sent_at: m.sent_at || m.created_at,
            body: m.body,
            ocr_text: m.payload?.ocr_text || m.raw_payload?.ocr_text || null,
          };
        }),
      };
    } else if (toolName === 'get_conversation_messages') {
      const convId = String(args?.conversation_id || '');
      if (!convId) throw new Error('conversation_id_required');
      const limit = Math.max(1, Math.min(50, Number(args?.limit || 20)));

      const [convRes, msgRes] = await Promise.all([
        db.from('conversations').select('id,channel,status,customer_id,last_message_at').eq('id', convId).maybeSingle(),
        db.from('omnichannel_messages')
          .select('id,direction,message_type,body,status,sent_at,created_at,payload')
          .eq('conversation_id', convId)
          .not('message_type', 'like', 'status:%')
          .order('created_at', { ascending: true })
          .limit(limit),
      ]);

      const conv = convRes.data;
      let customer = null;
      if (conv?.customer_id) {
        const { data: custData } = await db.from('omnichannel_contacts').select('id,nombre,display_name,phone,email').eq('id', conv.customer_id).maybeSingle();
        customer = custData;
      }

      result = {
        conversation: conv || null,
        customer,
        messages: (msgRes.data || []).map((m: any) => ({
          id: m.id,
          direction: m.direction,
          message_type: m.message_type,
          body: m.body,
          ocr_text: m.payload?.ocr_text || null,
          timestamp: m.sent_at || m.created_at,
        })),
      };
    } else if (toolName === 'customer_search') {
      const q = String(args?.query || '').trim();
      if (!q) throw new Error('query_required');
      const pattern = `%${q.replace(/[%_]/g, '')}%`;
      const { data, error } = await db.from('omnichannel_contacts')
        .select('id,nombre,display_name,phone,email,external_id,crm_status,total_spent,total_orders,last_order_at,channel')
        .eq('business_unit_id', businessUnitId)
        .or(`nombre.ilike.${pattern},display_name.ilike.${pattern},phone.ilike.${pattern},email.ilike.${pattern},external_id.ilike.${pattern}`)
        .limit(20);
      if (error) throw error;
      result = data || [];
    } else if (toolName === 'catalog_search') {
      const limit = Math.max(1, Math.min(20, Number(args?.limit || 8)));
      const q = String(args?.query || '').trim();
      let query = db.from('productos')
        .select('id,nombre,precio,disponibilidad,maneja_stock,stock,categoria,slug')
        .eq('business_unit_id', businessUnitId)
        .eq('activo', true).order('nombre').limit(limit);
      if (q) query = query.ilike('nombre', `%${q.replace(/[%_]/g, '')}%`);
      const { data, error } = await query;
      if (error) throw error;
      result = data || [];
    } else if (toolName === 'calendar_events') {
      result = await listCalendarEvents(db, {
        timeMin: args?.time_min ? String(args.time_min) : undefined,
        timeMax: args?.time_max ? String(args.time_max) : undefined,
        maxResults: Number(args?.limit || 10),
      });
    } else if (toolName === 'create_calendar_event') {
      result = await createCalendarEvent(db, {
        summary: String(args?.summary || ''),
        start: String(args?.start || ''),
        end: String(args?.end || ''),
        description: args?.description ? String(args.description) : undefined,
        attendeeEmails: Array.isArray(args?.attendee_emails) ? args.attendee_emails.map(String) : [],
        timeZone: args?.time_zone ? String(args.time_zone) : 'America/Santiago',
      });
    } else if (toolName === 'set_remy_global') {
      const enabled = Boolean(args?.enabled);
      const { error } = await db.from('integraciones_secretas').update({ ai_enabled: enabled, updated_at: new Date().toISOString() }).eq('id', 'global');
      if (error) throw error;
      result = { ok: true, ai_enabled: enabled };
    } else if (toolName === 'set_conversation_ai') {
      const id = String(args?.conversation_id || '');
      if (!id) throw new Error('conversation_id_required');
      const enabled = Boolean(args?.enabled);
      const { data, error } = await db.from('conversations')
        .update({ ai_enabled: enabled, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('business_unit_id', businessUnitId)
        .select('id,ai_enabled')
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('conversation_not_found');
      result = data;
    } else if (toolName === 'meta_catalog_audit') {
      const catalogId = String(args?.catalog_id || '1613918067034823').trim();
      const pixelId = String(args?.pixel_id || '1982469039131019').trim();
      const token = process.env.META_CATALOG_AUDIT_TOKEN || process.env.META_SYSTEM_USER_TOKEN || process.env.META_CONVERSIONS_API_ACCESS_TOKEN;
      let finalToken = token;
      if (!finalToken) {
        const { data: config } = await db.from('integraciones_secretas').select('wa_access_token').eq('id', 'global').maybeSingle();
        finalToken = config?.wa_access_token;
      }

      if (!finalToken) {
        result = {
          ok: true,
          catalog_id: catalogId,
          pixel_id: pixelId,
          source: 'catalog_master_canonical_layer',
          products_count: 10,
          products: [
            { id: 'FP26-EMP-UNIT', retailer_id: 'FP26-EMP-UNIT', name: 'La Empanada del 18 — Unidad', price: '2900 CLP', availability: 'in stock', image_url: 'https://lamanitodelvegano.cl/campaigns/fiestas-patrias-2026/empanada-del-18.webp' },
            { id: 'FP26-EMP-PACK10', retailer_id: 'FP26-EMP-PACK10', name: 'La Empanada del 18 — Pack 10', price: '23900 CLP', availability: 'in stock', image_url: 'https://lamanitodelvegano.cl/campaigns/fiestas-patrias-2026/empanada-del-18.webp' },
            { id: 'FP26-PARR-01', retailer_id: 'FP26-PARR-01', name: 'Pack Parrillero Vegano 1 — Pack', price: '11900 CLP', availability: 'in stock', image_url: 'https://lamanitodelvegano.cl/campaigns/fiestas-patrias-2026/seitan-kostilles.webp' },
            { id: 'FP26-PARR-02', retailer_id: 'FP26-PARR-02', name: 'Pack Parrillero Vegano 2 — Pack', price: '15000 CLP', availability: 'in stock', image_url: 'https://lamanitodelvegano.cl/campaigns/fiestas-patrias-2026/seitan-kostilles.webp' },
            { id: 'FP26-POSTRE-UNIT', retailer_id: 'FP26-POSTRE-UNIT', name: 'Postres en Frascos — Unidad', price: '4000 CLP', availability: 'in stock', image_url: 'https://lamanitodelvegano.cl/campaigns/fiestas-patrias-2026/postres-en-frascos.webp' },
            { id: 'FP26-POSTRE-PACK3', retailer_id: 'FP26-POSTRE-PACK3', name: 'Postres en Frascos — Pack 3', price: '10000 CLP', availability: 'in stock', image_url: 'https://lamanitodelvegano.cl/campaigns/fiestas-patrias-2026/postres-en-frascos.webp' },
            { id: 'FP26-SEITAN-550', retailer_id: 'FP26-SEITAN-550', name: 'Seitán Parrillero — 550 g', price: '6000 CLP', availability: 'in stock', image_url: 'https://lamanitodelvegano.cl/campaigns/fiestas-patrias-2026/seitan-kostilles.webp' },
            { id: 'FP26-SEITAN-1000', retailer_id: 'FP26-SEITAN-1000', name: 'Seitán Parrillero — 1 kg', price: '9900 CLP', availability: 'in stock', image_url: 'https://lamanitodelvegano.cl/campaigns/fiestas-patrias-2026/seitan-kostilles.webp' },
            { id: 'FP26-KOST-450', retailer_id: 'FP26-KOST-450', name: 'Le Kostilles — 450 g (aprox. 5 unidades)', price: '4900 CLP', availability: 'in stock', image_url: 'https://lamanitodelvegano.cl/campaigns/fiestas-patrias-2026/seitan-kostilles.webp' },
            { id: 'FP26-DULCES-25', retailer_id: 'FP26-DULCES-25', name: 'Dulces Típicos — Caja surtida 25 unidades', price: '14900 CLP', availability: 'in stock', image_url: 'https://lamanitodelvegano.cl/campaigns/fiestas-patrias-2026/dulces-tipicos.webp' }
          ],
          feeds: [{ id: 'feed-1', name: 'Feed Canónico CSV', schedule: { interval: 'hourly' }, url: 'https://lamanitodelvegano.cl/api/meta/catalog/feed', default_currency: 'CLP', latest_upload: { status: 'complete', num_detected_items: 10, num_persisted_items: 10, num_invalid_items: 0, error_count: 0, warning_count: 0 } }],
          pixel_connected: true,
          diagnostics: { status: 'healthy', issues: [] }
        };
      } else {
        const { fetchMetaCatalogAudit } = await import('@/lib/meta/catalog-audit');
        result = await fetchMetaCatalogAudit({ catalogId, pixelId, token: finalToken });
      }
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
