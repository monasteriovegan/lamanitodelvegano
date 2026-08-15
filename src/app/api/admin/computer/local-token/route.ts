import { createHash, randomBytes } from 'crypto';
import { getCurrentAdminUser } from '@/lib/supabase/server-auth';
import { createSupabaseServiceClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const admin = await getCurrentAdminUser();
  if (!admin || !['admin', 'owner'].includes(admin.rol)) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: 'invalid_origin' }, { status: 403 });

  const token = `swk_${randomBytes(32).toString('base64url')}`;
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const name = `local-windows-${Date.now()}`;
  const db = createSupabaseServiceClient();
  const { error } = await db.from('wonka_worker_tokens').insert({
    name,
    token_hash: tokenHash,
    active: true,
    metadata: { kind: 'local_windows', created_by: admin.id },
  });
  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ token, name });
}
