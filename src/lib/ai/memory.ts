import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { compactText } from '@/lib/ai/context-budget';

export type AgentMemoryScope = 'owner' | 'business' | 'agent' | 'customer' | 'project' | 'conversation';

type MemoryRow = {
  id: string;
  owner_user_id: string | null;
  business_unit_id: string | null;
  agent: string;
  scope: AgentMemoryScope;
  entity_id: string | null;
  memory_key: string;
  value: string;
  tags: string[] | null;
  priority: number | null;
  pinned: boolean | null;
  expires_at: string | null;
  updated_at: string;
};

const STOP_WORDS = new Set([
  'para','como','esta','este','esto','desde','ahora','cuando','donde','porque','pero','sobre','entre','unos','unas','todo','toda','todos','todas',
  'quiero','puede','puedes','debe','debes','hacer','haga','hagas','tiene','tienen','tener','usar','uses','usar','solo','siempre','nunca','regla','recuerda',
  'guarda','memoriza','anota','wonka','remy','agente','agentes','negocio','negocios','manito','vegano','vegan','del','los','las','una','uno','que','con','sin',
]);

function normalize(value: string) {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

export function memoryTerms(value: string, limit = 10) {
  const seen = new Set<string>();
  const terms: string[] = [];
  for (const token of normalize(value).split(/\s+/)) {
    if (token.length < 3 || STOP_WORDS.has(token) || seen.has(token)) continue;
    seen.add(token);
    terms.push(token);
    if (terms.length >= limit) break;
  }
  return terms;
}

function memoryKey(value: string) {
  const terms = memoryTerms(value, 8);
  return (terms.length ? terms.join('-') : normalize(value).slice(0, 72).replace(/\s+/g, '-')).slice(0, 96) || 'memory';
}

function safeTags(value: string) {
  return memoryTerms(value, 8).map((item) => item.slice(0, 40));
}

export type ExplicitMemoryRequest = {
  value: string;
  scope: AgentMemoryScope;
  targetAgent: string;
  pinned: boolean;
  priority: number;
};

export function parseExplicitMemoryRequest(text: string): ExplicitMemoryRequest | null {
  const raw = String(text || '').trim();
  if (!raw || raw.length > 1400) return null;
  const match = raw.match(/^\s*(?:wonka[\s,:-]+)?(?:(?:por\s+favor\s+)?(?:recuerda|memoriza|guarda|anota)(?:\s+como\s+(?:una\s+)?regla)?|desde\s+ahora(?:\s+recuerda)?)(?:\s+que)?\s+(.{3,800}?)\s*[.!]?\s*$/i);
  if (!match) return null;

  const value = match[1].trim();
  const businessScoped = /\b(?:la manito|este negocio|negocio actual|para el negocio|para la marca)\b/i.test(raw);
  const globalAgents = /\b(?:todos los agentes|todos mis agentes|regla global|para todos los agentes)\b/i.test(raw);
  const remyTarget = /\bremy\b/i.test(raw);
  const pinned = /\b(?:siempre|nunca|regla|desde ahora|de aqui en adelante|de aquí en adelante)\b/i.test(raw);

  return {
    value,
    scope: businessScoped ? 'business' : 'owner',
    targetAgent: globalAgents ? '*' : remyTarget ? 'remy' : 'wonka',
    pinned,
    priority: pinned ? 95 : 75,
  };
}

export async function saveAgentMemory(
  db: SupabaseClient,
  input: {
    ownerUserId?: string | null;
    businessUnitId?: string | null;
    agent: string;
    scope: AgentMemoryScope;
    entityId?: string | null;
    value: string;
    pinned?: boolean;
    priority?: number;
    source?: string;
  },
) {
  const value = compactText(input.value, 800);
  if (!value) throw new Error('memory_value_required');
  const key = memoryKey(value);
  const ownerUserId = input.ownerUserId || null;
  const businessUnitId = input.scope === 'business' || input.scope === 'customer' || input.scope === 'project' || input.scope === 'conversation'
    ? input.businessUnitId || null
    : null;
  const entityId = input.entityId || null;

  let existingQuery = db.from('agent_memories')
    .select('id')
    .eq('agent', input.agent)
    .eq('scope', input.scope)
    .eq('memory_key', key)
    .limit(1);
  existingQuery = ownerUserId ? existingQuery.eq('owner_user_id', ownerUserId) : existingQuery.is('owner_user_id', null);
  existingQuery = businessUnitId ? existingQuery.eq('business_unit_id', businessUnitId) : existingQuery.is('business_unit_id', null);
  existingQuery = entityId ? existingQuery.eq('entity_id', entityId) : existingQuery.is('entity_id', null);

  const { data: existing, error: existingError } = await existingQuery.maybeSingle();
  if (existingError) throw existingError;

  const payload = {
    owner_user_id: ownerUserId,
    business_unit_id: businessUnitId,
    agent: input.agent,
    scope: input.scope,
    entity_id: entityId,
    memory_key: key,
    value,
    tags: safeTags(value),
    priority: Math.max(0, Math.min(100, Math.round(Number(input.priority ?? 75)))),
    pinned: Boolean(input.pinned),
    active: true,
    source: String(input.source || 'explicit').slice(0, 40),
    updated_at: new Date().toISOString(),
  };

  if (existing?.id) {
    const { data, error } = await db.from('agent_memories').update(payload).eq('id', existing.id).select('id,memory_key,scope,pinned').single();
    if (error) throw error;
    return { ...data, updated: true };
  }

  const { data, error } = await db.from('agent_memories').insert(payload).select('id,memory_key,scope,pinned').single();
  if (error) throw error;
  return { ...data, updated: false };
}

function scoreMemory(row: MemoryRow, terms: string[], entityId?: string | null) {
  const haystack = normalize(`${row.memory_key} ${row.value} ${(row.tags || []).join(' ')}`);
  let matches = 0;
  for (const term of terms) if (haystack.includes(term)) matches += 1;
  let score = Number(row.priority || 0) + matches * 28;
  if (row.pinned) score += 45;
  if (entityId && row.entity_id === entityId) score += 35;
  if (row.scope === 'owner' || row.scope === 'business') score += 5;
  return { score, matches };
}

export async function loadRelevantMemoryContext(
  db: SupabaseClient,
  input: {
    agent: string;
    query: string;
    ownerUserId?: string | null;
    businessUnitId?: string | null;
    entityId?: string | null;
    maxChars?: number;
    maxItems?: number;
  },
) {
  const maxChars = Math.max(0, Math.min(800, Math.round(Number(input.maxChars ?? 320))));
  const maxItems = Math.max(1, Math.min(6, Math.round(Number(input.maxItems ?? 4))));
  if (!maxChars) return { text: '', count: 0, ids: [] as string[] };

  let query = db.from('agent_memories')
    .select('id,owner_user_id,business_unit_id,agent,scope,entity_id,memory_key,value,tags,priority,pinned,expires_at,updated_at')
    .eq('active', true)
    .in('agent', [input.agent, '*'])
    .order('pinned', { ascending: false })
    .order('priority', { ascending: false })
    .order('updated_at', { ascending: false })
    .limit(40);

  const owner = input.ownerUserId || null;
  const business = input.businessUnitId || null;
  if (owner && business) query = query.or(`owner_user_id.eq.${owner},business_unit_id.eq.${business}`);
  else if (owner) query = query.eq('owner_user_id', owner);
  else if (business) query = query.eq('business_unit_id', business);
  else return { text: '', count: 0, ids: [] as string[] };

  const { data, error } = await query;
  if (error) {
    console.warn('agent_memory_load_failed', { agent: input.agent, detail: error.message });
    return { text: '', count: 0, ids: [] as string[] };
  }

  const now = Date.now();
  const terms = memoryTerms(input.query, 10);
  const ranked = ((data || []) as MemoryRow[])
    .filter((row) => !row.expires_at || new Date(row.expires_at).getTime() > now)
    .map((row) => ({ row, ...scoreMemory(row, terms, input.entityId) }))
    .filter((item) => item.row.pinned || item.matches > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxItems);

  const lines: string[] = [];
  const ids: string[] = [];
  let used = 0;
  for (const item of ranked) {
    const line = `- ${compactText(item.row.value, 180)}`;
    if (lines.length && used + line.length + 1 > maxChars) break;
    if (!lines.length && line.length > maxChars) {
      lines.push(compactText(line, maxChars));
      ids.push(item.row.id);
      break;
    }
    lines.push(line);
    ids.push(item.row.id);
    used += line.length + 1;
  }

  if (!lines.length) return { text: '', count: 0, ids: [] as string[] };
  return {
    text: `[MEMORIA RELEVANTE — úsala solo si aplica]\n${lines.join('\n')}\n[FIN MEMORIA]`,
    count: lines.length,
    ids,
  };
}
