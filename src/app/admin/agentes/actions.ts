'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/supabase/require-role';
import { getProviderConnectionStatus, validateProviderModel } from '@/lib/ai/providers';

const ALLOWED_AGENTS = new Set(['wonka', 'remy']);
const ALLOWED_PROVIDERS = new Set(['gemini', 'groq']);
const ALLOWED_MODES = new Set(['api']);

export async function saveAgentRuntime(formData: FormData) {
  await requireRole(['admin']);
  const agent = String(formData.get('agent') || '').trim();
  const provider = String(formData.get('provider') || '').trim();
  const model = String(formData.get('model') || '').trim();
  const executionMode = String(formData.get('execution_mode') || '').trim();
  const enabled = formData.get('enabled') === 'on';
  const allowExternalWebTools = formData.get('allow_external_web_tools') === 'on';
  const instagramEnabled = formData.get('instagram_enabled') === 'on';

  if (!ALLOWED_AGENTS.has(agent)) throw new Error('invalid_agent');
  if (!ALLOWED_PROVIDERS.has(provider)) throw new Error('provider_not_supported');
  if (!ALLOWED_MODES.has(executionMode)) throw new Error('execution_mode_not_connected');
  if (!model || model.length > 120) throw new Error('invalid_model');

  const db = createSupabaseServiceClient();
  const connected = await getProviderConnectionStatus(db);
  if (!connected[provider as keyof typeof connected]) throw new Error(`provider_not_connected:${provider}`);
  if (!await validateProviderModel(db, provider, model)) throw new Error(`model_not_available:${provider}:${model}`);

  const { data: current } = await db.from('agent_runtime_configs').select('metadata').eq('agent', agent).maybeSingle();
  const currentMetadata = current?.metadata && typeof current.metadata === 'object' ? current.metadata : {};
  const metadata = agent === 'remy'
    ? { ...currentMetadata, channels: { ...((currentMetadata as any).channels || {}), instagram: instagramEnabled } }
    : currentMetadata;

  const { error } = await db.from('agent_runtime_configs').upsert({
    agent,
    provider,
    model,
    execution_mode: executionMode,
    enabled,
    allow_external_web_tools: allowExternalWebTools,
    metadata,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'agent' });
  if (error) throw error;
  revalidatePath('/admin/agentes');
}
