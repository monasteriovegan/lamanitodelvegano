'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

type Message = { id: string; role: 'user' | 'assistant' | 'tool' | 'system'; content: string; metadata?: any; created_at: string };
type PendingTool = { name: string; args: Record<string, unknown> };

function getPageContext(pathname: string) {
  const main = document.querySelector('main');
  const visibleText = (main?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 6000);
  return { path: pathname, title: document.title, visibleText };
}

function toolLabel(tool: PendingTool) {
  if (tool.name === 'set_remy_global') return `${Boolean(tool.args?.enabled) ? 'Activar' : 'Pausar'} Remy globalmente`;
  if (tool.name === 'set_conversation_ai') return `${Boolean(tool.args?.enabled) ? 'Activar' : 'Pausar'} Remy en esta conversación`;
  if (tool.name === 'create_calendar_event') return `Crear “${String(tool.args?.summary || 'evento')}” en Calendar`;
  return `Ejecutar ${tool.name}`;
}

export function WonkaFloatingDirector() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingTool | null>(null);
  const [initialized, setInitialized] = useState(false);
  const chatRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open || initialized) return;
    setLoading(true);
    fetch('/api/admin/wonka/chat', { cache: 'no-store' })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || 'No se pudo cargar Wonka');
        setMessages(body.messages || []);
        const lastPending = [...(body.messages || [])].reverse().find((m: Message) => m.role === 'assistant' && m.metadata?.pending_tool)?.metadata?.pending_tool || null;
        setPending(lastPending);
        setInitialized(true);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'No se pudo cargar Wonka'))
      .finally(() => setLoading(false));
  }, [open, initialized]);

  useEffect(() => {
    const node = chatRef.current;
    if (!node) return;
    node.scrollTo({ top: node.scrollHeight, behavior: 'smooth' });
  }, [messages, loading, pending]);

  async function send(textOverride?: string) {
    const text = String(textOverride ?? input).trim();
    if (!text || loading) return;
    setLoading(true);
    setError(null);
    setPending(null);
    if (!textOverride) setInput('');
    try {
      const response = await fetch('/api/admin/wonka/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, pageContext: getPageContext(pathname) }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Wonka no pudo responder');
      setMessages((current) => [...current, body.userMessage, body.assistantMessage].filter(Boolean));
      setPending(body.pendingTool || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Wonka no pudo responder');
    } finally {
      setLoading(false);
    }
  }

  async function confirmTool() {
    if (!pending || loading) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/wonka/tool', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: pending.name, args: pending.args, confirm: true }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'No se pudo ejecutar la acción');
      const label = toolLabel(pending);
      setPending(null);
      setMessages((current) => [...current, {
        id: `action-${Date.now()}`,
        role: 'assistant',
        content: `✓ ${label} ejecutado correctamente.`,
        created_at: new Date().toISOString(),
      }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo ejecutar la acción');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed bottom-[82px] right-3 z-[900] md:bottom-4 md:right-4" data-wonka-floating>
      {open && (
        <section className="fixed inset-x-2 bottom-[82px] top-3 rounded-2xl border border-neon/30 bg-[#03100b]/[0.99] shadow-[0_20px_70px_rgba(0,0,0,0.65),0_0_30px_rgba(0,255,179,0.12)] backdrop-blur-xl overflow-hidden flex flex-col md:absolute md:inset-auto md:bottom-[74px] md:right-0 md:w-[min(430px,calc(100vw-24px))] md:h-[min(680px,calc(100vh-110px))]">
          <header className="shrink-0 px-4 py-3 border-b border-white/10 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-black text-white">🎩 Wonka · Director</div>
              <div className="text-[10px] text-neon/65 truncate">Viendo: {pathname}</div>
            </div>
            <div className="flex gap-2 items-center">
              <span className="text-[9px] rounded-full border border-neon/25 bg-neon/10 px-2 py-1 text-neon">● online</span>
              <button onClick={() => setOpen(false)} className="w-8 h-8 rounded-full border border-white/10 text-white/60 hover:text-white">×</button>
            </div>
          </header>

          <div ref={chatRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 space-y-3">
            {messages.length === 0 && !loading && (
              <div className="py-8 text-center">
                <div className="text-4xl">🎩</div>
                <div className="mt-3 text-sm font-bold text-white">Estoy viendo esta pantalla contigo</div>
                <div className="mt-1 text-xs text-white/45">Pregúntame por lo que aparece aquí o por pedidos, CRM, conversaciones, catálogo y agenda.</div>
                <button onClick={() => void send('Wonka, explícame qué estoy viendo en esta pantalla y qué debería revisar primero.')} className="mt-4 rounded-full border border-neon/30 bg-neon/10 px-4 py-2 text-xs font-bold text-neon">Analizar esta pantalla</button>
              </div>
            )}
            {messages.filter((m) => m.role === 'user' || m.role === 'assistant').slice(-40).map((message) => {
              const mine = message.role === 'user';
              return (
                <div key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-xs leading-5 whitespace-pre-wrap ${mine ? 'bg-neon text-[#02110b] rounded-br-md' : 'bg-white/[0.06] text-white/85 border border-white/10 rounded-bl-md'}`}>
                    {message.content}
                  </div>
                </div>
              );
            })}
            {loading && <div className="text-[11px] text-white/40">Wonka está consultando…</div>}
            {pending && (
              <div className="rounded-xl border border-amber-300/30 bg-amber-300/10 p-3">
                <div className="text-[10px] uppercase font-bold text-amber-200/70">Confirmación requerida</div>
                <div className="mt-1 text-xs font-bold text-white">{toolLabel(pending)}</div>
                <div className="mt-3 flex gap-2">
                  <button onClick={() => void confirmTool()} className="rounded-full bg-amber-300 px-3 py-1.5 text-[11px] font-black text-black">Confirmar</button>
                  <button onClick={() => setPending(null)} className="rounded-full border border-white/10 px-3 py-1.5 text-[11px] text-white/60">Cancelar</button>
                </div>
              </div>
            )}
          </div>

          {error && <div className="shrink-0 mx-3 mb-2 rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-[10px] text-red-200">{error}</div>}

          <footer className="shrink-0 border-t border-white/10 bg-[#03100b] p-3 pb-[max(12px,env(safe-area-inset-bottom))]">
            <div className="flex items-end gap-2">
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
                placeholder="Pregúntale a Wonka sobre esta página…"
                className="min-h-[54px] flex-1 resize-none rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-xs text-white outline-none focus:border-neon/50"
              />
              <button onClick={() => void send()} disabled={loading || !input.trim()} className="h-[54px] rounded-xl bg-neon px-4 text-xs font-black text-black disabled:opacity-40">Enviar</button>
            </div>
          </footer>
        </section>
      )}

      <button
        onClick={() => setOpen((value) => !value)}
        aria-label={open ? 'Cerrar Wonka' : 'Abrir Wonka, director personal'}
        title="Hablar con Wonka"
        className="relative w-[56px] h-[56px] md:w-[62px] md:h-[62px] rounded-full border-2 border-neon bg-[#03100b] shadow-[0_0_22px_rgba(0,255,179,0.35)] overflow-hidden hover:scale-105 transition-transform"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/monk_gorilla.png" alt="Wonka Director" className="w-full h-full object-cover" />
        <span className="absolute bottom-0.5 right-0.5 w-3 h-3 rounded-full bg-neon border-2 border-[#03100b]" />
      </button>
    </div>
  );
}
