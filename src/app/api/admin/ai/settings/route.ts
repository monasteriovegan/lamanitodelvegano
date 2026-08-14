import { NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { getCurrentAdminUser } from '@/lib/supabase/server-auth';

const ALLOWED_ROLES = ['admin', 'owner', 'supervisor'];

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
  const { data, error } = await db
    .from('integraciones_secretas')
    .select('ai_enabled,ai_provider,ai_model,gemini_api_key')
    .eq('id', 'global')
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({
    enabled: Boolean(data?.ai_enabled),
    provider: String(data?.ai_provider || 'gemini'),
    model: String(data?.ai_model || 'gemini-2.5-flash'),
    hasGeminiKey: Boolean(data?.gemini_api_key || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY),
  });
}

export async function PATCH(request: Request) {
  if (!await authorize(request)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = await request.json().catch(() => null) as { enabled?: boolean; provider?: string; model?: string } | null;
  if (!body || (body.enabled === undefined && body.provider === undefined && body.model === undefined)) {
    return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.enabled !== undefined) patch.ai_enabled = Boolean(body.enabled);
  if (body.provider !== undefined) {
    if (body.provider !== 'gemini') return NextResponse.json({ error: 'unsupported_provider' }, { status: 400 });
    patch.ai_provider = body.provider;
  }
  if (body.model !== undefined) {
    const model = body.model.trim();
    if (!model || model.length > 100 || !/^[a-zA-Z0-9._-]+$/.test(model)) {
      return NextResponse.json({ error: 'invalid_model' }, { status: 400 });
    }
    patch.ai_model = model;
  }

  const db = createSupabaseServiceClient();
  if (patch.ai_enabled === true) {
    const { data: current } = await db
      .from('integraciones_secretas')
      .select('gemini_api_key')
      .eq('id', 'global')
      .maybeSingle();
    const hasKey = Boolean(current?.gemini_api_key || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
    if (!hasKey) return NextResponse.json({ error: 'missing_gemini_key' }, { status: 409 });
  }

  const { error } = await db.from('integraciones_secretas').update(patch).eq('id', 'global');
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
