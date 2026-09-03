import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { NormalizedMessage } from '@/lib/messaging/types';
import { MetaConnectionsRepository } from '@/lib/repositories/meta-connections-repository';

export type InstagramProfileIdentity = {
  instagram_id: string;
  instagram_username: string | null;
  instagram_name: string | null;
  instagram_profile_pic: string | null;
};

function placeholderName(value: unknown, externalId: string) {
  const current = String(value || '').trim();
  return !current || current === `Cliente ${externalId}` || current === `Contacto ${externalId}` || current === `Instagram ${externalId}`;
}

async function fetchInstagramProfile(accessToken: string, userId: string): Promise<InstagramProfileIdentity | null> {
  const version = process.env.META_GRAPH_VERSION || 'v26.0';
  const url = `https://graph.instagram.com/${version}/${encodeURIComponent(userId)}?fields=id,name,username,profile_pic`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body?.id) return null;
  return {
    instagram_id: String(body.id),
    instagram_username: body.username ? String(body.username) : null,
    instagram_name: body.name ? String(body.name) : null,
    instagram_profile_pic: body.profile_pic ? String(body.profile_pic) : null,
  };
}

export async function enrichInstagramMessageProfile(
  db: SupabaseClient,
  message: NormalizedMessage,
): Promise<{ message: NormalizedMessage; profile: InstagramProfileIdentity | null }> {
  if (message.channel !== 'instagram' || message.direction !== 'inbound' || !message.external_user_id) {
    return { message, profile: null };
  }

  try {
    const connections = new MetaConnectionsRepository(db);
    const businessUnitId = await connections.resolveBusinessUnitForMessage(message);
    if (!businessUnitId) return { message, profile: null };
    const credential = await connections.getInstagramLoginCredential(businessUnitId);
    const profile = await fetchInstagramProfile(credential.accessToken, message.external_user_id);
    if (!profile) return { message, profile: null };
    const displayName = profile.instagram_name || (profile.instagram_username ? `@${profile.instagram_username}` : null);
    return {
      message: displayName ? { ...message, display_name: displayName } : message,
      profile,
    };
  } catch (error) {
    console.warn('instagram_profile_lookup_failed', {
      reason: error instanceof Error ? error.message : 'unknown',
    });
    return { message, profile: null };
  }
}

export async function syncInstagramProfileToContact(
  db: SupabaseClient,
  customerId: string | null | undefined,
  profile: InstagramProfileIdentity | null,
) {
  if (!customerId || !profile) return;
  const { data: contact, error } = await db
    .from('omnichannel_contacts')
    .select('id,nombre,display_name,metadata,external_id')
    .eq('id', customerId)
    .maybeSingle();
  if (error || !contact) return;

  const metadata = contact.metadata && typeof contact.metadata === 'object' ? contact.metadata : {};
  const displayName = profile.instagram_name || (profile.instagram_username ? `@${profile.instagram_username}` : null);
  const patch: Record<string, unknown> = {
    metadata: {
      ...metadata,
      instagram_username: profile.instagram_username,
      instagram_name: profile.instagram_name,
      instagram_profile_pic: profile.instagram_profile_pic,
    },
    updated_at: new Date().toISOString(),
  };
  if (displayName) patch.display_name = displayName;
  if (displayName && placeholderName(contact.nombre, String(contact.external_id || profile.instagram_id))) {
    patch.nombre = displayName;
  }

  await db.from('omnichannel_contacts').update(patch).eq('id', customerId);
}
