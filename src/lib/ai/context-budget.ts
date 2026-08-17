import 'server-only';

export type AgentContextBudget = {
  maxOutputTokens: number;
  maxHistoryMessages: number;
  maxHistoryChars: number;
  maxMessageChars: number;
  maxToolResultChars: number;
  maxBusinessContextChars: number;
};

const DEFAULT_BUDGETS: Record<string, AgentContextBudget> = {
  wonka: {
    maxOutputTokens: 260,
    maxHistoryMessages: 6,
    maxHistoryChars: 3200,
    maxMessageChars: 1400,
    maxToolResultChars: 1600,
    maxBusinessContextChars: 1000,
  },
  remy: {
    maxOutputTokens: 140,
    maxHistoryMessages: 6,
    maxHistoryChars: 1800,
    maxMessageChars: 600,
    maxToolResultChars: 0,
    maxBusinessContextChars: 900,
  },
  default: {
    maxOutputTokens: 220,
    maxHistoryMessages: 6,
    maxHistoryChars: 2600,
    maxMessageChars: 1000,
    maxToolResultChars: 1200,
    maxBusinessContextChars: 800,
  },
};

function boundedInteger(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

export function getAgentContextBudget(agent: string, metadata: Record<string, unknown> = {}): AgentContextBudget {
  const defaults = DEFAULT_BUDGETS[agent] || DEFAULT_BUDGETS.default;
  const raw = metadata?.token_budget && typeof metadata.token_budget === 'object'
    ? metadata.token_budget as Record<string, unknown>
    : {};

  return {
    maxOutputTokens: boundedInteger(raw.max_output_tokens ?? raw.maxOutputTokens, defaults.maxOutputTokens, 64, 800),
    maxHistoryMessages: boundedInteger(raw.max_history_messages ?? raw.maxHistoryMessages, defaults.maxHistoryMessages, 2, 12),
    maxHistoryChars: boundedInteger(raw.max_history_chars ?? raw.maxHistoryChars, defaults.maxHistoryChars, 600, 8000),
    maxMessageChars: boundedInteger(raw.max_message_chars ?? raw.maxMessageChars, defaults.maxMessageChars, 200, 4000),
    maxToolResultChars: boundedInteger(raw.max_tool_result_chars ?? raw.maxToolResultChars, defaults.maxToolResultChars, 0, 5000),
    maxBusinessContextChars: boundedInteger(raw.max_business_context_chars ?? raw.maxBusinessContextChars, defaults.maxBusinessContextChars, 200, 4000),
  };
}

export function compactText(value: unknown, maxChars: number) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (!maxChars || text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(0, maxChars - 20)).trimEnd()}… [recortado]`;
}

export function compactJsonForModel(value: unknown, maxChars: number): unknown {
  if (!maxChars) return null;
  let serialized = '';
  try {
    serialized = JSON.stringify(value);
  } catch {
    serialized = String(value ?? '');
  }
  if (serialized.length <= maxChars) return value;

  if (Array.isArray(value)) {
    const kept: unknown[] = [];
    for (const item of value) {
      const candidate = [...kept, item];
      if (JSON.stringify(candidate).length > Math.max(200, maxChars - 120)) break;
      kept.push(item);
    }
    return { items: kept, truncated: true, total_items: value.length };
  }

  return { summary: compactText(serialized, maxChars), truncated: true };
}
