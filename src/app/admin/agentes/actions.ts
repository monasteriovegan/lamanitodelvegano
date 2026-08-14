'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/supabase/require-role';

const ALLOWED_AGENTS = new Set(['wonka', 'remy']);
const ALLOWED_PROVIDERS = new Set(['gemini']);
const ALLOWED_MODES = new Set(['api']);

export async function saveAgentRuntime(formData: FormData) {
  await requireRole(['admin']);
  const agent = String(formData.get('agent') || '').trim();
  const provider = String(formData.get('provider') || '').trim();
  const model = String(formData.get('model') || '').trim();
  const executionMode = String(formData.get('execution_mode') || '').trim();
  const enabled = formData.get('enabled') === 'on';
  const allowExternalWebTools = formData.get('allow_external_web_tools') === 'on';

  if (!ALLOWED_AGENTS.has(agent)) throw new Error('invalid_agent');
  if (!ALLOWED_PROVIDERS.has(provider)) throw new Error('provider_not_connected');
  if (!ALLOWED_MODES.has(executionMode)) throw new Error('execution_mode_not_connected');
  if (!model || model.length > 120) throw new Error('invalid_model');

  const db = createSupabaseServiceClient();
  const { error } = await db.from('agent_runtime_configs').upsert({
    agent,
    provider,
    model,
    execution_mode: executionMode,
    enabled,
    allow_external_web_tools: allowExternalWebTools,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'agent' });
  if (error) throw error;
  revalidatePath('/admin/agentes');
}
