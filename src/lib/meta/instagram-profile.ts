import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { MetaConnectionsRepository } from '@/lib/repositories/meta-connections-repository';
import { CustomerRepository } from '@/lib/repositories/customers-repository';

export async function enrichInstagramContactProfile(
  db: SupabaseClient,
  input: { conversationId: string; externalUserId: string },
) {
  const { data: conversation, error: conversationError } = await db
    .from('conversations')
    .select('business_unit_id')
    .eq('id', input.conversationId)
    .maybeSingle();
  if (conversationError) throw conversationError;
  if (!conversation?.business_unit_id) return { enriched: false };

  const credential = await new MetaConnectionsRepository(db)
    .getInstagramLoginCredential(String(conversation.business_unit_id));
  const version = process.env.META_GRAPH_VERSION || 'v26.0';
  const url = new URL(
    `https://graph.instagram.com/${version}/${encodeURIComponent(input.externalUserId)}`,
  );
  url.searchParams.set('fields', 'name,username');

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${credential.accessToken}` },
    cache: 'no-store',
  });
  const body = await response.json().catch(() => ({})) as { name?: unknown; username?: unknown };
  if (!response.ok) throw new Error(`instagram_profile_lookup_failed:${response.status}`);

  const name = typeof body.name === 'string' ? body.name : null;
  const username = typeof body.username === 'string' ? body.username : null;
  if (!name && !username) return { enriched: false };

  await new CustomerRepository(db).enrichInstagramProfile(
    String(conversation.business_unit_id),
    input.externalUserId,
    { name, username },
  );
  return { enriched: true };
}
