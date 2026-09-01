import 'server-only';
import { createDecipheriv, createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

const TOKEN_KEY_NAMES = [
  'META_CONNECTION_ENCRYPTION_KEY',
  'META_TOKEN_ENCRYPTION_KEY',
  'CONNECTION_ENCRYPTION_KEY',
  'TOKEN_ENCRYPTION_KEY',
  'ENCRYPTION_KEY',
] as const;

function decodeBuffer(value: string) {
  const trimmed = value.trim();
  if (/^[a-f0-9]+$/i.test(trimmed) && trimmed.length % 2 === 0) return Buffer.from(trimmed, 'hex');
  try {
    const decoded = Buffer.from(trimmed, 'base64');
    if (decoded.length) return decoded;
  } catch {}
  return Buffer.from(trimmed, 'utf8');
}

function candidateKeys(raw: string) {
  const decoded = decodeBuffer(raw);
  const candidates = [decoded, createHash('sha256').update(raw).digest()];
  if (decoded.length !== 32) candidates.push(createHash('sha256').update(decoded).digest());
  return candidates.filter((value, index, rows) => value.length === 32 && rows.findIndex((row) => row.equals(value)) === index);
}

function decryptToken(row: { access_token_ciphertext: string; access_token_iv: string; access_token_tag: string }, secret: string) {
  const ciphertext = decodeBuffer(row.access_token_ciphertext);
  const iv = decodeBuffer(row.access_token_iv);
  const tag = decodeBuffer(row.access_token_tag);
  for (const key of candidateKeys(secret)) {
    try {
      const decipher = createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(tag);
      const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8').trim();
      if (plaintext) return plaintext;
    } catch {}
  }
  return null;
}

export async function loadActiveMetaConnectionToken(db: SupabaseClient, businessUnitId: string) {
  const { data: row, error } = await db
    .from('meta_connections')
    .select('access_token_ciphertext,access_token_iv,access_token_tag,status,granted_scopes')
    .eq('business_unit_id', businessUnitId)
    .eq('provider', 'meta')
    .eq('status', 'active')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!row?.access_token_ciphertext || !row?.access_token_iv || !row?.access_token_tag) return null;

  const available = TOKEN_KEY_NAMES
    .map((name) => ({ name, value: process.env[name] }))
    .filter((item): item is { name: typeof TOKEN_KEY_NAMES[number]; value: string } => Boolean(item.value));

  if (!available.length) throw new Error('meta_connection_encryption_key_not_configured');
  for (const candidate of available) {
    const token = decryptToken(row as any, candidate.value);
    if (token) return { token, keyName: candidate.name, scopes: Array.isArray(row.granted_scopes) ? row.granted_scopes.map(String) : [] };
  }
  throw new Error('meta_connection_token_decrypt_failed');
}
