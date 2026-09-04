import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

test('Groq Provider compatibility: uses max_tokens instead of max_completion_tokens for standard models', () => {
  const providersCode = read('src/lib/ai/providers/index.ts');
  assert.match(providersCode, /const requiredToolTokens = requiredToolName \? Math\.max\(input\.maxOutputTokens, 2048\) : input\.maxOutputTokens/);
  assert.match(providersCode, /payload\.max_tokens\s*=\s*requiredToolTokens/);
});

test('Groq Provider compatibility: strips additionalProperties and omits parallel_tool_calls for Groq', () => {
  const providersCode = read('src/lib/ai/providers/index.ts');
  assert.match(providersCode, /if\s*\(\s*provider\s*!==\s*'groq'\s*\)\s*\{\s*allowed\.add\('additionalProperties'\)/);
  assert.match(providersCode, /if\s*\(\s*input\.provider\s*!==\s*'groq'/);
});

test('Groq Resilience: callAiProvider implements automatic fallback to Gemini with loop protection', () => {
  const providersCode = read('src/lib/ai/providers/index.ts');
  assert.match(providersCode, /ai_provider_fallback_triggered/);
  assert.match(providersCode, /fallbackProvider:\s*'gemini'/);
  assert.match(providersCode, /fallbackModel:\s*'gemini-2.5-flash'/);
  assert.match(providersCode, /options:\s*\{\s*allowFallback\?:\s*boolean\s*\}/);
});

test('Wonka Hub Route: handles AI provider failures with friendly message without leaking raw error codes', () => {
  const routeCode = read('src/app/api/admin/wonka/chat/route.ts');
  assert.match(routeCode, /friendlyError/);
  assert.match(routeCode, /Wonka no pudo completar la solicitud en este momento/);
  assert.match(routeCode, /error:\s*friendlyError/);
});

test('Wonka default Groq model: uses valid Groq model llama-3.3-70b-versatile', () => {
  const wonkaCode = read('src/lib/ai/wonka.ts');
  assert.match(wonkaCode, /llama-3\.3-70b-versatile/);
});
