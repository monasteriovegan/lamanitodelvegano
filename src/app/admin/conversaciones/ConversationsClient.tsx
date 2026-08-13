'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { PageHeader, EmptyState } from '../_ui/AdminUI';

type Conversation = {
  id: string;
  name: string;
  phone: string;
  customerId: string | null;
  crmStatus: string;
  externalThreadId: string;
  status: string;
  humanTakeover: boolean;
  unreadCount: number;
  provider: string | null;
  transport: string | null;
  lastMessage: string | null;
  lastDirection: string | null;
  lastMessageStatus: string | null;
  lastMessageAt: string | null;
};

type Message = {
  id: string;
  direction: 'inbound' | 'outbound';
  message_type: string;
  body: string | null;
  status: string | null;
  provider: string | null;
  transport: string | null;
  timestamp: string;
};

function formatDate(value: string | null) {
  if (!value) return '';
  return new Date(value).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' });
}

export default function ConversationsClient() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedId) || null,
    [conversations, selectedId],
  );

  const loadConversations = useCallback(async () => {
    const response = await fetch('/api/admin/conversations', { cache: 'no-store' });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || 'No se pudieron cargar las conversaciones');
    const next = body.data || [];
    setConversations(next);
    setSelectedId((current) => current || next[0]?.id || null);
  }, []);

  const loadMessages = useCallback(async (conversationId: string) => {
    setLoadingMessages(true);
    try {
      const response = await fetch(`/api/admin/conversations/${conversationId}/messages`, { cache: 'no-store' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'No se pudieron cargar los mensajes');
      setMessages(body.data || []);
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    loadConversations()
      .catch((err) => setError(err instanceof Error ? err.message : 'Error al cargar conversaciones'))
      .finally(() => setLoading(false));
  }, [loadConversations]);

  useEffect(() => {
    if (!selectedId) return;
    loadMessages(selectedId).catch((err) => setError(err instanceof Error ? err.message : 'Error al cargar mensajes'));
  }, [selectedId, loadMessages]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      loadConversations().catch(() => undefined);
      if (selectedId) loadMessages(selectedId).catch(() => undefined);
    }, 8000);
    return () => window.clearInterval(timer);
  }, [loadConversations, loadMessages, selectedId]);

  const send = async () => {
    if (!selectedId || !text.trim() || sending) return;
    setSending(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: selectedId, text: text.trim() }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'No se pudo enviar el mensaje');
      setText('');
      await Promise.all([loadMessages(selectedId), loadConversations()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar el mensaje');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="max-w-[1200px] text-crema">
      <PageHeader
        eyebrow="✦ Omnicanal"
        title="Conversaciones"
        action={
          <div className="flex items-center gap-2 text-[11px]">
            <span className="rounded-full border border-neon/30 bg-neon/10 px-3 py-1.5 text-neon font-semibold">WhatsApp Cloud activo</span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-white/60">IA automática OFF</span>
          </div>
        }
      />

      {error && (
        <div className="mb-4 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-xs text-red-200">{error}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[360px_minmax(0,1fr)] gap-5 min-h-[650px]">
        <div className="rounded-2xl border border-white/10 bg-[#050e0a]/90 overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10 text-xs text-white/60">
            {loading ? 'Cargando...' : `${conversations.length} conversación${conversations.length === 1 ? '' : 'es'}`}
          </div>
          <div className="max-h-[690px] overflow-y-auto">
            {!loading && conversations.length === 0 ? (
              <EmptyState emoji="💬" texto="Aún no hay conversaciones omnicanal." />
            ) : (
              conversations.map((conversation) => {
                const active = conversation.id === selectedId;
                return (
                  <button
                    key={conversation.id}
                    onClick={() => setSelectedId(conversation.id)}
                    className={`w-full text-left px-4 py-4 border-b border-white/5 transition-colors ${active ? 'bg-neon/10' : 'hover:bg-white/[0.03]'}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-white truncate">{conversation.name}</div>
                        <div className="text-[11px] text-neon/80 font-mono mt-0.5">+{conversation.phone.replace(/^\+/, '')}</div>
                      </div>
                      <div className="text-[9px] text-white/35 shrink-0">{formatDate(conversation.lastMessageAt)}</div>
                    </div>
                    <div className="mt-2 text-xs text-white/55 truncate">
                      {conversation.lastDirection === 'outbound' ? 'Tú: ' : ''}{conversation.lastMessage || 'Sin mensajes'}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#050e0a] flex flex-col overflow-hidden min-h-[650px]">
          {!selected ? (
            <div className="flex-1 grid place-items-center"><EmptyState emoji="💬" texto="Selecciona una conversación." /></div>
          ) : (
            <>
              <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between gap-3">
                <div>
                  <div className="font-display font-bold text-white">{selected.name}</div>
                  <div className="text-xs text-muted mt-1">+{selected.phone.replace(/^\+/, '')} · WhatsApp</div>
                </div>
                <div className="text-right text-[10px] text-white/45">
                  <div>CRM: {selected.crmStatus}</div>
                  <div>Estado: {selected.status}</div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-3 bg-black/10">
                {loadingMessages ? (
                  <div className="text-center text-xs text-muted py-8">Cargando conversación...</div>
                ) : messages.length === 0 ? (
                  <EmptyState emoji="✉️" texto="Esta conversación todavía no tiene mensajes." />
                ) : (
                  messages.map((message) => {
                    const outbound = message.direction === 'outbound';
                    return (
                      <div key={message.id} className={`flex ${outbound ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${outbound ? 'bg-neon text-[#03110b] rounded-br-md' : 'bg-white/8 text-white border border-white/10 rounded-bl-md'}`}>
                          <div className="whitespace-pre-wrap break-words">{message.body || `[${message.message_type}]`}</div>
                          <div className={`mt-1.5 text-[9px] ${outbound ? 'text-black/50' : 'text-white/35'}`}>
                            {formatDate(message.timestamp)}{outbound && message.status ? ` · ${message.status}` : ''}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="border-t border-white/10 p-4 bg-[#050e0a]">
                <div className="flex gap-3 items-end">
                  <textarea
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        void send();
                      }
                    }}
                    rows={3}
                    maxLength={4096}
                    placeholder="Escribe una respuesta manual..."
                    className="flex-1 resize-none rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white outline-none focus:border-neon/50"
                  />
                  <button
                    onClick={() => void send()}
                    disabled={sending || !text.trim()}
                    className="rounded-xl bg-neon text-black font-bold text-sm px-5 py-3 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white transition-colors"
                  >
                    {sending ? 'Enviando...' : 'Enviar'}
                  </button>
                </div>
                <div className="mt-2 text-[10px] text-white/35">Envío humano por WhatsApp Cloud API. No se llama a ningún modelo de IA.</div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
