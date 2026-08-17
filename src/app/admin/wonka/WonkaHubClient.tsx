'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PageHeader } from '../_ui/AdminUI';

type StoredMessage = {
  id: string;
  role: 'user' | 'assistant' | 'tool' | 'system';
  content: string;
  metadata?: any;
  created_at: string;
};

type PendingTool = { name: string; args: Record<string, unknown> };
type CalendarStatus = { oauthConfigured: boolean; connected: boolean; account: string | null; expiresAt: string | null };

function time(value: string) {
  return new Date(value).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
}

function describeTool(tool: PendingTool) {
  if (tool.name === 'set_remy_global') return `${Boolean(tool.args?.enabled) ? 'Activar' : 'Pausar'} Remy globalmente`;
  if (tool.name === 'set_conversation_ai') return `${Boolean(tool.args?.enabled) ? 'Activar' : 'Pausar'} Remy en una conversación`;
  if (tool.name === 'create_calendar_event') return `Crear en Google Calendar: ${String(tool.args?.summary || 'evento')}`;
  return `Ejecutar ${tool.name}`;
}

export default function WonkaHubClient() {
  const [messages, setMessages] = useState<StoredMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingTool | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [mcpToken, setMcpToken] = useState<string | null>(null);
  const [creatingToken, setCreatingToken] = useState(false);
  const [calendar, setCalendar] = useState<CalendarStatus | null>(null);
  const chatRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    const response = await fetch('/api/admin/wonka/chat', { cache: 'no-store' });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || 'No se pudo cargar Wonka Hub');
    setMessages(body.messages || []);
    const lastPending = [...(body.messages || [])].reverse().find((message: StoredMessage) => message.role === 'assistant' && message.metadata?.pending_tool)?.metadata?.pending_tool || null;
    setPending(lastPending);
  }, []);

  const loadCalendar = useCallback(async () => {
    const response = await fetch('/api/admin/wonka/google-calendar/status', { cache: 'no-store' });
    if (!response.ok) return;
    setCalendar(await response.json());
  }, []);

  useEffect(() => {
    Promise.all([load(), loadCalendar()])
      .catch((err) => setError(err instanceof Error ? err.message : 'Error cargando Wonka'))
      .finally(() => setLoading(false));
  }, [load, loadCalendar]);

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== 'visible') return;
      void load().catch(() => undefined);
    };
    const interval = window.setInterval(refresh, 4000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [load]);

  useEffect(() => {
    const node = chatRef.current;
    if (!node) return;
    node.scrollTo({ top: node.scrollHeight, behavior: 'smooth' });
  }, [messages, sending, pending]);

  useEffect(() => {
    // Wonka Hub ya es el chat completo: ocultamos el segundo launcher flotante solo aquí.
    const floating = document.querySelector<HTMLElement>('[data-wonka-floating]');
    if (!floating) return;
    const previous = floating.style.display;
    floating.style.display = 'none';
    return () => { floating.style.display = previous; };
  }, []);

  const send = async (textOverride?: string) => {
    const text = String(textOverride ?? input).trim();
    if (!text || sending) return;
    setSending(true);
    setError(null);
    setPending(null);
    if (!textOverride) setInput('');
    try {
      const response = await fetch('/api/admin/wonka/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Wonka no pudo responder');
      setMessages((current) => [...current, body.userMessage, body.assistantMessage].filter(Boolean));
      setPending(body.pendingTool || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Wonka no pudo responder');
    } finally {
      setSending(false);
    }
  };

  const confirmTool = async () => {
    if (!pending || confirming) return;
    setConfirming(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/wonka/tool', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: pending.name, args: pending.args, confirm: true }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'No se pudo ejecutar la acción');
      const action = describeTool(pending);
      setPending(null);
      await loadCalendar();
      await send(`Acción confirmada y ejecutada: ${action}. Resultado: ${JSON.stringify(body.result)}. Confírmame brevemente el nuevo estado.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo ejecutar la acción');
    } finally {
      setConfirming(false);
    }
  };

  const createMcpToken = async () => {
    if (creatingToken) return;
    setCreatingToken(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/wonka/mcp-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Wonka Hub / ChatGPT-Codex', allowWrite: false }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'No se pudo crear token MCP');
      setMcpToken(body.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear token MCP');
    } finally {
      setCreatingToken(false);
    }
  };

  const quickActions = useMemo(() => [
    'Wonka, dame un resumen operativo del negocio ahora.',
    '¿Qué pedidos recientes necesitan atención?',
    '¿Cuántas conversaciones tengo sin leer y por qué canales?',
    'Muéstrame el estado de Remy y las conversaciones donde está activo.',
    'Revisa el catálogo y dime qué productos activos tenemos.',
    '¿Qué tengo en mi calendario próximamente?',
  ], []);

  return (
    <div className="text-crema md:max-w-[1320px]">
      <div className="hidden md:block">
        <PageHeader
          eyebrow="✦ Director personal"
          title="Wonka Hub"
          action={
            <div className="flex flex-wrap gap-2 text-[11px]">
              <span className="rounded-full border border-neon/30 bg-neon/10 px-3 py-1.5 text-neon font-semibold">● Director online</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-white/55">Gemini · Tool Layer</span>
            </div>
          }
        />
      </div>

      {error && <div className="fixed left-3 right-3 top-16 z-[60] rounded-xl border border-red-400/30 bg-[#2a0c0c] px-4 py-3 text-xs text-red-200 md:static md:mb-4">{error}</div>}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
        <section className="fixed inset-x-0 top-0 bottom-[68px] z-40 flex min-h-0 flex-col overflow-hidden bg-[#050e0a] md:static md:min-h-[720px] md:rounded-2xl md:border md:border-white/10">
          <header className="shrink-0 border-b border-white/10 px-3 py-2.5 md:px-5 md:py-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="font-display text-base font-black text-white md:text-lg">🎩 Wonka</div>
                  <span className="rounded-full border border-neon/25 bg-neon/10 px-2 py-0.5 text-[9px] font-bold text-neon">● online</span>
                </div>
                <div className="mt-0.5 text-[10px] text-white/40 md:mt-1 md:text-[11px]">Director personal · Gemini · Tool Layer</div>
              </div>
              <div className="hidden text-[10px] text-neon/70 md:block">acciones reales requieren confirmación</div>
            </div>
          </header>

          <div className="shrink-0 border-b border-white/8 bg-black/10 px-2 py-2 md:hidden">
            <div className="flex gap-2 overflow-x-auto overscroll-x-contain pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {quickActions.slice(0, 4).map((action, index) => (
                <button key={action} onClick={() => void send(action)} disabled={sending} className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-[10px] font-semibold text-white/65 disabled:opacity-40">
                  {index === 0 ? '⚡ Resumen' : index === 1 ? '📦 Pedidos' : index === 2 ? '💬 Chats' : '🤖 Remy'}
                </button>
              ))}
            </div>
          </div>

          <div ref={chatRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain bg-black/10 px-3 py-3 md:space-y-4 md:px-6 md:py-6">
            {loading ? (
              <div className="py-12 text-center text-xs text-white/40">Cargando memoria de Wonka…</div>
            ) : messages.length === 0 ? (
              <div className="mx-auto max-w-xl py-12 text-center">
                <div className="mb-5 text-5xl">🎩</div>
                <h2 className="text-xl font-black text-white">Tu director está listo</h2>
                <p className="mt-3 text-sm leading-6 text-white/50">Pregúntale por pedidos, clientes, conversaciones, catálogo, calendario y Remy. Los cambios importantes se confirman antes de ejecutarse.</p>
              </div>
            ) : messages.map((message) => {
              if (!['user', 'assistant'].includes(message.role)) return null;
              const mine = message.role === 'user';
              return (
                <div key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[92%] rounded-2xl px-3.5 py-2.5 text-[14px] leading-5 md:max-w-[88%] md:px-4 md:py-3 md:text-sm md:leading-6 ${mine ? 'rounded-br-md bg-neon text-[#03110b]' : 'rounded-bl-md border border-white/10 bg-white/[0.06] text-white'}`}>
                    <div className="whitespace-pre-wrap break-words">{message.content}</div>
                    <div className={`mt-1.5 text-[9px] ${mine ? 'text-black/45' : 'text-white/30'}`}>{mine ? 'Tú' : 'Wonka'} · {time(message.created_at)}</div>
                  </div>
                </div>
              );
            })}
            {sending && <div className="flex justify-start"><div className="rounded-2xl border border-white/10 bg-white/[0.05] px-3.5 py-2.5 text-xs text-white/45">Wonka está pensando…</div></div>}

            {pending && (
              <div className="max-w-2xl rounded-2xl border border-amber-400/30 bg-amber-400/10 p-3 md:p-4">
                <div className="text-[10px] font-bold uppercase tracking-wider text-amber-200/70 md:text-xs">Confirmación requerida</div>
                <div className="mt-2 text-sm font-bold text-white">{describeTool(pending)}</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button onClick={() => void confirmTool()} disabled={confirming} className="min-h-11 rounded-full bg-amber-300 px-4 py-2 text-xs font-black text-black disabled:opacity-50">{confirming ? 'Ejecutando…' : 'Confirmar acción'}</button>
                  <button onClick={() => setPending(null)} className="min-h-11 rounded-full border border-white/10 px-4 py-2 text-xs font-bold text-white/60">Cancelar</button>
                </div>
              </div>
            )}
          </div>

          <footer className="shrink-0 border-t border-white/10 bg-[#050e0a] p-2.5 pb-[max(10px,env(safe-area-inset-bottom))] md:p-4">
            <div className="flex items-end gap-2 md:gap-3">
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void send();
                  }
                }}
                rows={3}
                maxLength={8000}
                placeholder="Escribe a Wonka…"
                className="h-11 min-h-11 flex-1 resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-neon/50 md:h-auto md:px-4 md:py-3"
              />
              <button onClick={() => void send()} disabled={sending || !input.trim()} className="min-h-11 rounded-xl bg-neon px-4 py-2.5 text-sm font-black text-black transition-colors hover:bg-white disabled:opacity-40 md:px-5 md:py-3">Enviar</button>
            </div>
          </footer>
        </section>

        <aside className="hidden space-y-5 md:block">
          <section className="rounded-2xl border border-white/10 bg-[#050e0a] p-4">
            <h3 className="text-sm font-bold text-white">⚡ Atajos</h3>
            <div className="mt-3 space-y-2">
              {quickActions.map((action) => <button key={action} onClick={() => void send(action)} disabled={sending} className="w-full rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2.5 text-left text-xs text-white/60 transition-colors hover:border-neon/30 hover:text-white">{action}</button>)}
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-[#050e0a] p-4">
            <h3 className="text-sm font-bold text-white">🧠 Capacidades actuales</h3>
            <div className="mt-3 grid gap-2 text-xs text-white/55">
              <div className="rounded-lg bg-white/[0.03] p-2.5">✓ Pedidos y estado de pago</div>
              <div className="rounded-lg bg-white/[0.03] p-2.5">✓ CRM y búsqueda de clientes</div>
              <div className="rounded-lg bg-white/[0.03] p-2.5">✓ WhatsApp / Instagram / Web</div>
              <div className="rounded-lg bg-white/[0.03] p-2.5">✓ Catálogo y stock</div>
              <div className="rounded-lg bg-white/[0.03] p-2.5">✓ Control seguro de Remy</div>
              <div className={`rounded-lg p-2.5 ${calendar?.connected ? 'bg-neon/[0.06] text-neon/80' : 'border border-amber-400/10 bg-amber-400/[0.04] text-amber-100/60'}`}>
                {calendar?.connected ? `✓ Google Calendar · ${calendar.account || 'conectado'}` : '◷ Google Calendar pendiente de autorización'}
              </div>
            </div>
            {!calendar?.connected && (
              calendar?.oauthConfigured
                ? <a href="/api/admin/wonka/google-calendar/connect" className="mt-3 inline-flex rounded-full border border-neon/30 bg-neon/10 px-4 py-2 text-xs font-bold text-neon">Conectar Google Calendar</a>
                : <p className="mt-3 text-[10px] leading-4 text-amber-100/55">El flujo OAuth ya está implementado. Para habilitar el botón faltan GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET en el entorno de Vercel.</p>
            )}
          </section>

          <section className="rounded-2xl border border-white/10 bg-[#050e0a] p-4">
            <h3 className="text-sm font-bold text-white">🔌 Synthetiq MCP</h3>
            <p className="mt-2 text-xs leading-5 text-white/45">El mismo Tool Layer puede ser usado por clientes MCP como ChatGPT/Codex compatibles. Genera primero un token de solo lectura.</p>
            <div className="mt-3 break-all rounded-lg border border-white/8 bg-black/20 px-3 py-2 font-mono text-[10px] text-neon/70">https://lamanitodelvegano.vercel.app/api/mcp</div>
            {!mcpToken ? (
              <button onClick={() => void createMcpToken()} disabled={creatingToken} className="mt-3 rounded-full border border-neon/30 bg-neon/10 px-4 py-2 text-xs font-bold text-neon disabled:opacity-50">{creatingToken ? 'Generando…' : 'Generar token MCP lectura'}</button>
            ) : (
              <div className="mt-3 rounded-xl border border-amber-400/20 bg-amber-400/10 p-3">
                <div className="text-[10px] font-bold text-amber-100">Se muestra una sola vez</div>
                <div className="mt-2 break-all font-mono text-[10px] text-white/75">{mcpToken}</div>
                <button onClick={() => navigator.clipboard.writeText(mcpToken).catch(() => undefined)} className="mt-2 text-[10px] font-bold text-neon">Copiar al portapapeles</button>
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-neon/15 bg-neon/[0.04] p-4">
            <h3 className="text-sm font-bold text-white">📱 Synthetiq Panel Maestro</h3>
            <p className="mt-2 text-xs leading-5 text-white/50">En el teléfono abre “Más” y toca “Instalar Panel Maestro”. La app instalada abre el /admin completo, no solamente Wonka.</p>
          </section>
        </aside>
      </div>
    </div>
  );
}
