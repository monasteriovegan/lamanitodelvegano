import { NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { createSupabaseServerAuthClient } from '@/lib/supabase/server-auth';
import { getRemyGlobalEnabled, setRemyGlobalEnabled } from '@/lib/ai/remy-global-state';

async function authorize(request: Request) {
  const authClient = await createSupabaseServerAuthClient();
  const { data: { user }, error: authError } = await authClient.auth.getUser();
  if (authError || !user) {
    return { error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) };
  }

  const db = createSupabaseServiceClient();
  const { data: role, error: roleError } = await db
    .from('admin_roles')
    .select('rol')
    .eq('user_id', user.id)
    .maybeSingle();

  if (roleError || role?.rol !== 'admin') {
    return { error: NextResponse.json({ error: 'admin_required' }, { status: 403 }) };
  }

  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) {
    return { error: NextResponse.json({ error: 'invalid_origin' }, { status: 403 }) };
  }

  return { db };
}

export async function GET(request: Request) {
  const auth = await authorize(request);
  if ('error' in auth) return auth.error;

  try {
    const enabled = await getRemyGlobalEnabled(auth.db);
    return NextResponse.json({ ok: true, enabled });
  } catch (error) {
    console.error('remy_global_state_read_failed', {
      reason: error instanceof Error ? error.message : 'unknown',
    });
    return NextResponse.json({ error: 'remy_global_state_read_failed' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const auth = await authorize(request);
  if ('error' in auth) return auth.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const enabled = (body as { enabled?: unknown } | null)?.enabled;
  if (typeof enabled !== 'boolean') {
    return NextResponse.json({ error: 'enabled_must_be_boolean' }, { status: 400 });
  }

  try {
    await setRemyGlobalEnabled(auth.db, enabled);
    const persisted = await getRemyGlobalEnabled(auth.db);
    if (persisted !== enabled) {
      return NextResponse.json({ error: 'remy_global_state_mismatch' }, { status: 500 });
    }
    return NextResponse.json({ ok: true, enabled: persisted });
  } catch (error) {
    console.error('remy_global_state_update_failed', {
      reason: error instanceof Error ? error.message : 'unknown',
    });
    return NextResponse.json({ error: 'remy_global_state_update_failed' }, { status: 500 });
  }
}
