import { createHash, randomBytes } from 'crypto';
import { getCurrentAdminUser } from '@/lib/supabase/server-auth';
import { createSupabaseServiceClient } from '@/lib/supabase/server';

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export async function GET() {
  const admin = await getCurrentAdminUser();
  if (!admin || !['admin', 'owner'].includes(admin.rol)) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const db = createSupabaseServiceClient();
  const { data, error } = await db.from('mcp_access_tokens')
    .select('id,name,token_prefix,scopes,active,last_used_at,created_at')
    .eq('active', true)
    .order('created_at', { ascending: false });
  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ data: data || [] });
}

export async function POST(request: Request) {
  const admin = await getCurrentAdminUser();
  if (!admin || !['admin', 'owner'].includes(admin.rol)) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: 'invalid_origin' }, { status: 403 });

  const body = await request.json().catch(() => ({})) as { name?: string; allowWrite?: boolean };
  const secret = `syn_mcp_${randomBytes(32).toString('base64url')}`;
  const prefix = secret.slice(0, 16);
  const scopes = body.allowWrite ? ['read', 'write'] : ['read'];
  const db = createSupabaseServiceClient();
  const { data, error } = await db.from('mcp_access_tokens').insert({
    name: String(body.name || 'Synthetiq MCP').slice(0, 80),
    token_prefix: prefix,
    token_hash: hashToken(secret),
    scopes,
    created_by: admin.id,
  }).select('id,name,token_prefix,scopes,created_at').single();
  if (error) return Response.json({ error: error.message }, { status: 400 });

  return Response.json({
    ok: true,
    token: secret,
    tokenRecord: data,
    warning: 'Este token se muestra una sola vez. Guárdalo en un gestor seguro y no lo pegues en chats.',
  });
}

export async function DELETE(request: Request) {
  const admin = await getCurrentAdminUser();
  if (!admin || !['admin', 'owner'].includes(admin.rol)) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: 'invalid_origin' }, { status: 403 });
  const body = await request.json().catch(() => null) as { id?: string } | null;
  if (!body?.id) return Response.json({ error: 'id_required' }, { status: 400 });
  const db = createSupabaseServiceClient();
  const { error } = await db.from('mcp_access_tokens').update({ active: false }).eq('id', body.id);
  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ ok: true });
}
