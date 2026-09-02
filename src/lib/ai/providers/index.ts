import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { sanitizeGeminiSchema } from './schema';
export { sanitizeGeminiSchema } from './schema';

export type ProviderToolDefinition = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

export type ProviderToolCall = {
  id: string;
  name: string;
  args: Record<string, unknown>;
};

export type ProviderMessage = {
  role: 'user' | 'assistant' | 'tool';
  content?: string;
  toolCalls?: ProviderToolCall[];
  toolCallId?: string;
  name?: string;
};

export type ProviderUsage = {
  inputTokens: number;
  outputTokens: number;
  thinkingTokens: number;
  cachedInputTokens: number;
  toolTokens: number;
  totalTokens: number;
};

export type ProviderResponse = {
  text: string;
  toolCalls: ProviderToolCall[];
  assistantMessage: ProviderMessage;
  usage: ProviderUsage;
  latencyMs: number;
  raw: unknown;
};

export type ProviderCallInput = {
  provider: string;
  model: string;
  systemPrompt: string;
  messages: ProviderMessage[];
  tools?: ProviderToolDefinition[];
  maxOutputTokens: number;
  temperature?: number;
};

type ProviderCredential = {
  provider: string;
  apiKey: string;
  baseUrl?: string | null;
};

function sanitizeSchema(schema: any): any {
  if (!schema || typeof schema !== 'object') return schema;
  if (Array.isArray(schema)) return schema.map(sanitizeSchema);
  const allowed = new Set(['type', 'description', 'properties', 'required', 'enum', 'items', 'additionalProperties', 'minimum', 'maximum', 'minLength', 'maxLength']);
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(schema)) {
    if (!allowed.has(key)) continue;
    if (key === 'properties' && value && typeof value === 'object') {
      clean.properties = Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([name, child]) => [name, sanitizeSchema(child)]));
    } else if (key === 'items') clean.items = sanitizeSchema(value);
    else clean[key] = value;
  }
  return clean;
}

async function resolveCredential(db: SupabaseClient, provider: string): Promise<ProviderCredential> {
  if (provider === 'gemini') {
    const { data } = await db.from('integraciones_secretas').select('gemini_api_key').eq('id', 'global').maybeSingle();
    const apiKey = String(data?.gemini_api_key || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim();
    if (!apiKey) throw new Error('missing_gemini_key');
    return { provider, apiKey };
  }

  const { data } = await db.from('ai_provider_credentials')
    .select('provider,api_key,base_url,enabled')
    .eq('provider', provider)
    .maybeSingle();

  const envKey = provider === 'groq' ? process.env.GROQ_API_KEY : undefined;
  const apiKey = String(data?.api_key || envKey || '').trim();
  if (data?.enabled === false) throw new Error(`provider_disabled:${provider}`);
  if (!apiKey) throw new Error(`missing_provider_key:${provider}`);

  const baseUrl = provider === 'groq'
    ? String(data?.base_url || 'https://api.groq.com/openai/v1').replace(/\/$/, '')
    : data?.base_url ? String(data.base_url).replace(/\/$/, '') : null;

  return { provider, apiKey, baseUrl };
}

function normalizeGeminiUsage(raw: any): ProviderUsage {
  const inputTokens = Number(raw?.promptTokenCount || 0);
  const outputTokens = Number(raw?.candidatesTokenCount || 0);
  const thinkingTokens = Number(raw?.thoughtsTokenCount || 0);
  const cachedInputTokens = Number(raw?.cachedContentTokenCount || 0);
  const toolTokens = Number(raw?.toolUsePromptTokenCount || 0);
  const totalTokens = Number(raw?.totalTokenCount || inputTokens + outputTokens + thinkingTokens);
  return { inputTokens, outputTokens, thinkingTokens, cachedInputTokens, toolTokens, totalTokens };
}

function normalizeOpenAiUsage(raw: any): ProviderUsage {
  const inputTokens = Number(raw?.prompt_tokens || raw?.input_tokens || 0);
  const completionTotal = Number(raw?.completion_tokens || raw?.output_tokens || 0);
  const thinkingTokens = Number(raw?.completion_tokens_details?.reasoning_tokens || raw?.output_tokens_details?.reasoning_tokens || 0);
  const outputTokens = Math.max(0, completionTotal - thinkingTokens);
  const cachedInputTokens = Number(raw?.prompt_tokens_details?.cached_tokens || raw?.input_tokens_details?.cached_tokens || 0);
  const totalTokens = Number(raw?.total_tokens || inputTokens + completionTotal);
  return { inputTokens, outputTokens, thinkingTokens, cachedInputTokens, toolTokens: 0, totalTokens };
}

function parseJsonArgs(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value !== 'string' || !value.trim()) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function parseToolContent(content: string | undefined) {
  const text = String(content || '');
  try { return JSON.parse(text); } catch { return text; }
}

async function callGemini(credential: ProviderCredential, input: ProviderCallInput): Promise<ProviderResponse> {
  const contents: any[] = [];
  for (const message of input.messages) {
    if (message.role === 'user') {
      contents.push({ role: 'user', parts: [{ text: message.content || '' }] });
      continue;
    }
    if (message.role === 'assistant') {
      const parts: any[] = [];
      if (message.content) parts.push({ text: message.content });
      for (const call of message.toolCalls || []) parts.push({ functionCall: { name: call.name, args: call.args } });
      contents.push({ role: 'model', parts: parts.length ? parts : [{ text: '' }] });
      continue;
    }
    if (message.role === 'tool') {
      const part = { functionResponse: { name: message.name || 'tool', response: { result: parseToolContent(message.content) } } };
      const last = contents[contents.length - 1];
      if (last?.role === 'user' && Array.isArray(last.parts) && last.parts.every((item: any) => item?.functionResponse)) last.parts.push(part);
      else contents.push({ role: 'user', parts: [part] });
    }
  }

  const payload: Record<string, unknown> = {
    systemInstruction: { parts: [{ text: input.systemPrompt }] },
    contents,
    generationConfig: {
      temperature: input.temperature ?? 0.2,
      maxOutputTokens: input.maxOutputTokens,
    },
  };
  if (input.tools?.length) {
    payload.tools = [{ functionDeclarations: input.tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: sanitizeGeminiSchema(tool.inputSchema),
    })) }];
  }

  const started = Date.now();
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(input.model)}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': credential.apiKey },
    body: JSON.stringify(payload),
    cache: 'no-store',
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error('ai_provider_error', { provider: 'gemini', status: response.status, detail: String(body?.error?.message || '').slice(0, 500) });
    throw new Error(`provider_generate_failed:gemini:${response.status}`);
  }

  const parts = Array.isArray(body?.candidates?.[0]?.content?.parts) ? body.candidates[0].content.parts : [];
  const text = parts.map((part: any) => typeof part?.text === 'string' ? part.text : '').join('').trim();
  const toolCalls: ProviderToolCall[] = parts
    .filter((part: any) => part?.functionCall?.name)
    .map((part: any, index: number) => ({
      id: `gemini_${Date.now()}_${index}`,
      name: String(part.functionCall.name),
      args: parseJsonArgs(part.functionCall.args),
    }));

  return {
    text,
    toolCalls,
    assistantMessage: { role: 'assistant', content: text || undefined, toolCalls },
    usage: normalizeGeminiUsage(body?.usageMetadata),
    latencyMs: Date.now() - started,
    raw: body,
  };
}

async function callOpenAiCompatible(credential: ProviderCredential, input: ProviderCallInput): Promise<ProviderResponse> {
  if (!credential.baseUrl) throw new Error(`missing_provider_base_url:${input.provider}`);

  const messages: any[] = [{ role: 'system', content: input.systemPrompt }];
  for (const message of input.messages) {
    if (message.role === 'user') messages.push({ role: 'user', content: message.content || '' });
    else if (message.role === 'assistant') {
      messages.push({
        role: 'assistant',
        content: message.content || null,
        ...(message.toolCalls?.length ? {
          tool_calls: message.toolCalls.map((call) => ({
            id: call.id,
            type: 'function',
            function: { name: call.name, arguments: JSON.stringify(call.args || {}) },
          })),
        } : {}),
      });
    } else {
      messages.push({
        role: 'tool',
        tool_call_id: message.toolCallId,
        name: message.name,
        content: message.content || '',
      });
    }
  }

  const isQwen = input.model.startsWith('qwen/');
  const isGptOss = input.model.startsWith('openai/gpt-oss-');
  const payload: Record<string, unknown> = {
    model: input.model,
    messages,
    temperature: input.temperature ?? 0.2,
    max_completion_tokens: input.maxOutputTokens,
  };
  if (isQwen) payload.reasoning_effort = 'none';
  if (isGptOss) {
    payload.reasoning_effort = 'low';
    payload.reasoning_format = 'hidden';
  }
  if (input.tools?.length) {
    payload.tools = input.tools.map((tool) => ({
      type: 'function',
      function: { name: tool.name, description: tool.description, parameters: sanitizeSchema(tool.inputSchema) },
    }));
    payload.tool_choice = 'auto';
    payload.parallel_tool_calls = !isGptOss;
  }

  const started = Date.now();
  const response = await fetch(`${credential.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${credential.apiKey}` },
    body: JSON.stringify(payload),
    cache: 'no-store',
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error('ai_provider_error', { provider: input.provider, status: response.status, detail: String(body?.error?.message || '').slice(0, 500) });
    throw new Error(`provider_generate_failed:${input.provider}:${response.status}`);
  }

  const message = body?.choices?.[0]?.message || {};
  const text = typeof message?.content === 'string' ? message.content.trim() : '';
  const toolCalls: ProviderToolCall[] = Array.isArray(message?.tool_calls)
    ? message.tool_calls.filter((call: any) => call?.function?.name).map((call: any, index: number) => ({
      id: String(call.id || `${input.provider}_${Date.now()}_${index}`),
      name: String(call.function.name),
      args: parseJsonArgs(call.function.arguments),
    }))
    : [];

  return {
    text,
    toolCalls,
    assistantMessage: { role: 'assistant', content: text || undefined, toolCalls },
    usage: normalizeOpenAiUsage(body?.usage),
    latencyMs: Date.now() - started,
    raw: body,
  };
}

export async function callAiProvider(db: SupabaseClient, input: ProviderCallInput): Promise<ProviderResponse> {
  const credential = await resolveCredential(db, input.provider);
  if (input.provider === 'gemini') return callGemini(credential, input);
  if (input.provider === 'groq') return callOpenAiCompatible(credential, input);
  throw new Error(`unsupported_provider:${input.provider}`);
}

export async function getProviderConnectionStatus(db: SupabaseClient) {
  const [{ data: legacy }, { data: rows }] = await Promise.all([
    db.from('integraciones_secretas').select('gemini_api_key').eq('id', 'global').maybeSingle(),
    db.from('ai_provider_credentials').select('provider,api_key,enabled'),
  ]);
  const map = Object.fromEntries((rows || []).map((row: any) => [String(row.provider), Boolean(row.enabled !== false && row.api_key)]));
  return {
    gemini: Boolean(legacy?.gemini_api_key || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY),
    groq: Boolean(map.groq || process.env.GROQ_API_KEY),
  };
}

export async function validateProviderModel(db: SupabaseClient, provider: string, model: string) {
  if (provider === 'gemini') return /^gemini-[a-zA-Z0-9._-]+$/.test(model);
  if (provider !== 'groq') return false;

  const credential = await resolveCredential(db, provider);
  if (!credential.baseUrl) return false;
  const response = await fetch(`${credential.baseUrl}/models`, {
    headers: { Authorization: `Bearer ${credential.apiKey}` },
    cache: 'no-store',
  });
  if (!response.ok) return false;
  const body = await response.json().catch(() => ({}));
  return Array.isArray(body?.data) && body.data.some((item: any) => String(item?.id || '') === model);
}
