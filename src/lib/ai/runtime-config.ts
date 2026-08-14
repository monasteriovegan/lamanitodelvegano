import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

export type AgentRuntimeConfig = {
  agent: string;
  provider: string;
  model: string;
  executionMode: 'api' | 'browser' | 'local';
  enabled: boolean;
  allowExternalWebTools: boolean;
  metadata: Record<string, unknown>;
};

export async function getAgentRuntimeConfig(
  db: SupabaseClient,
  agent: string,
  fallback: { provider?: string | null; model?: string | null; executionMode?: 'api' | 'browser' | 'local' } = {},
): Promise<AgentRuntimeConfig> {
  const { data } = await db.from('agent_runtime_configs')
    .select('agent,provider,model,execution_mode,enabled,allow_external_web_tools,metadata')
    .eq('agent', agent)
    .maybeSingle();

  return {
    agent,
    provider: String(data?.provider || fallback.provider || 'gemini'),
    model: String(data?.model || fallback.model || 'gemini-2.5-flash'),
    executionMode: (data?.execution_mode || fallback.executionMode || 'api') as AgentRuntimeConfig['executionMode'],
    enabled: data?.enabled !== false,
    allowExternalWebTools: data?.allow_external_web_tools !== false,
    metadata: data?.metadata && typeof data.metadata === 'object' ? data.metadata as Record<string, unknown> : {},
  };
}
