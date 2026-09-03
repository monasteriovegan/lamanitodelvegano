import { NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { getCurrentAdminUser } from '@/lib/supabase/server-auth';

const ALLOWED_ROLES = new Set(['admin', 'owner', 'supervisor', 'soporte']);

async function authorize(request: Request) {
  const admin = await getCurrentAdminUser();
  if (!admin || !ALLOWED_ROLES.has(admin.rol)) {
    return { error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) };
  }

  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) {
    return { error: NextResponse.json({ error: 'invalid_origin' }, { status: 403 }) };
  }

  return { admin };
}

function instagramEnabled(metadata: unknown) {
  if (!metadata || typeof metadata !== 'object') return false;
  const channels = (metadata as Record<string, unknown>).channels;
  if (!channels || typeof channels !== 'object') return false;
  return (channels as Record<string, unknown>).instagram === true;
}

export async function GET(request: Request) {
  const auth = await authorize(request);
  if ('error' in auth) return auth.error;

  const db = createSupabaseServiceClient();
  const { data, error } = await db
    .from('agent_runtime_configs')
    .select('metadata')
    .eq('agent', 'remy')
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: 'remy_runtime_not_found' }, { status: 404 });

  return NextResponse.json({ ok: true, enabled: instagramEnabled(data.metadata) });
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

  const db = createSupabaseServiceClient();
  const { data: current, error: readError } = await db
    .from('agent_runtime_configs')
    .select('metadata')
    .eq('agent', 'remy')
    .maybeSingle();

  if (readError) return NextResponse.json({ error: readError.message }, { status: 400 });
  if (!current) return NextResponse.json({ error: 'remy_runtime_not_found' }, { status: 404 });

  const currentMetadata = current.metadata && typeof current.metadata === 'object'
    ? current.metadata as Record<string, unknown>
    : {};
  const currentChannels = currentMetadata.channels && typeof currentMetadata.channels === 'object'
    ? currentMetadata.channels as Record<string, unknown>
    : {};
  const metadata = {
    ...currentMetadata,
    channels: {
      ...currentChannels,
      instagram: enabled,
    },
  };

  const { error: updateError } = await db
    .from('agent_runtime_configs')
    .update({ metadata, updated_at: new Date().toISOString() })
    .eq('agent', 'remy');

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 });

  return NextResponse.json({ ok: true, enabled });
}
