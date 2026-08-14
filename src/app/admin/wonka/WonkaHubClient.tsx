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

type DeferredInstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

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
  const [installPrompt, setInstallPrompt] = useState<DeferredInstallPrompt | null>(null);
  const [mcpToken, setMcpToken] = useState<string | null>(null);
  const [creatingToken, setCreatingToken] = useState(false);
  const [calendar, setCalendar] = useState<CalendarStatus | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

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
    const panel = chatScrollRef.current;
    if (!panel) return;
    panel.scrollTo({ top: panel.scrollHeight, behavior: 'smooth' });
  }, [messages, sending, pending]);

  useEffect(() => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/wonka-sw.js').catch(() => undefined);
    const handler = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as DeferredInstallPrompt);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
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

  const install = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice.catch(() => undefined);
    setInstallPrompt(null);
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
    <div className="max-w-[1320px] text-crema">
      <PageHeader
        eyebrow="✦ Director personal"
        title="Wonka Hub"
        action={
          <div className="flex flex-wrap gap-2 text-[11px]">
            <span className="rounded-full border border-neon/30 bg-neon/10 px-3 py-1.5 text-neon font-semibold">● Director online</span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-white/55">Gemini · Tool Layer</span>
            {installPrompt && <button onClick={() => void install()} className="rounded-full border border-neon/30 bg-neon/10 px-3 py-1.5 text-neon font-semibold">⬇ Instalar panel</button>}
          </div>
        }
      />

      {error && <div className="mb-4 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-xs text-red-200">{error}</div>}

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_330px] gap-5 items-start">
        <section className="rounded-2xl border border-white/10 bg-[#050e0a] h-[calc(100vh-190px)] min-h-[560px] max-h-[820px] flex flex-col overflow-hidden sticky top-4">
          <header className="shrink-0 border-b border-white/10 px-5 py-4 flex items-center justify-between gap-3">
            <div>
              <div className="font-display font-black text-lg text-white">🎩 Hablar con Wonka</div>
              <div className="text-[11px] text-white/40 mt-1">Mismo director, misma memoria operativa, herramientas reales del negocio.</div>
            </div>
            <div className="text-[10px] text-neon/70">acciones reales requieren confirmación</div>
          </header>

          <div ref={chatScrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-4 bg-black/10 overscroll-contain">
            {loading ? (
              <div className="text-xs text-white/40 text-center py-12">Cargando memoria de Wonka…</div>
            ) : messages.length === 0 ? (
              <div className="max-w-xl mx-auto py-12 text-center">
                <div className="text-5xl mb-5">🎩</div>
                <h2 className="text-xl font-black text-white">Tu director está listo</h2>
                <p className="mt-3 text-sm text-white/50 leading-6">Puedes preguntarle por pedidos, clientes, conversaciones, catálogo, calendario y estado de Remy. Los cambios importantes se confirman antes de ejecutarse.</p>
              </div>
            ) : messages.map((message) => {
              if (!['user', 'assistant'].includes(message.role)) return null;
              const mine = message.role === 'user';
              return (
                <div key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-6 ${mine ? 'bg-neon text-[#03110b] rounded-br-md' : 'bg-white/[0.06] text-white border border-white/10 rounded-bl-md'}`}>
                    <div className="whitespace-pre-wrap break-words">{message.content}</div>
                    <div className={`mt-1.5 text-[9px] ${mine ? 'text-black/45' : 'text-white/30'}`}>{mine ? 'Tú' : 'Wonka'} · {time(message.created_at)}</div>
                  </div>
                </div>
              );
            })}
            {sending && <div className="flex justify-start"><div className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-xs text-white/45">Wonka está pensando y consultando herramientas…</div></div>}

            {pending && (
              <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 max-w-2xl">
                <div className="text-xs uppercase tracking-wider text-amber-200/70 font-bold">Confirmación requerida</div>
                <div className="mt-2 text-sm font-bold text-white">{describeTool(pending)}</div>
                <div className="mt-3 flex gap-2">
                  <button onClick={() => void confirmTool()} disabled={confirming} className="rounded-full bg-amber-300 px-4 py-2 text-xs font-black text-black disabled:opacity-50">{confirming ? 'Ejecutando…' : 'Confirmar acción'}</button>
                  <button onClick={() => setPending(null)} className="rounded-full border border-white/10 px-4 py-2 text-xs font-bold text-white/60">Cancelar</button>
                </div>
              </div>
            )}
          </div>

          <footer className="shrink-0 border-t border-white/10 p-4 bg-[#050e0a]">
            <div className="flex gap-3 items-end">
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void send();
                  }
                }}
                rows={2}
                maxLength={8000}
                placeholder="Wonka, ¿qué tengo pendiente hoy?"
                className="flex-1 resize-none rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white outline-none focus:border-neon/50"
              />
              <button onClick={() => void send()} disabled={sending || !input.trim()} className="rounded-xl bg-neon text-black font-black text-sm px-5 py-3 disabled:opacity-40 hover:bg-white transition-colors">Enviar</button>
            </div>
          </footer>
        </section>

        <aside className="space-y-5">
          <section className="rounded-2xl border border-white/10 bg-[#050e0a] p-4">
            <h3 className="font-bold text-white text-sm">⚡ Atajos</h3>
            <div className="mt-3 space-y-2">
              {quickActions.map((action) => <button key={action} onClick={() => void send(action)} disabled={sending} className="w-full text-left rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2.5 text-xs text-white/60 hover:text-white hover:border-neon/30 transition-colors">{action}</button>)}
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-[#050e0a] p-4">
            <h3 className="font-bold text-white text-sm">🧠 Capacidades actuales</h3>
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
            <h3 className="font-bold text-white text-sm">🔌 Synthetiq MCP</h3>
            <p className="mt-2 text-xs leading-5 text-white/45">El mismo Tool Layer puede ser usado por clientes MCP como ChatGPT/Codex compatibles. Genera primero un token de solo lectura.</p>
            <div className="mt-3 rounded-lg bg-black/20 border border-white/8 px-3 py-2 text-[10px] font-mono text-neon/70 break-all">https://lamanitodelvegano.vercel.app/api/mcp</div>
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
            <h3 className="font-bold text-white text-sm">📱 Synthetiq Panel</h3>
            <p className="mt-2 text-xs leading-5 text-white/50">La app instalable ahora abre el panel administrativo completo. Wonka queda disponible como director flotante en todo el admin.</p>
            <div className="mt-3 text-[10px] text-white/35">Desde Chrome usa “Instalar aplicación” o “Añadir a pantalla de inicio”.</div>
          </section>
        </aside>
      </div>
    </div>
  );
}
