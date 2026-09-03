'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';

type Channel = 'whatsapp' | 'instagram' | 'web';
type FilterType = 'all' | Channel | 'pending' | 'unread' | 'remy' | 'human';

type Conversation = {
  id: string;
  channel: Channel;
  name: string;
  customerName?: string | null;
  instagramUsername?: string | null;
  instagramName?: string | null;
  labels: string[];
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
  aiEnabled: boolean;
};

type Message = {
  id: string;
  direction: 'inbound' | 'outbound';
  message_type: string;
  body: string | null;
  status: string | null;
  timestamp: string;
};

const COMMON_LABELS = ['pedido', 'pagado', 'seguimiento'] as const;

function formatDate(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (date.toDateString() === new Date().toDateString()) {
    return date.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
}

function formatFullDate(value: string | null) {
  if (!value) return '';
  return new Date(value).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' });
}

function channelMeta(channel: Channel) {
  if (channel === 'whatsapp') return { icon: '🟢', label: 'WhatsApp' };
  if (channel === 'instagram') return { icon: '🟣', label: 'Instagram' };
  return { icon: '🌐', label: 'Web' };
}

function readableIdentity(conversation: Conversation) {
  if (conversation.channel === 'whatsapp') {
    const phone = (conversation.phone || conversation.externalId || '').replace(/^\+/, '');
    return `WhatsApp · ${phone ? `+${phone}` : 'sin teléfono'}${conversation.customerName ? ` · ${conversation.customerName}` : ''}`;
  }
  if (conversation.channel === 'instagram') {
    const profile = conversation.instagramUsername
      ? `@${conversation.instagramUsername}`
      : (conversation.instagramName || conversation.name || 'sin usuario');
    return `Instagram · ${profile} · ID ${conversation.externalId}`;
  }
  return `Web · ${conversation.email || conversation.name || conversation.externalId}`;
}

function remainingWindow(expiresAt: string | null) {
  if (!expiresAt) return { open: false, label: 'Sin ventana activa' };
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return { open: false, label: 'Ventana 24h cerrada' };
  const hours = Math.floor(diff / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  return { open: true, label: `${hours}h ${minutes}m ventana 24h` };
}

function conversationAiState(conversation: Conversation) {
  if (conversation.personal) return { dot: '⚪', label: 'Personal', className: 'text-white/50 border-white/15 bg-white/5' };
  if (conversation.humanTakeover) return { dot: '🔵', label: 'Humano', className: 'text-sky-300 border-sky-400/30 bg-sky-400/10' };
  if (!conversation.aiEnabled) return { dot: '🟠', label: 'Pausado', className: 'text-amber-300 border-amber-400/30 bg-amber-400/10' };
  return { dot: '🟢', label: 'Remy', className: 'text-neon border-neon/30 bg-neon/10' };
}

function renderOutboundStatus(status: string | null) {
  if (!status) return null;
  if (status === 'read') return <span className="font-bold text-cyan-300 text-[11px]">✓✓</span>;
  if (status === 'delivered') return <span className="font-semibold text-white/70 text-[11px]">✓✓</span>;
  if (status === 'sent') return <span className="text-white/50 text-[11px]">✓</span>;
  if (status === 'failed') return <span className="font-bold text-red-400 text-[11px]">⚠️</span>;
  return null;
}

export default function ConversationsClientV2() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [bulkEnabling, setBulkEnabling] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');
  const [search, setSearch] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');
  const requestedCustomerApplied = useRef(false);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const isAtBottomRef = useRef(true);
  const previousMessagesLengthRef = useRef(0);

  const selected = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedId) || null,
    [conversations, selectedId],
  );
  const windowState = useMemo(
    () => remainingWindow(selected?.serviceWindowExpiresAt || null),
    [selected?.serviceWindowExpiresAt],
  );

  const pausedIndividuallyCount = useMemo(() => conversations.filter((item) => (
    (item.channel === 'whatsapp' || item.channel === 'instagram') && !item.aiEnabled && !item.personal
  )).length, [conversations]);

  const chatMessages = useMemo(() => messages
    .filter((message) => !message.message_type?.startsWith('status:'))
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()), [messages]);

  const filteredConversations = useMemo(() => conversations.filter((conversation) => {
    if (filter === 'whatsapp' && conversation.channel !== 'whatsapp') return false;
    if (filter === 'instagram' && conversation.channel !== 'instagram') return false;
    if (filter === 'web' && conversation.channel !== 'web') return false;
    if (filter === 'pending' && (conversation.lastDirection !== 'inbound' || conversation.personal)) return false;
    if (filter === 'unread' && conversation.unreadCount <= 0) return false;
    if (filter === 'remy' && (!conversation.aiEnabled || conversation.personal || conversation.humanTakeover)) return false;
    if (filter === 'human' && !conversation.humanTakeover) return false;

    const q = search.trim().toLowerCase().replace(/^@/, '');
    if (!q) return true;
    return [
      conversation.name,
      conversation.customerName,
      conversation.phone,
      conversation.externalId,
      conversation.instagramUsername,
      conversation.instagramName,
      conversation.lastMessage,
      ...(conversation.labels || []),
    ].some((value) => String(value || '').toLowerCase().includes(q));
  }), [conversations, filter, search]);

  const filterCounts = useMemo(() => ({
    all: conversations.length,
    whatsapp: conversations.filter((c) => c.channel === 'whatsapp').length,
    instagram: conversations.filter((c) => c.channel === 'instagram').length,
    web: conversations.filter((c) => c.channel === 'web').length,
    pending: conversations.filter((c) => c.lastDirection === 'inbound' && !c.personal).length,
    unread: conversations.filter((c) => c.unreadCount > 0).length,
    remy: conversations.filter((c) => c.aiEnabled && !c.personal && !c.humanTakeover).length,
    human: conversations.filter((c) => c.humanTakeover).length,
  }), [conversations]);

  const loadConversations = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/conversations', { cache: 'no-store' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Error al cargar conversaciones');
      const next: Conversation[] = (body.data || []).map((row: Conversation) => ({
        ...row,
        labels: Array.isArray(row.labels) ? row.labels : [],
      }));
      setConversations(next);
      setSelectedId((current) => {
        if (!requestedCustomerApplied.current && typeof window !== 'undefined') {
          const requestedCustomer = new URLSearchParams(window.location.search).get('customer');
          const direct = requestedCustomer ? next.find((conversation) => conversation.customerId === requestedCustomer) : null;
          requestedCustomerApplied.current = true;
          if (direct) return direct.id;
        }
        return current && next.some((conversation) => conversation.id === current) ? current : next[0]?.id || null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar conversaciones');
    }
  }, []);

  const loadMessages = useCallback(async (conversationId: string, background = false) => {
    if (!background) setLoadingMessages(true);
    try {
      const response = await fetch(`/api/admin/conversations/${conversationId}/messages`, { cache: 'no-store' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Error al cargar mensajes');
      setMessages(body.data || []);
    } catch (err) {
      if (!background) setError(err instanceof Error ? err.message : 'Error al cargar mensajes');
    } finally {
      if (!background) setLoadingMessages(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    loadConversations().finally(() => setLoading(false));
  }, [loadConversations]);

  useEffect(() => {
    if (!selectedId) return;
    void loadMessages(selectedId);
    isAtBottomRef.current = true;
  }, [selectedId, loadMessages]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void loadConversations();
      if (selectedId) void loadMessages(selectedId, true);
    }, 8000);
    return () => window.clearInterval(timer);
  }, [loadConversations, loadMessages, selectedId]);

  useEffect(() => {
    const element = messagesContainerRef.current;
    if (!element) return;
    if (chatMessages.length > previousMessagesLengthRef.current && isAtBottomRef.current) {
      element.scrollTo({ top: element.scrollHeight, behavior: previousMessagesLengthRef.current ? 'smooth' : 'auto' });
    }
    previousMessagesLengthRef.current = chatMessages.length;
  }, [chatMessages]);

  async function updateConversation(patch: Partial<Pick<Conversation, 'personal' | 'aiEnabled' | 'humanTakeover' | 'labels'>>) {
    if (!selected || updating) return;
    setUpdating(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/conversations/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'No se pudo actualizar la conversación');
      await loadConversations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al actualizar');
    } finally {
      setUpdating(false);
    }
  }

  async function toggleLabel(label: string) {
    if (!selected) return;
    const normalized = label.trim().toLowerCase().replace(/\s+/g, '-');
    if (!normalized) return;
    const labels = selected.labels.includes(normalized)
      ? selected.labels.filter((value) => value !== normalized)
      : [...selected.labels, normalized];
    await updateConversation({ labels });
  }

  async function sendMessage() {
    if (!selected || !text.trim() || sending) return;
    setSending(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/conversations/${selected.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim() }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'No se pudo enviar el mensaje');
      setText('');
      await loadMessages(selected.id);
      await loadConversations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al enviar');
    } finally {
      setSending(false);
    }
  }

  async function bulkEnableAi() {
    if (bulkEnabling || pausedIndividuallyCount === 0) return;
    const confirmed = window.confirm(
      `Esto va a reactivar Remy en ${pausedIndividuallyCount} conversación${pausedIndividuallyCount === 1 ? '' : 'es'} pausadas. ¿Continuar?`,
    );
    if (!confirmed) return;
    setBulkEnabling(true);
    try {
      const response = await fetch('/api/admin/conversations/bulk-enable-ai', { method: 'POST' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'No se pudo reactivar Remy');
      await loadConversations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo reactivar Remy');
    } finally {
      setBulkEnabling(false);
    }
  }

  return (
    <div className="h-[calc(100dvh-5.5rem)] min-h-[500px] flex flex-col text-white overflow-hidden rounded-2xl border border-white/10 bg-[#040f0a] shadow-2xl">
      {error && (
        <div className="shrink-0 bg-red-950/80 border-b border-red-500/30 px-4 py-2 text-xs text-red-200 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="font-bold">×</button>
        </div>
      )}

      <div className="flex-1 flex min-h-0 overflow-hidden">
        <aside className={`w-full lg:w-[380px] shrink-0 border-r border-white/10 flex-col bg-[#06140e] ${mobileView === 'chat' ? 'hidden lg:flex' : 'flex'}`}>
          <div className="p-3 border-b border-white/10 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <h1 className="font-display font-black text-base">💬 Conversaciones</h1>
              {pausedIndividuallyCount > 0 && (
                <button
                  onClick={() => void bulkEnableAi()}
                  disabled={bulkEnabling}
                  className="text-[10px] text-amber-200 bg-amber-400/10 border border-amber-400/25 px-2 py-1 rounded-md"
                >
                  {bulkEnabling ? 'Reactivando…' : `Reactivar ${pausedIndividuallyCount} pausadas`}
                </button>
              )}
            </div>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Nombre, teléfono, @Instagram, etiqueta…"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs outline-none focus:border-neon/50"
            />
            <div className="flex gap-1.5 overflow-x-auto pb-1 text-[10px]">
              {([
                ['all', 'Todos'], ['whatsapp', '🟢 WA'], ['instagram', '🟣 IG'], ['pending', '⏳ Pendientes'],
                ['unread', '🔴 No leídos'], ['remy', '🤖 Remy'], ['human', '👤 Humano'],
              ] as [FilterType, string][]).map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setFilter(id)}
                  className={`px-2 py-1 rounded-lg whitespace-nowrap border ${filter === id ? 'bg-neon text-black border-neon' : 'bg-white/5 text-white/70 border-white/10'}`}
                >
                  {label} · {filterCounts[id]}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-white/5">
            {loading ? (
              <div className="p-8 text-center text-xs text-white/40">Cargando conversaciones…</div>
            ) : filteredConversations.map((conversation) => {
              const meta = channelMeta(conversation.channel);
              const aiState = conversationAiState(conversation);
              const pending = conversation.lastDirection === 'inbound' && !conversation.personal;
              return (
                <button
                  key={conversation.id}
                  onClick={() => { setSelectedId(conversation.id); setMobileView('chat'); }}
                  className={`w-full text-left p-3 flex gap-3 border-l-4 ${conversation.id === selectedId ? 'bg-neon/10 border-neon' : 'hover:bg-white/5 border-transparent'}`}
                >
                  <div className="w-10 h-10 rounded-full bg-white/10 border border-white/15 flex items-center justify-center shrink-0">
                    {conversation.name?.charAt(0).toUpperCase() || '?'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between gap-2">
                      <span className="font-bold text-xs truncate">{conversation.name || 'Sin nombre'}</span>
                      <span className="text-[10px] text-white/40 shrink-0">{formatDate(conversation.lastMessageAt)}</span>
                    </div>
                    <div className="text-[10px] text-white/45 truncate mt-0.5">{meta.icon} {readableIdentity(conversation)}</div>
                    <p className="text-xs text-white/65 truncate mt-1">{conversation.lastDirection === 'outbound' ? 'Tú: ' : ''}{conversation.lastMessage || 'Sin mensajes'}</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      <span className={`text-[9px] px-1.5 py-0.5 rounded border ${aiState.className}`}>{aiState.dot} {aiState.label}</span>
                      {pending && <span className="text-[9px] px-1.5 py-0.5 rounded border border-amber-400/30 bg-amber-400/10 text-amber-300">⏳ Por responder</span>}
                      {conversation.labels.filter((label) => label !== 'personal').map((label) => (
                        <span key={label} className="text-[9px] px-1.5 py-0.5 rounded border border-neon/20 bg-neon/10 text-neon">{label}</span>
                      ))}
                      {conversation.unreadCount > 0 && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-500 text-white ml-auto">{conversation.unreadCount}</span>}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        <main className={`flex-1 min-w-0 flex-col bg-[#020b07] ${mobileView === 'list' ? 'hidden lg:flex' : 'flex'}`}>
          {!selected ? (
            <div className="flex-1 flex items-center justify-center text-white/40">Selecciona una conversación</div>
          ) : (
            <>
              <header className="shrink-0 p-3 border-b border-white/10 bg-[#05160f] space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <button onClick={() => setMobileView('list')} className="lg:hidden text-xs border border-white/10 rounded px-2 py-1">← Chats</button>
                      <span className="font-bold text-sm truncate">{selected.name || 'Sin nombre'}</span>
                      <span className={`text-[9px] px-2 py-0.5 rounded-full border ${windowState.open ? 'border-emerald-500/30 text-emerald-300' : 'border-amber-500/30 text-amber-300'}`}>{windowState.label}</span>
                    </div>
                    <div className="text-[11px] text-white/55 mt-1">{readableIdentity(selected)}</div>
                    {selected.customerName && selected.customerName !== selected.name && (
                      <div className="text-[10px] text-white/40">Datos cliente: {selected.customerName}</div>
                    )}
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      onClick={() => void updateConversation({ aiEnabled: !selected.aiEnabled })}
                      disabled={updating || selected.personal}
                      className={`text-[10px] px-2 py-1 rounded border ${selected.aiEnabled ? 'border-neon/30 text-neon bg-neon/10' : 'border-white/10 text-white/50'}`}
                    >🤖 {selected.aiEnabled ? 'Remy' : 'Pausado'}</button>
                    <button
                      onClick={() => void updateConversation({ humanTakeover: !selected.humanTakeover })}
                      disabled={updating}
                      className="text-[10px] px-2 py-1 rounded border border-sky-400/20 text-sky-300"
                    >👤 {selected.humanTakeover ? 'Liberar' : 'Tomar'}</button>
                    <button
                      onClick={() => void updateConversation({ personal: !selected.personal })}
                      disabled={updating}
                      className="text-[10px] px-2 py-1 rounded border border-white/10 text-white/60"
                    >Personal</button>
                    {selected.customerId && (
                      <Link href={`/admin/clientes/${selected.customerId}`} className="text-[10px] px-2 py-1 rounded border border-white/10 text-neon">📋 CRM</Link>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] text-white/40 mr-1">Etiquetas:</span>
                  {COMMON_LABELS.map((label) => {
                    const active = selected.labels.includes(label);
                    return (
                      <button
                        key={label}
                        onClick={() => void toggleLabel(label)}
                        disabled={updating}
                        className={`text-[10px] px-2 py-1 rounded-full border ${active ? 'bg-neon text-black border-neon font-bold' : 'bg-white/5 text-white/60 border-white/10'}`}
                      >{label}</button>
                    );
                  })}
                  {selected.labels.filter((label) => !COMMON_LABELS.includes(label as typeof COMMON_LABELS[number]) && label !== 'personal').map((label) => (
                    <button
                      key={label}
                      onClick={() => void toggleLabel(label)}
                      className="text-[10px] px-2 py-1 rounded-full border border-neon/20 bg-neon/10 text-neon"
                      title="Quitar etiqueta"
                    >{label} ×</button>
                  ))}
                  <input
                    value={newLabel}
                    onChange={(event) => setNewLabel(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        const label = newLabel;
                        setNewLabel('');
                        void toggleLabel(label);
                      }
                    }}
                    placeholder="+ etiqueta"
                    className="w-24 bg-white/5 border border-white/10 rounded-full px-2 py-1 text-[10px] outline-none"
                  />
                </div>
              </header>

              <div
                ref={messagesContainerRef}
                onScroll={(event) => {
                  const element = event.currentTarget;
                  isAtBottomRef.current = element.scrollHeight - element.scrollTop - element.clientHeight < 80;
                }}
                className="flex-1 overflow-y-auto p-4 space-y-3"
              >
                {loadingMessages ? (
                  <div className="h-full flex items-center justify-center text-xs text-white/40">Cargando mensajes…</div>
                ) : chatMessages.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-white/40">Sin mensajes</div>
                ) : chatMessages.map((message) => {
                  const outbound = message.direction === 'outbound';
                  return (
                    <div key={message.id} className={`flex ${outbound ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm whitespace-pre-wrap break-words ${outbound ? 'bg-[#0c402d] border border-emerald-500/30 rounded-br-sm' : 'bg-white/10 border border-white/10 rounded-bl-sm'}`}>
                        <p>{message.body || `[${message.message_type}]`}</p>
                        <div className="mt-1 flex justify-end gap-1.5 text-[9px] text-white/40">
                          {formatFullDate(message.timestamp)} {outbound && renderOutboundStatus(message.status)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <footer className="shrink-0 p-3 border-t border-white/10 bg-[#04120c]">
                <div className="flex gap-2 items-end">
                  <textarea
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        void sendMessage();
                      }
                    }}
                    rows={1}
                    placeholder={`Responder a ${selected.name || 'este chat'}…`}
                    className="flex-1 min-h-[44px] max-h-32 bg-white/5 border border-white/15 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm resize-none outline-none focus:border-neon"
                  />
                  <button
                    onClick={() => void sendMessage()}
                    disabled={sending || !text.trim()}
                    className="h-[44px] px-5 bg-neon text-black font-bold text-xs rounded-xl disabled:opacity-30"
                  >{sending ? 'Enviando…' : 'Enviar 🚀'}</button>
                </div>
              </footer>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
