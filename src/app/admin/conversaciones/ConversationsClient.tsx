'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { PageHeader, EmptyState } from '../_ui/AdminUI';

type Channel = 'whatsapp' | 'instagram' | 'web';

type Conversation = {
  id: string;
  channel: Channel;
  name: string;
  phone: string | null;
  email: string | null;
  externalId: string;
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
  lastInboundAt: string | null;
  serviceWindowExpiresAt: string | null;
  personal: boolean;
};

type Message = {
  id: string;
  direction: 'inbound' | 'outbound';
  message_type: string;
  body: string | null;
  status: string | null;
  provider: string | null;
  transport: string | null;
  source?: string | null;
  timestamp: string;
};

function formatDate(value: string | null) {
  if (!value) return '';
  return new Date(value).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' });
}

function channelMeta(channel: Channel) {
  if (channel === 'whatsapp') return { icon: '🟢', label: 'WhatsApp' };
  if (channel === 'instagram') return { icon: '🟣', label: 'Instagram' };
  return { icon: '🌐', label: 'Web' };
}

function remainingWindow(expiresAt: string | null) {
  if (!expiresAt) return { open: false, label: 'Sin ventana activa' };
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return { open: false, label: 'Ventana 24 h cerrada' };
  const hours = Math.floor(diff / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  return { open: true, label: `${hours} h ${minutes} min restantes` };
}

export default function ConversationsClient() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [updatingPersonal, setUpdatingPersonal] = useState(false);
  const [filter, setFilter] = useState<'all' | Channel>('all');
  const [error, setError] = useState<string | null>(null);

  const visibleConversations = useMemo(
    () => filter === 'all' ? conversations : conversations.filter((item) => item.channel === filter),
    [conversations, filter],
  );

  const selected = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedId) || null,
    [conversations, selectedId],
  );

  const windowState = useMemo(
    () => remainingWindow(selected?.serviceWindowExpiresAt || null),
    [selected?.serviceWindowExpiresAt],
  );

  const loadConversations = useCallback(async () => {
    const response = await fetch('/api/admin/conversations', { cache: 'no-store' });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || 'No se pudieron cargar las conversaciones');
    const next: Conversation[] = body.data || [];
    setConversations(next);
    setSelectedId((current) => current && next.some((item) => item.id === current) ? current : next[0]?.id || null);
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

  useEffect(() => {
    if (visibleConversations.length === 0) return;
    if (!selectedId || !visibleConversations.some((item) => item.id === selectedId)) {
      setSelectedId(visibleConversations[0].id);
    }
  }, [filter, visibleConversations, selectedId]);

  const send = async () => {
    if (!selectedId || !selected || !text.trim() || sending || !windowState.open) return;
    setSending(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: selectedId, text: text.trim() }),
      });
      const body = await response.json();
      if (!response.ok) {
        if (body.error === 'meta_token_expired_or_invalid') {
          throw new Error('El token de Meta venció. Actualízalo una vez en Integraciones; al guardarlo intentaremos convertirlo a larga duración.');
        }
        if (body.error === 'service_window_closed') {
          throw new Error(body.message || 'La ventana de respuesta está cerrada.');
        }
        throw new Error(body.error || 'No se pudo enviar el mensaje');
      }
      setText('');
      await Promise.all([loadMessages(selectedId), loadConversations()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar el mensaje');
    } finally {
      setSending(false);
    }
  };

  const togglePersonal = async () => {
    if (!selected || updatingPersonal) return;
    setUpdatingPersonal(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/conversations/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personal: !selected.personal }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'No se pudo actualizar el contacto');
      await loadConversations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar el contacto');
    } finally {
      setUpdatingPersonal(false);
    }
  };

  const counts = useMemo(() => ({
    all: conversations.length,
    whatsapp: conversations.filter((item) => item.channel === 'whatsapp').length,
    instagram: conversations.filter((item) => item.channel === 'instagram').length,
    web: conversations.filter((item) => item.channel === 'web').length,
  }), [conversations]);

  return (
    <div className="max-w-[1240px] text-crema">
      <PageHeader
        eyebrow="✦ Omnicanal"
        title="Conversaciones"
        action={
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="rounded-full border border-neon/30 bg-neon/10 px-3 py-1.5 text-neon font-semibold">WhatsApp + Instagram</span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-white/60">IA automática OFF</span>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {([
          ['all', `Todos ${counts.all}`],
          ['whatsapp', `🟢 WhatsApp ${counts.whatsapp}`],
          ['instagram', `🟣 Instagram ${counts.instagram}`],
          ['web', `🌐 Web ${counts.web}`],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`rounded-full px-3 py-1.5 text-[11px] font-semibold border transition-colors ${filter === key ? 'border-neon/50 bg-neon/15 text-neon' : 'border-white/10 bg-white/[0.03] text-white/55 hover:text-white'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <div className="mb-4 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-xs text-red-200">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-[370px_minmax(0,1fr)] gap-5 min-h-[680px]">
        <div className="rounded-2xl border border-white/10 bg-[#050e0a]/90 overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10 text-xs text-white/60">
            {loading ? 'Cargando...' : `${visibleConversations.length} conversación${visibleConversations.length === 1 ? '' : 'es'}`}
          </div>
          <div className="max-h-[720px] overflow-y-auto">
            {!loading && visibleConversations.length === 0 ? (
              <EmptyState emoji="💬" texto="Aún no hay conversaciones en este canal." />
            ) : visibleConversations.map((conversation) => {
              const active = conversation.id === selectedId;
              const meta = channelMeta(conversation.channel);
              return (
                <button key={conversation.id} onClick={() => setSelectedId(conversation.id)} className={`w-full text-left px-4 py-4 border-b border-white/5 transition-colors ${active ? 'bg-neon/10' : 'hover:bg-white/[0.03]'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-white truncate">{meta.icon} {conversation.name}</div>
                      <div className="text-[10px] text-white/40 mt-0.5 truncate">
                        {conversation.channel === 'whatsapp' && conversation.phone ? `+${conversation.phone.replace(/^\+/, '')}` : meta.label}
                        {conversation.personal ? ' · Personal' : ''}
                      </div>
                    </div>
                    <div className="text-[9px] text-white/35 shrink-0">{formatDate(conversation.lastMessageAt)}</div>
                  </div>
                  <div className="mt-2 text-xs text-white/55 truncate">{conversation.lastDirection === 'outbound' ? 'Tú: ' : ''}{conversation.lastMessage || 'Sin mensajes'}</div>
                  {conversation.unreadCount > 0 && <span className="mt-2 inline-flex min-w-5 h-5 items-center justify-center rounded-full bg-neon text-black text-[10px] font-bold px-1.5">{conversation.unreadCount}</span>}
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#050e0a] flex flex-col overflow-hidden min-h-[680px]">
          {!selected ? (
            <div className="flex-1 grid place-items-center"><EmptyState emoji="💬" texto="Selecciona una conversación." /></div>
          ) : (
            <>
              <div className="px-5 py-4 border-b border-white/10 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-display font-bold text-white">{channelMeta(selected.channel).icon} {selected.name}</div>
                  <div className="text-xs text-muted mt-1">
                    {selected.channel === 'whatsapp' && selected.phone ? `+${selected.phone.replace(/^\+/, '')}` : selected.externalId} · {channelMeta(selected.channel).label}
                  </div>
                  <div className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold ${windowState.open ? 'bg-neon/10 text-neon border border-neon/20' : 'bg-amber-400/10 text-amber-200 border border-amber-400/20'}`}>
                    {windowState.open ? '🟢' : '🟠'} {windowState.label}
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <button onClick={() => void togglePersonal()} disabled={updatingPersonal} className={`rounded-lg border px-2.5 py-1.5 text-[10px] ${selected.personal ? 'border-amber-300/30 bg-amber-300/10 text-amber-200' : 'border-white/10 bg-white/5 text-white/50'}`}>
                    {selected.personal ? '👤 Personal / No CRM' : 'Marcar como personal'}
                  </button>
                  <div className="text-right text-[10px] text-white/45"><div>CRM: {selected.personal ? 'excluido' : selected.crmStatus}</div><div>Estado: {selected.status}</div></div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-3 bg-black/10">
                {loadingMessages ? <div className="text-center text-xs text-muted py-8">Cargando conversación...</div> : messages.length === 0 ? <EmptyState emoji="✉️" texto="Esta conversación todavía no tiene mensajes." /> : messages.map((message) => {
                  const outbound = message.direction === 'outbound';
                  return (
                    <div key={message.id} className={`flex ${outbound ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${outbound ? 'bg-neon text-[#03110b] rounded-br-md' : 'bg-white/8 text-white border border-white/10 rounded-bl-md'}`}>
                        <div className="whitespace-pre-wrap break-words">{message.body || `[${message.message_type}]`}</div>
                        <div className={`mt-1.5 text-[9px] ${outbound ? 'text-black/50' : 'text-white/35'}`}>
                          {formatDate(message.timestamp)}{outbound && message.status ? ` · ${message.status}` : ''}{message.source === 'whatsapp_business_app' ? ' · enviado desde app' : ''}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="border-t border-white/10 p-4 bg-[#050e0a]">
                {!windowState.open && selected.channel === 'whatsapp' && (
                  <div className="mb-3 rounded-xl border border-amber-400/20 bg-amber-400/10 p-3 text-xs text-amber-100">
                    La ventana API de 24 h está cerrada. El CRM bloquea el envío libre para evitar cobros o rechazos accidentales.
                    {selected.phone && <a className="ml-2 underline font-bold" href={`https://wa.me/${selected.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer">Abrir WhatsApp ↗</a>}
                  </div>
                )}
                {!windowState.open && selected.channel === 'instagram' && (
                  <div className="mb-3 rounded-xl border border-amber-400/20 bg-amber-400/10 p-3 text-xs text-amber-100">La ventana estándar de respuesta está cerrada. <a className="underline font-bold" href="https://www.instagram.com/direct/inbox/" target="_blank" rel="noreferrer">Abrir Instagram ↗</a></div>
                )}
                <div className="flex gap-3 items-end">
                  <textarea value={text} onChange={(event) => setText(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void send(); } }} rows={3} maxLength={4096} disabled={!windowState.open || selected.channel === 'web'} placeholder={windowState.open ? `Responder por ${channelMeta(selected.channel).label}...` : 'Ventana de respuesta cerrada'} className="flex-1 resize-none rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white outline-none focus:border-neon/50 disabled:opacity-45" />
                  <button onClick={() => void send()} disabled={sending || !text.trim() || !windowState.open || selected.channel === 'web'} className="rounded-xl bg-neon text-black font-bold text-sm px-5 py-3 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white transition-colors">{sending ? 'Enviando...' : 'Enviar'}</button>
                </div>
                <div className="mt-2 text-[10px] text-white/35">Respuesta humana por API oficial de Meta. Registro CRM determinístico; no se llama a ningún modelo de IA.</div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
