import { NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { getCurrentAdminUser } from '@/lib/supabase/server-auth';
import { getProviderConnectionStatus } from '@/lib/ai/providers';

const ALLOWED_ROLES = ['admin', 'owner', 'supervisor'];
const ALLOWED_PROVIDERS = new Set(['gemini', 'groq']);

async function authorize(request?: Request) {
  const admin = await getCurrentAdminUser();
  if (!admin || !ALLOWED_ROLES.includes(admin.rol)) return null;
  if (request) {
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin) return null;
  }
  return admin;
}

export async function GET() {
  if (!await authorize()) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const db = createSupabaseServiceClient();
  const [{ data, error }, providers] = await Promise.all([
    db.from('integraciones_secretas').select('ai_enabled,ai_provider,ai_model').eq('id', 'global').maybeSingle(),
    getProviderConnectionStatus(db),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({
    enabled: Boolean(data?.ai_enabled),
    provider: String(data?.ai_provider || 'gemini'),
    model: String(data?.ai_model || 'gemini-2.5-flash'),
    providers,
  });
}

export async function PATCH(request: Request) {
  if (!await authorize(request)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = await request.json().catch(() => null) as { enabled?: boolean; provider?: string; model?: string } | null;
  if (!body || (body.enabled === undefined && body.provider === undefined && body.model === undefined)) {
    return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
  }

  const db = createSupabaseServiceClient();
  const providers = await getProviderConnectionStatus(db);
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.enabled !== undefined) patch.ai_enabled = Boolean(body.enabled);
  if (body.provider !== undefined) {
    if (!ALLOWED_PROVIDERS.has(body.provider)) return NextResponse.json({ error: 'unsupported_provider' }, { status: 400 });
    if (!providers[body.provider as keyof typeof providers]) return NextResponse.json({ error: `provider_not_connected:${body.provider}` }, { status: 409 });
    patch.ai_provider = body.provider;
  }
  if (body.model !== undefined) {
    const model = body.model.trim();
    if (!model || model.length > 120 || !/^[a-zA-Z0-9._\/-]+$/.test(model)) {
      return NextResponse.json({ error: 'invalid_model' }, { status: 400 });
    }
    patch.ai_model = model;
  }

  if (patch.ai_enabled === true) {
    const selectedProvider = String(body.provider || (await db.from('integraciones_secretas').select('ai_provider').eq('id', 'global').maybeSingle()).data?.ai_provider || 'gemini');
    if (!providers[selectedProvider as keyof typeof providers]) {
      return NextResponse.json({ error: `provider_not_connected:${selectedProvider}` }, { status: 409 });
    }
  }

  const { error } = await db.from('integraciones_secretas').update(patch).eq('id', 'global');
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
