import { createHash, timingSafeEqual } from 'node:crypto';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { MetaConnectionsRepository } from '@/lib/repositories/meta-connections-repository';

export const dynamic = 'force-dynamic';

const DEFAULT_BUSINESS_UNIT_ID = 'f3b57ce7-0796-40e5-94f1-07cb2b48ba85';
const INSTAGRAM_GRAPH = 'https://graph.instagram.com';

type GraphPage<T> = {
  data?: T[];
  paging?: { next?: string; cursors?: { after?: string } };
};

type Participant = { id?: string; name?: string; username?: string };

type ConversationRow = {
  id?: string;
  updated_time?: string;
  participants?: { data?: Participant[] };
};

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function normalizedNeedle(value: string) {
  return value.trim().toLocaleLowerCase('es-CL').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function matchesNeedle(needle: string, ...values: Array<string | null | undefined>) {
  if (!needle) return true;
  return values.some((value) => normalizedNeedle(String(value || '')).includes(needle));
}

async function graphJson<T>(url: string, secretBearer: string): Promise<T> {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${secretBearer}` },
    cache: 'no-store',
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = String(body?.error?.message || 'unknown').replace(/[A-Za-z0-9_-]{40,}/g, '[redacted]');
    throw new Error(`instagram_history_scan_${response.status}:${message}`);
  }
  return body as T;
}

function nextCursor(page: GraphPage<unknown>) {
  const direct = page.paging?.cursors?.after;
  if (direct) return direct;
  const next = page.paging?.next;
  if (!next) return null;
  try {
    return new URL(next).searchParams.get('after');
  } catch {
    return null;
  }
}

async function listWindow(input: {
  version: string;
  businessInstagramId: string;
  secretBearer: string;
  offset: number;
  limit: number;
}) {
  const needed = input.offset + input.limit;
  const rows: ConversationRow[] = [];
  let after: string | null = null;

  while (rows.length < needed) {
    const cursor = after ? `&after=${encodeURIComponent(after)}` : '';
    const url = `${INSTAGRAM_GRAPH}/${input.version}/${encodeURIComponent(input.businessInstagramId)}/conversations?platform=instagram&fields=id,updated_time,participants&limit=25${cursor}`;
    const page = await graphJson<GraphPage<ConversationRow>>(url, input.secretBearer);
    const batch = Array.isArray(page.data) ? page.data : [];
    if (!batch.length) break;
    rows.push(...batch);
    after = nextCursor(page);
    if (!after) break;
  }

  return rows.slice(input.offset, input.offset + input.limit);
}

async function profileForParticipant(input: {
  version: string;
  userId: string;
  secretBearer: string;
}) {
  try {
    return await graphJson<{ id?: string; name?: string; username?: string }>(
      `${INSTAGRAM_GRAPH}/${input.version}/${encodeURIComponent(input.userId)}?fields=id,name,username`,
      input.secretBearer,
    );
  } catch {
    return { id: input.userId };
  }
}

async function loadMessageDetails(input: {
  version: string;
  conversationId: string;
  secretBearer: string;
  messageLimit: number;
}) {
  const detail = await graphJson<any>(
    `${INSTAGRAM_GRAPH}/${input.version}/${encodeURIComponent(input.conversationId)}?fields=messages.limit(${input.messageLimit}){id,created_time}`,
    input.secretBearer,
  );
  const refs = Array.isArray(detail?.messages?.data)
    ? detail.messages.data.slice(0, input.messageLimit)
    : [];
  const messages: any[] = [];

  for (let index = 0; index < refs.length; index += 5) {
    const batch = refs.slice(index, index + 5);
    const fetched = await Promise.all(batch.map(async (ref: any) => {
      const id = String(ref?.id || '');
      if (!id) return null;
      try {
        return await graphJson<any>(
          `${INSTAGRAM_GRAPH}/${input.version}/${encodeURIComponent(id)}?fields=id,created_time,from,to,message,attachments{image_data,video_data,file_url,mime_type,name}`,
          input.secretBearer,
        );
      } catch {
        return null;
      }
    }));
    messages.push(...fetched.filter(Boolean));
  }

  return messages.sort((a, b) => new Date(a?.created_time || 0).getTime() - new Date(b?.created_time || 0).getTime());
}

function counterpartyFromParticipants(row: ConversationRow, businessIds: Set<string>) {
  const participants = Array.isArray(row.participants?.data) ? row.participants!.data! : [];
  return participants.find((item) => {
    const id = String(item?.id || '');
    return id && !businessIds.has(id);
  }) || null;
}

function safeAttachments(message: any) {
  return (Array.isArray(message?.attachments?.data) ? message.attachments.data : Array.isArray(message?.attachments) ? message.attachments : [])
    .map((attachment: any) => {
      const imageUrl = typeof attachment?.image_data?.url === 'string' ? attachment.image_data.url : null;
      const videoUrl = typeof attachment?.video_data?.url === 'string' ? attachment.video_data.url : null;
      const fileUrl = typeof attachment?.file_url === 'string' ? attachment.file_url : null;
      const payloadUrl = typeof attachment?.payload?.url === 'string' ? attachment.payload.url : null;
      const mimeType = String(attachment?.mime_type || '');
      const type = imageUrl || mimeType.startsWith('image/')
        ? 'image'
        : videoUrl || mimeType.startsWith('video/')
          ? 'video'
          : 'file';
      return {
        type,
        url: imageUrl || videoUrl || fileUrl || payloadUrl,
        mimeType: mimeType || null,
        name: attachment?.name ? String(attachment.name) : null,
      };
    })
    .filter((attachment: { type: string; url: string | null }) => attachment.url || attachment.type);
}

function paymentRelevant(text: string) {
  return /pago|pagad|transfer|deposit|comprobante|baucher|voucher|total|22\.?950|22950|confirm/i.test(text);
}

async function run(request: Request) {
  const db = createSupabaseServiceClient();
  const { data: config, error } = await db
    .from('integraciones_secretas')
    .select('wa_verify_token')
    .eq('id', 'global')
    .maybeSingle();
  if (error) return Response.json({ error: 'config_read_failed' }, { status: 500 });

  const url = new URL(request.url);
  const key = request.headers.get('x-instagram-history-key') || url.searchParams.get('key') || '';
  const secret = String(config?.wa_verify_token || process.env.META_WEBHOOK_VERIFY_TOKEN || '');
  const expected = secret ? createHash('sha256').update(secret).digest('hex') : '';
  if (!key || !expected || !safeEqual(key, expected)) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const rawOffset = Number(url.searchParams.get('offset') || 0);
  const rawLimit = Number(url.searchParams.get('limit') || 10);
  const rawMessageLimit = Number(url.searchParams.get('message_limit') || 20);
  const offset = Number.isFinite(rawOffset) ? Math.max(0, Math.min(Math.trunc(rawOffset), 100)) : 0;
  const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(Math.trunc(rawLimit), 20)) : 10;
  const messageLimit = Number.isFinite(rawMessageLimit)
    ? Math.max(1, Math.min(Math.trunc(rawMessageLimit), 50))
    : 20;
  const needle = normalizedNeedle(url.searchParams.get('needle') || '');

  try {
    const businessUnitId = process.env.MANITO_BUSINESS_UNIT_ID || DEFAULT_BUSINESS_UNIT_ID;
    const repository = new MetaConnectionsRepository(db);
    const [credential, routingCredential] = await Promise.all([
      repository.getInstagramLoginCredential(businessUnitId),
      repository.getActiveCredential(businessUnitId, 'instagram_account'),
    ]);
    const secretBearer = credential.accessToken;
    const businessInstagramId = credential.externalId;
    const businessIds = new Set(
      [String(credential.externalId || ''), String(routingCredential.externalId || '')].filter(Boolean),
    );
    const version = process.env.META_GRAPH_VERSION || 'v26.0';

    const rows = await listWindow({ version, businessInstagramId, secretBearer, offset, limit });
    const results = [];

    for (const row of rows) {
      const conversationId = String(row?.id || '');
      if (!conversationId) continue;
      const participant = counterpartyFromParticipants(row, businessIds);
      const userId = String(participant?.id || '');
      const profile = userId
        ? await profileForParticipant({ version, userId, secretBearer })
        : { id: '', name: participant?.name, username: participant?.username };
      const username = String(profile?.username || participant?.username || '').replace(/^@/, '');
      const name = String(profile?.name || participant?.name || '');
      const matched = matchesNeedle(needle, name, username, userId);

      let recentMessages: Array<{
        direction: 'inbound' | 'outbound';
        at: string | null;
        text: string;
        attachments: Array<{ type: string; url: string | null; mimeType: string | null; name: string | null }>;
      }> = [];
      if (matched) {
        const messages = await loadMessageDetails({
          version,
          conversationId,
          secretBearer,
          messageLimit,
        });
        recentMessages = messages
          .map((message: any) => {
            const fromId = String(message?.from?.id || '');
            return {
              direction: businessIds.has(fromId) ? 'outbound' as const : 'inbound' as const,
              at: message?.created_time ? String(message.created_time) : null,
              text: String(message?.message || ''),
              attachments: safeAttachments(message),
            };
          })
          .filter((message) => message.text || message.attachments.length > 0);
      }

      results.push({
        conversationId,
        updatedTime: row?.updated_time || null,
        userId: userId || null,
        username: username ? `@${username}` : null,
        name: name || null,
        matched,
        paymentSignals: recentMessages.filter((message) => paymentRelevant(message.text)),
        recentMessages,
      });
    }

    return Response.json({
      ok: true,
      offset,
      limit,
      messageLimit,
      scanned: results.length,
      matches: results.filter((item) => item.matched),
      results: needle ? undefined : results,
    });
  } catch (error) {
    console.error('instagram_history_scan_failed', {
      reason: error instanceof Error ? error.message.replace(/[A-Za-z0-9_-]{40,}/g, '[redacted]') : 'unknown',
    });
    return Response.json({ error: 'scan_failed' }, { status: 500 });
  }
}

export const GET = run;
