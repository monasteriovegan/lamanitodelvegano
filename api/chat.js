/**
 * /pages/api/chat.js
 * Proxy multi-proveedor para el CRM de La Manito del Vegano
 * Soporta: Claude (Anthropic), GPT (OpenAI), Gemini (Google), Grok (xAI), Qwen (Alibaba)
 *
 * Variables de entorno requeridas en Vercel:
 *   ANTHROPIC_API_KEY
 *   OPENAI_API_KEY
 *   GOOGLE_API_KEY
 *   XAI_API_KEY
 *   DASHSCOPE_API_KEY
 */

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { model, messages, system, max_tokens = 1000 } = req.body;

  if (!model || !messages) {
    return res.status(400).json({ error: "Faltan campos: model, messages" });
  }

  try {
    let result;

    // ── ANTHROPIC (Claude) ──────────────────────────────────
    if (model.startsWith("claude")) {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) throw new Error("ANTHROPIC_API_KEY no configurada");

      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({ model, messages, system, max_tokens }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error?.message || "Error Anthropic");
      result = data.content?.[0]?.text || "";
    }

    // ── OPENAI (GPT) ────────────────────────────────────────
    else if (model.startsWith("gpt") || model.startsWith("o1") || model.startsWith("o3")) {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) throw new Error("OPENAI_API_KEY no configurada");

      const oaiMessages = system
        ? [{ role: "system", content: system }, ...messages]
        : messages;

      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ model, messages: oaiMessages, max_tokens }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error?.message || "Error OpenAI");
      result = data.choices?.[0]?.message?.content || "";
    }

    // ── GOOGLE (Gemini) ─────────────────────────────────────
    else if (model.startsWith("gemini")) {
      const apiKey = process.env.GOOGLE_API_KEY;
      if (!apiKey) throw new Error("GOOGLE_API_KEY no configurada");

      const geminiMessages = messages.map(m => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: system ? { parts: [{ text: system }] } : undefined,
          contents: geminiMessages,
          generationConfig: { maxOutputTokens: max_tokens },
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error?.message || "Error Gemini");
      result = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    }

    // ── xAI (Grok) ──────────────────────────────────────────
    else if (model.startsWith("grok")) {
      const apiKey = process.env.XAI_API_KEY;
      if (!apiKey) throw new Error("XAI_API_KEY no configurada");

      const grokMessages = system
        ? [{ role: "system", content: system }, ...messages]
        : messages;

      const r = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ model, messages: grokMessages, max_tokens }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error?.message || "Error Grok");
      result = data.choices?.[0]?.message?.content || "";
    }

    // ── ALIBABA (Qwen) ──────────────────────────────────────
    else if (model.startsWith("qwen")) {
      const apiKey = process.env.DASHSCOPE_API_KEY;
      if (!apiKey) throw new Error("DASHSCOPE_API_KEY no configurada");

      const qwenMessages = system
        ? [{ role: "system", content: system }, ...messages]
        : messages;

      const r = await fetch("https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ model, messages: qwenMessages, max_tokens }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error?.message || "Error Qwen");
      result = data.choices?.[0]?.message?.content || "";
    }

    else {
      throw new Error(`Modelo no reconocido: ${model}`);
    }

    return res.status(200).json({ text: result });

  } catch (err) {
    console.error("[chat proxy error]", err.message);
    return res.status(500).json({ error: err.message });
  }
}
