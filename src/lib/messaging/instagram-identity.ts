import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { MetaConnectionsRepository } from '@/lib/repositories/meta-connections-repository';
import type { NormalizedMessage } from './types';

const INSTAGRAM_GRAPH = 'https://graph.instagram.com';

export function normalizeInstagramUsername(value: unknown): string | null {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const withoutAt = raw.replace(/^@+/, '').trim();
  if (!withoutAt || /^\d+$/.test(withoutAt)) return null;
  return `@${withoutAt}`;
}

export function isPlaceholderInstagramName(value: unknown, externalId?: string | null): boolean {
  const name = String(value || '').trim();
  if (!name) return true;
  if (/^Cliente\s+\d+$/i.test(name) || /^Instagram\s+\d+$/i.test(name) || /^Contacto\s+\d+$/i.test(name)) return true;
  return Boolean(externalId && (name === externalId || name === `Cliente ${externalId}`));
}

export function instagramUsernameFromStoredPayload(payload: unknown): string | null {
  const root = payload && typeof payload === 'object' ? payload as Record<string, any> : {};
  const raw = root.raw && typeof root.raw === 'object' ? root.raw : root;
  const graphMessage = raw?.message && typeof raw.message === 'object' ? raw.message : null;
  if (!graphMessage) return null;

  const businessId = String(raw?.business_instagram_id || '');
  const fromId = String(graphMessage?.from?.id || '');
  if (fromId && (!businessId || fromId !== businessId)) {
    const username = normalizeInstagramUsername(graphMessage?.from?.username);
    if (username) return username;
  }

  const recipients = Array.isArray(graphMessage?.to?.data) ? graphMessage.to.data : [];
  for (const recipient of recipients) {
    const recipientId = String(recipient?.id || '');
    if (businessId && recipientId === businessId) continue;
    const username = normalizeInstagramUsername(recipient?.username);
    if (username) return username;
  }

  return null;
}

async function fetchInstagramProfile(
  db: SupabaseClient,
  businessUnitId: string,
  userId: string,
): Promise<{ username: string | null; name: string | null }> {
  try {
    const credential = await new MetaConnectionsRepository(db).getInstagramLoginCredential(businessUnitId);
    const version = process.env.META_GRAPH_VERSION || 'v26.0';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);
    try {
      const response = await fetch(
        `${INSTAGRAM_GRAPH}/${version}/${encodeURIComponent(userId)}?fields=id,name,username`,
        {
          headers: { Authorization: `Bearer ${credential.accessToken}` },
          cache: 'no-store',
          signal: controller.signal,
        },
      );
      if (!response.ok) return { username: null, name: null };
      const body = await response.json().catch(() => ({}));
      return {
        username: normalizeInstagramUsername(body?.username),
        name: body?.name ? String(body.name).trim() : null,
      };
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    console.warn('instagram_identity_profile_lookup_failed', {
      userId,
      reason: error instanceof Error ? error.message : 'unknown',
    });
    return { username: null, name: null };
  }
}

export async function enrichInstagramMessageIdentity(
  db: SupabaseClient,
  businessUnitId: string,
  message: NormalizedMessage,
): Promise<{ message: NormalizedMessage; username: string | null; profileName: string | null }> {
  if (message.channel !== 'instagram') {
    return { message, username: null, profileName: null };
  }

  const direct = normalizeInstagramUsername(message.display_name)
    || instagramUsernameFromStoredPayload(message.raw_payload);
  if (direct) {
    return { message: { ...message, display_name: direct }, username: direct, profileName: null };
  }

  const [{ data: conversation }, { data: contact }] = await Promise.all([
    db.from('conversations')
      .select('metadata')
      .eq('business_unit_id', businessUnitId)
      .eq('channel', 'instagram')
      .eq('external_conversation_id', message.external_thread_id)
      .maybeSingle(),
    db.from('omnichannel_contacts')
      .select('display_name,metadata')
      .eq('business_unit_id', businessUnitId)
      .eq('channel', 'instagram')
      .eq('external_id', message.external_user_id)
      .maybeSingle(),
  ]);

  const cached = normalizeInstagramUsername(conversation?.metadata?.external_username)
    || normalizeInstagramUsername(contact?.metadata?.instagram_username)
    || normalizeInstagramUsername(contact?.display_name);
  if (cached) {
    return { message: { ...message, display_name: cached }, username: cached, profileName: null };
  }

  const profile = await fetchInstagramProfile(db, businessUnitId, message.external_user_id);
  if (!profile.username) return { message, username: null, profileName: profile.name };

  return {
    message: { ...message, display_name: profile.username },
    username: profile.username,
    profileName: profile.name,
  };
}

export async function persistInstagramIdentity(
  db: SupabaseClient,
  input: {
    customerId: string | null;
    conversationId: string;
    externalUserId: string;
    username: string | null;
    profileName?: string | null;
  },
): Promise<void> {
  const username = normalizeInstagramUsername(input.username);
  if (!username) return;

  if (input.customerId) {
    const { data: contact, error: readError } = await db
      .from('omnichannel_contacts')
      .select('nombre,display_name,metadata')
      .eq('id', input.customerId)
      .maybeSingle();
    if (readError) throw readError;

    const currentMetadata = contact?.metadata && typeof contact.metadata === 'object' ? contact.metadata : {};
    const patch: Record<string, unknown> = {
      display_name: username,
      metadata: {
        ...currentMetadata,
        instagram_username: username,
        ...(input.profileName ? { instagram_profile_name: input.profileName } : {}),
      },
      updated_at: new Date().toISOString(),
    };
    if (isPlaceholderInstagramName(contact?.nombre, input.externalUserId)) {
      patch.nombre = input.profileName || username;
    }

    const { error: updateError } = await db.from('omnichannel_contacts').update(patch).eq('id', input.customerId);
    if (updateError) throw updateError;
  }

  const { data: conversation, error: conversationReadError } = await db
    .from('conversations')
    .select('metadata')
    .eq('id', input.conversationId)
    .maybeSingle();
  if (conversationReadError) throw conversationReadError;
  const conversationMetadata = conversation?.metadata && typeof conversation.metadata === 'object'
    ? conversation.metadata
    : {};
  const { error: conversationUpdateError } = await db
    .from('conversations')
    .update({
      metadata: { ...conversationMetadata, external_username: username },
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.conversationId);
  if (conversationUpdateError) throw conversationUpdateError;
}
