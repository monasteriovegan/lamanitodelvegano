// lib/models.js
// Catálogo completo de modelos disponibles en el CRM

export const MODELS = [
  // ── Anthropic ──────────────────────────────────────────
  {
    id: "claude-sonnet-4-6",
    label: "Claude Sonnet 4.6",
    provider: "Anthropic",
    tag: "⚡ Recomendado",
    color: "#2D6A4F",
    envKey: "ANTHROPIC_API_KEY",
  },
  {
    id: "claude-opus-4-6",
    label: "Claude Opus 4.6",
    provider: "Anthropic",
    tag: "🧠 Más potente",
    color: "#2D6A4F",
    envKey: "ANTHROPIC_API_KEY",
  },
  {
    id: "claude-haiku-4-5-20251001",
    label: "Claude Haiku 4.5",
    provider: "Anthropic",
    tag: "🚀 Más rápido",
    color: "#2D6A4F",
    envKey: "ANTHROPIC_API_KEY",
  },

  // ── OpenAI ─────────────────────────────────────────────
  {
    id: "gpt-4o",
    label: "GPT-4o",
    provider: "OpenAI",
    tag: "🔵 Versátil",
    color: "#10A37F",
    envKey: "OPENAI_API_KEY",
  },
  {
    id: "gpt-4o-mini",
    label: "GPT-4o Mini",
    provider: "OpenAI",
    tag: "🔵 Económico",
    color: "#10A37F",
    envKey: "OPENAI_API_KEY",
  },
  {
    id: "o3-mini",
    label: "o3 Mini",
    provider: "OpenAI",
    tag: "🔵 Razonamiento",
    color: "#10A37F",
    envKey: "OPENAI_API_KEY",
  },

  // ── Google ─────────────────────────────────────────────
  {
    id: "gemini-2.0-flash",
    label: "Gemini 2.0 Flash",
    provider: "Google",
    tag: "🟡 Rápido",
    color: "#F4B400",
    envKey: "GOOGLE_API_KEY",
  },
  {
    id: "gemini-2.5-pro",
    label: "Gemini 2.5 Pro",
    provider: "Google",
    tag: "🟡 Avanzado",
    color: "#F4B400",
    envKey: "GOOGLE_API_KEY",
  },

  // ── xAI ────────────────────────────────────────────────
  {
    id: "grok-3",
    label: "Grok 3",
    provider: "xAI",
    tag: "⚫ Potente",
    color: "#1A1A1A",
    envKey: "XAI_API_KEY",
  },
  {
    id: "grok-3-mini",
    label: "Grok 3 Mini",
    provider: "xAI",
    tag: "⚫ Rápido",
    color: "#1A1A1A",
    envKey: "XAI_API_KEY",
  },

  // ── Alibaba ────────────────────────────────────────────
  {
    id: "qwen-max",
    label: "Qwen Max",
    provider: "Qwen",
    tag: "🟠 Potente",
    color: "#FF6A00",
    envKey: "DASHSCOPE_API_KEY",
  },
  {
    id: "qwen-turbo",
    label: "Qwen Turbo",
    provider: "Qwen",
    tag: "🟠 Rápido",
    color: "#FF6A00",
    envKey: "DASHSCOPE_API_KEY",
  },
];

export const PROVIDERS = [...new Set(MODELS.map(m => m.provider))];

export const getModel = (id) => MODELS.find(m => m.id === id) || MODELS[0];
