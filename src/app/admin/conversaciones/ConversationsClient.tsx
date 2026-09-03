'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';

type Channel = 'whatsapp' | 'instagram' | 'web';
type FilterType = 'all' | Channel | 'pending' | 'unread' | 'remy' | 'human';

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
  aiEnabled: boolean;
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

type CustomerDetail = {
  id: string;
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  email?: string | null;
  address_line1?: string | null;
  city?: string | null;
  total_orders?: number;
  total_spent?: number;
  stage?: string;
  notes?: string | null;
  tags?: string[];
};

function formatDate(value: string | null) {
  if (!value) return '';
  const d = new Date(value);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) {
    return d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
}

function formatFullDate(value: string | null) {
  if (!value) return '';
  return new Date(value).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' });
}

function channelMeta(channel: Channel) {
  if (channel === 'whatsapp') return { icon: '🟢', label: 'WhatsApp', badgeBg: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' };
  if (channel === 'instagram') return { icon: '🟣', label: 'Instagram', badgeBg: 'bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30' };
  return { icon: '🌐', label: 'Web', badgeBg: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30' };
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
  if (conversation.personal) return { dot: '⚪', label: 'Personal', hint: 'Contacto personal: excluido de CRM e IA.', color: 'text-white/40 border-white/10 bg-white/5' };
  if (conversation.humanTakeover) return { dot: '🔵', label: 'Humano', hint: 'Tomado por un operador humano.', color: 'text-sky-300 border-sky-400/30 bg-sky-400/10' };
  if (!conversation.aiEnabled) return { dot: '🟠', label: 'Pausado', hint: 'Remy pausado en este chat.', color: 'text-amber-300 border-amber-400/30 bg-amber-400/10' };
  return { dot: '🟢', label: 'Remy', hint: 'Remy responderá automáticamente.', color: 'text-neon border-neon/30 bg-neon/10' };
}

function renderOutboundStatus(status: string | null) {
  if (!status) return null;
  if (status === 'read') return <span className="font-bold text-cyan-300 text-[11px]" title="Leído">✓✓</span>;
  if (status === 'delivered') return <span className="font-semibold text-white/70 text-[11px]" title="Entregado">✓✓</span>;
  if (status === 'sent') return <span className="text-white/50 text-[11px]" title="Enviado">✓</span>;
  if (status === 'failed') return <span className="font-bold text-red-400 text-[11px]" title="Error de entrega">⚠️</span>;
  return <span className="text-white/40 text-[10px]">· {status}</span>;
}

export default function ConversationsClient() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showCrmDrawer, setShowCrmDrawer] = useState(false);
  const [customerData, setCustomerData] = useState<CustomerDetail | null>(null);
  const [loadingCustomer, setLoadingCustomer] = useState(false);
  const [newMessagesCount, setNewMessagesCount] = useState(0);
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');
  const [bulkEnabling, setBulkEnabling] = useState(false);

  const pausedIndividuallyCount = useMemo(() => conversations.filter((item) => (
    (item.channel === 'whatsapp' || item.channel === 'instagram') && !item.aiEnabled && !item.personal
  )).length, [conversations]);

  const bulkEnableAi = async () => {
    if (bulkEnabling || pausedIndividuallyCount === 0) return;
    const confirmed = window.confirm(
      `Esto va a reactivar Remy en ${pausedIndividuallyCount} conversación${pausedIndividuallyCount === 1 ? '' : 'es'} donde lo apagaste manualmente. `
      + 'No afecta a las conversaciones marcadas como Personal ni a las que tiene tomadas un humano. ¿Continuar?',
    );
    if (!confirmed) return;
    setBulkEnabling(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/conversations/bulk-enable-ai', { method: 'POST' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'No se pudo reactivar Remy en las conversaciones');
      await loadConversations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo reactivar Remy en las conversaciones');
    } finally {
      setBulkEnabling(false);
    }
  };

  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const isAtBottomRef = useRef(true);
  const previousMessagesLengthRef = useRef(0);

  const chatMessages = useMemo(() => {
    return messages
      .filter((m) => !m.message_type?.startsWith('status:'))
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [messages]);

  const selected = useMemo(() => conversations.find((c) => c.id === selectedId) || null, [conversations, selectedId]);
  const windowState = useMemo(() => remainingWindow(selected?.serviceWindowExpiresAt || null), [selected?.serviceWindowExpiresAt]);

  const filteredConversations = useMemo(() => {
    return conversations.filter((c) => {
      if (filter === 'whatsapp' && c.channel !== 'whatsapp') return false;
      if (filter === 'instagram' && c.channel !== 'instagram') return false;
      if (filter === 'web' && c.channel !== 'web') return false;
      if (filter === 'pending' && (c.lastDirection !== 'inbound' || c.personal)) return false;
      if (filter === 'unread' && (c.unreadCount || 0) <= 0) return false;
      if (filter === 'remy' && (!c.aiEnabled || c.personal || c.humanTakeover)) return false;
      if (filter === 'human' && !c.humanTakeover) return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesName = (c.name || '').toLowerCase().includes(q);
        const matchesPhone = (c.phone || '').includes(q);
        const matchesExternal = (c.externalId || '').toLowerCase().includes(q);
        const matchesLast = (c.lastMessage || '').toLowerCase().includes(q);
        return matchesName || matchesPhone || matchesExternal || matchesLast;
      }
      return true;
    });
  }, [conversations, filter, search]);

  const filterCounts = useMemo(() => {
    return {
      all: conversations.length,
      whatsapp: conversations.filter((c) => c.channel === 'whatsapp').length,
      instagram: conversations.filter((c) => c.channel === 'instagram').length,
      web: conversations.filter((c) => c.channel === 'web').length,
      pending: conversations.filter((c) => c.lastDirection === 'inbound' && !c.personal).length,
      unread: conversations.filter((c) => (c.unreadCount || 0) > 0).length,
      remy: conversations.filter((c) => c.aiEnabled && !c.personal && !c.humanTakeover).length,
      human: conversations.filter((c) => c.humanTakeover).length,
    };
  }, [conversations]);

  const loadConversations = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/conversations', { cache: 'no-store' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Error al cargar conversaciones');
      const next: Conversation[] = body.data || [];
      setConversations(next);
      setSelectedId((curr) => (curr && next.some((c) => c.id === curr) ? curr : next[0]?.id || null));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar conversaciones');
    }
  }, []);

  const loadMessages = useCallback(async (conversationId: string) => {
    setLoadingMessages(true);
    try {
      const response = await fetch(`/api/admin/conversations/${conversationId}/messages`, { cache: 'no-store' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Error al cargar mensajes');
      setMessages(body.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar mensajes');
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  const loadCustomer = useCallback(async (customerId: string) => {
    setLoadingCustomer(true);
    try {
      const res = await fetch(`/api/admin/customers/${customerId}`, { cache: 'no-store' });
      if (res.ok) {
        const body = await res.json();
        setCustomerData(body.data || null);
      }
    } catch {
      setCustomerData(null);
    } finally {
      setLoadingCustomer(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    loadConversations().finally(() => setLoading(false));
  }, [loadConversations]);

  useEffect(() => {
    if (selectedId) {
      loadMessages(selectedId);
      setNewMessagesCount(0);
      isAtBottomRef.current = true;
    }
  }, [selectedId, loadMessages]);

  useEffect(() => {
    if (selected?.customerId) {
      loadCustomer(selected.customerId);
    } else {
      setCustomerData(null);
    }
  }, [selected?.customerId, loadCustomer]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      loadConversations().catch(() => undefined);
      if (selectedId) loadMessages(selectedId).catch(() => undefined);
    }, 8000);
    return () => window.clearInterval(timer);
  }, [loadConversations, loadMessages, selectedId]);

  const handleScroll = useCallback(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const atBottom = distanceToBottom < 80;
    isAtBottomRef.current = atBottom;
    if (atBottom) {
      setNewMessagesCount(0);
    }
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const el = messagesContainerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
    setNewMessagesCount(0);
    isAtBottomRef.current = true;
  }, []);

  useEffect(() => {
    if (chatMessages.length > previousMessagesLengthRef.current) {
      if (isAtBottomRef.current) {
        scrollToBottom(previousMessagesLengthRef.current === 0 ? 'auto' : 'smooth');
      } else {
        const added = chatMessages.length - previousMessagesLengthRef.current;
        setNewMessagesCount((c) => c + added);
      }
    }
    previousMessagesLengthRef.current = chatMessages.length;
  }, [chatMessages, scrollToBottom]);

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
      setTimeout(() => scrollToBottom('smooth'), 100);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al enviar');
    } finally {
      setSending(false);
    }
  }

  async function updateConversation(patch: Partial<Pick<Conversation, 'personal' | 'aiEnabled' | 'humanTakeover'>>) {
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

  return (
    <div className="h-[calc(100dvh-5.5rem)] min-h-[500px] flex flex-col text-white overflow-hidden rounded-2xl border border-white/10 bg-[#040f0a] shadow-2xl">
      {error && (
        <div className="shrink-0 bg-red-950/80 border-b border-red-500/30 px-4 py-2 text-xs text-red-200 flex items-center justify-between z-20">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-white font-bold ml-2">×</button>
        </div>
      )}

      <div className="flex-1 flex min-h-0 relative overflow-hidden">
        {/* PANEL IZQUIERDO: LISTA DE CHATS */}
        <aside
          className={`w-full lg:w-[360px] xl:w-[400px] shrink-0 border-r border-white/10 flex flex-col bg-[#06140e] ${
            mobileView === 'chat' ? 'hidden lg:flex' : 'flex'
          }`}
        >
          {/* Header del panel con buscador */}
          <div className="p-3 border-b border-white/10 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <h1 className="font-display font-black text-base text-white flex items-center gap-2">
                <span>💬</span> Conversaciones
              </h1>
              <div className="flex items-center gap-1.5">
                {pausedIndividuallyCount > 0 && (
                  <button
                    onClick={() => void bulkEnableAi()}
                    disabled={bulkEnabling}
                    title="Reactivar Remy en conversaciones pausadas"
                    className="text-[10px] text-amber-200 bg-amber-400/10 border border-amber-400/25 px-2 py-0.5 rounded-md hover:bg-amber-400/20 transition-colors"
                  >
                    {bulkEnabling ? 'Reactivando…' : `Reactivar en las ${pausedIndividuallyCount} pausadas`}
                  </button>
                )}
                <span className="text-[11px] font-mono text-neon bg-neon/10 border border-neon/20 px-2 py-0.5 rounded-full">
                  {filteredConversations.length} activas
                </span>
              </div>
            </div>

            {/* Input de Búsqueda */}
            <div className="relative">
              <input
                type="text"
                placeholder="Buscar por nombre, teléfono o texto…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-white/40 focus:border-neon/50 outline-none"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-2 text-xs text-white/40 hover:text-white"
                >
                  ×
                </button>
              )}
            </div>

            {/* Chips de Filtro */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] no-scrollbar">
              {[
                { id: 'all' as FilterType, label: 'Todos', count: filterCounts.all },
                { id: 'whatsapp' as FilterType, label: '🟢 WA', count: filterCounts.whatsapp },
                { id: 'instagram' as FilterType, label: '🟣 IG', count: filterCounts.instagram },
                { id: 'pending' as FilterType, label: '⏳ Pendientes', count: filterCounts.pending },
                { id: 'unread' as FilterType, label: '🔴 No leídos', count: filterCounts.unread },
                { id: 'remy' as FilterType, label: '🤖 Remy', count: filterCounts.remy },
                { id: 'human' as FilterType, label: '👤 Humano', count: filterCounts.human },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-colors flex items-center gap-1 shrink-0 ${
                    filter === f.id
                      ? 'bg-neon text-black font-bold'
                      : 'bg-white/[0.04] text-white/70 hover:bg-white/10 hover:text-white border border-white/5'
                  }`}
                >
                  <span>{f.label}</span>
                  <span className={`text-[9px] px-1 py-0.2 rounded-full ${filter === f.id ? 'bg-black/20 text-black' : 'bg-white/10 text-white/50'}`}>
                    {f.count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Lista scrolleable de conversaciones */}
          <div className="flex-1 overflow-y-auto divide-y divide-white/5 overscroll-contain">
            {loading ? (
              <div className="p-8 text-center text-xs text-white/40">Cargando conversaciones…</div>
            ) : filteredConversations.length === 0 ? (
              <div className="p-8 text-center text-xs text-white/40">No hay conversaciones en este filtro.</div>
            ) : (
              filteredConversations.map((c) => {
                const meta = channelMeta(c.channel);
                const aiState = conversationAiState(c);
                const isSelected = c.id === selectedId;
                const isPending = c.lastDirection === 'inbound' && !c.personal;

                return (
                  <button
                    key={c.id}
                    onClick={() => {
                      setSelectedId(c.id);
                      setMobileView('chat');
                    }}
                    className={`w-full text-left p-3 transition-colors relative flex items-start gap-3 ${
                      isSelected
                        ? 'bg-neon/[0.12] border-l-4 border-neon'
                        : 'hover:bg-white/[0.04] border-l-4 border-transparent'
                    }`}
                  >
                    {/* Avatar con canal */}
                    <div className="relative shrink-0 mt-0.5">
                      <div className="w-10 h-10 rounded-full bg-white/10 border border-white/15 flex items-center justify-center font-bold text-sm text-white">
                        {c.name ? c.name.charAt(0).toUpperCase() : '?'}
                      </div>
                      <span className="absolute -bottom-1 -right-1 text-[11px] leading-none" title={meta.label}>
                        {meta.icon}
                      </span>
                    </div>

                    {/* Contenido de la card */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-bold text-xs text-white truncate">{c.name || 'Sin nombre'}</span>
                        <span className="text-[10px] font-mono text-white/40 shrink-0">
                          {formatDate(c.lastMessageAt)}
                        </span>
                      </div>

                      <div className="text-[11px] text-white/50 truncate mt-0.5">
                        {c.phone ? `+${c.phone.replace(/^\+/, '')}` : `@${c.externalId}`}
                      </div>

                      {/* Preview del último mensaje real (nunca status) */}
                      <p className="text-xs text-white/70 truncate mt-1 leading-snug">
                        {c.lastDirection === 'outbound' && <span className="text-neon/80 font-semibold">Tú: </span>}
                        {c.lastMessage || <span className="text-white/30 italic">Sin mensajes</span>}
                      </p>

                      {/* Badges de estado */}
                      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border ${aiState.color}`}>
                          {aiState.dot} {aiState.label}
                        </span>
                        {isPending && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300 border border-amber-400/30 animate-pulse">
                            ⏳ Por responder
                          </span>
                        )}
                        {(c.unreadCount || 0) > 0 && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-500 text-white ml-auto">
                            {c.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* PANEL DERECHO: CHAT ACTIVO & DRAWER CRM */}
        <main
          className={`flex-1 flex flex-col min-w-0 bg-[#020b07] relative ${
            mobileView === 'list' ? 'hidden lg:flex' : 'flex'
          }`}
        >
          {selected ? (
            <>
              {/* STICKY HEADER COMPACTO */}
              <header className="shrink-0 px-4 py-2.5 border-b border-white/10 bg-[#05160f]/90 backdrop-blur-md flex items-center justify-between gap-2 z-10">
                <div className="flex items-center gap-3 min-w-0">
                  {/* Botón Volver para Móviles */}
                  <button
                    onClick={() => setMobileView('list')}
                    className="lg:hidden p-1.5 rounded-lg border border-white/10 bg-white/5 text-xs text-white"
                    aria-label="Volver a lista de chats"
                  >
                    ← Chats
                  </button>

                  <div className="relative shrink-0">
                    <div className="w-9 h-9 rounded-full bg-white/10 border border-white/15 flex items-center justify-center font-bold text-xs text-white">
                      {selected.name ? selected.name.charAt(0).toUpperCase() : '?'}
                    </div>
                    <span className="absolute -bottom-1 -right-1 text-[10px] leading-none">
                      {channelMeta(selected.channel).icon}
                    </span>
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-white truncate">{selected.name || 'Sin nombre'}</span>
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${windowState.open ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' : 'bg-amber-500/10 text-amber-300 border-amber-500/30'}`}>
                        {windowState.label}
                      </span>
                    </div>
                    <div className="text-[11px] text-white/50 truncate flex items-center gap-1.5">
                      <span>{selected.phone ? `+${selected.phone.replace(/^\+/, '')}` : `@${selected.externalId}`}</span>
                      <span>·</span>
                      <span className="capitalize">{selected.channel}</span>
                    </div>
                  </div>
                </div>

                {/* Acciones Rápidas del Chat */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Indicador / Toggle de Remy */}
                  <button
                    onClick={() => updateConversation({ aiEnabled: !selected.aiEnabled })}
                    disabled={updating || selected.personal}
                    title="Alternar respuesta automática de Remy en esta conversación"
                    className={`text-xs px-2.5 py-1 rounded-lg border font-semibold transition-all flex items-center gap-1 ${
                      selected.aiEnabled && !selected.personal && !selected.humanTakeover
                        ? 'border-neon/40 bg-neon/15 text-neon hover:bg-neon/25'
                        : 'border-white/10 bg-white/5 text-white/50 hover:bg-white/10'
                    }`}
                  >
                    <span>🤖</span>
                    <span className="hidden sm:inline">{selected.aiEnabled ? 'Remy Activo' : 'Remy Pausado'}</span>
                  </button>

                  {/* Botón Tomar / Liberar por Humano */}
                  <button
                    onClick={() => updateConversation({ humanTakeover: !selected.humanTakeover })}
                    disabled={updating}
                    title={selected.humanTakeover ? 'Liberar control y permitir a Remy atender' : 'Tomar conversación como operador humano'}
                    className={`text-xs px-2.5 py-1 rounded-lg border font-semibold transition-all flex items-center gap-1 ${
                      selected.humanTakeover
                        ? 'border-sky-400/40 bg-sky-400/20 text-sky-200'
                        : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
                    }`}
                  >
                    <span>👤</span>
                    <span className="hidden sm:inline">{selected.humanTakeover ? 'Liberar' : 'Tomar'}</span>
                  </button>

                  {/* Botón Personal */}
                  <button
                    onClick={() => updateConversation({ personal: !selected.personal })}
                    disabled={updating}
                    title="Marcar como contacto personal"
                    className={`text-xs px-2.5 py-1 rounded-lg border transition-all ${
                      selected.personal
                        ? 'border-white/30 bg-white/20 text-white font-bold'
                        : 'border-white/10 bg-white/5 text-white/40 hover:bg-white/10'
                    }`}
                  >
                    Personal
                  </button>

                  {/* Botón Drawer Ficha CRM */}
                  <button
                    onClick={() => setShowCrmDrawer((v) => !v)}
                    title="Abrir u ocultar ficha CRM del cliente"
                    className={`text-xs px-2.5 py-1 rounded-lg border font-semibold transition-all flex items-center gap-1 ${
                      showCrmDrawer
                        ? 'border-neon bg-neon text-black font-bold'
                        : 'border-white/10 bg-white/5 text-white/80 hover:bg-white/10'
                    }`}
                  >
                    <span>📋</span>
                    <span className="hidden md:inline">Ficha CRM</span>
                  </button>
                </div>
              </header>

              {/* CUERPO DEL CHAT + DRAWER CRM */}
              <div className="flex-1 flex min-h-0 relative">
                {/* HISTORIAL DE MENSAJES SCROLLEABLE */}
                <div
                  ref={messagesContainerRef}
                  onScroll={handleScroll}
                  className="flex-1 overflow-y-auto p-4 space-y-3 overscroll-contain relative"
                >
                  {loadingMessages ? (
                    <div className="flex h-full items-center justify-center text-xs text-white/40">
                      Cargando mensajes…
                    </div>
                  ) : chatMessages.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center text-center p-6 text-white/40">
                      <span className="text-3xl mb-2">💬</span>
                      <p className="text-sm font-semibold text-white/60">Aún no hay mensajes en esta conversación</p>
                      <p className="text-xs mt-1">Escribe una respuesta abajo para iniciar la conversación.</p>
                    </div>
                  ) : (
                    chatMessages.map((m) => {
                      const isOut = m.direction === 'outbound';
                      return (
                        <div key={m.id} className={`flex ${isOut ? 'justify-end' : 'justify-start'}`}>
                          <div
                            className={`max-w-[82%] sm:max-w-[70%] rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap break-words shadow-md ${
                              isOut
                                ? 'bg-gradient-to-br from-[#0c402d] to-[#082a1d] text-emerald-50 border border-emerald-500/30 rounded-br-sm'
                                : 'bg-white/[0.07] text-white border border-white/10 rounded-bl-sm'
                            }`}
                          >
                            <p>{m.body}</p>
                            <div className="mt-1 flex items-center justify-end gap-1.5 text-[10px] text-white/45">
                              <span>{formatFullDate(m.timestamp)}</span>
                              {isOut && renderOutboundStatus(m.status)}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* BOTÓN FLOTANTE: NUEVOS MENSAJES */}
                {newMessagesCount > 0 && (
                  <button
                    onClick={() => scrollToBottom('smooth')}
                    className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 bg-neon text-black text-xs font-black px-4 py-2 rounded-full shadow-[0_0_20px_rgba(0,255,179,0.4)] flex items-center gap-1.5 animate-bounce"
                  >
                    <span>⬇</span> {newMessagesCount} nuevos mensajes
                  </button>
                )}

                {/* DRAWER CRM COLAPSABLE */}
                {showCrmDrawer && (
                  <aside className="w-full sm:w-[320px] lg:w-[340px] shrink-0 border-l border-white/10 bg-[#05140e] flex flex-col z-20 absolute inset-y-0 right-0 sm:relative shadow-2xl">
                    <div className="p-3 border-b border-white/10 flex items-center justify-between">
                      <div className="font-bold text-xs text-white uppercase tracking-wider flex items-center gap-1.5">
                        <span>👤</span> Ficha del Cliente
                      </div>
                      <button onClick={() => setShowCrmDrawer(false)} className="text-sm text-white/50 hover:text-white p-1">
                        ×
                      </button>
                    </div>

                    <div className="p-4 overflow-y-auto flex-1 space-y-4 text-xs">
                      {loadingCustomer ? (
                        <div className="text-white/40 text-center py-6">Cargando datos CRM…</div>
                      ) : (
                        <>
                          <div>
                            <div className="text-[10px] uppercase font-bold text-neon/80 tracking-wider">Identidad</div>
                            <div className="font-bold text-sm text-white mt-1">{customerData?.full_name || selected.name || 'Sin nombre'}</div>
                            <div className="text-white/60 font-mono mt-0.5">{selected.phone || 'Sin teléfono'}</div>
                            {customerData?.email && <div className="text-white/60 mt-0.5">{customerData.email}</div>}
                          </div>

                          {customerData?.address_line1 && (
                            <div>
                              <div className="text-[10px] uppercase font-bold text-neon/80 tracking-wider">Dirección</div>
                              <div className="text-white/80 mt-1">{customerData.address_line1} {customerData.city ? `(${customerData.city})` : ''}</div>
                            </div>
                          )}

                          <div className="grid grid-cols-2 gap-2 bg-white/[0.03] border border-white/10 rounded-xl p-3">
                            <div>
                              <div className="text-[10px] text-white/40">Total Pedidos</div>
                              <div className="font-mono font-bold text-base text-white mt-0.5">{customerData?.total_orders || 0}</div>
                            </div>
                            <div>
                              <div className="text-[10px] text-white/40">Total Comprado</div>
                              <div className="font-mono font-bold text-base text-neon mt-0.5">
                                ${(customerData?.total_spent || 0).toLocaleString('es-CL')}
                              </div>
                            </div>
                          </div>

                          {customerData?.notes && (
                            <div>
                              <div className="text-[10px] uppercase font-bold text-amber-300/80 tracking-wider">Notas CRM</div>
                              <p className="text-white/80 mt-1 bg-amber-400/10 border border-amber-400/20 rounded-lg p-2 leading-relaxed">
                                {customerData.notes}
                              </p>
                            </div>
                          )}

                          {selected.customerId && (
                            <div className="pt-2 border-t border-white/10">
                              <Link
                                href={`/admin/clientes/${selected.customerId}`}
                                className="w-full block text-center py-2 px-3 rounded-xl bg-white/[0.05] border border-white/10 text-neon font-bold text-xs hover:bg-white/10"
                              >
                                Ver historial completo en CRM →
                              </Link>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </aside>
                )}
              </div>

              {/* COMPOSER FIJO AL PIE */}
              <footer className="shrink-0 p-3 border-t border-white/10 bg-[#04120c] z-10">
                <div className="flex items-end gap-2 max-w-full">
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        void sendMessage();
                      }
                    }}
                    rows={1}
                    placeholder={`Responder a ${selected.name || 'este chat'} (Enter para enviar, Shift+Enter para nueva línea)…`}
                    className="flex-1 max-h-32 min-h-[44px] bg-white/[0.06] border border-white/15 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-white/40 outline-none focus:border-neon resize-none leading-relaxed"
                  />
                  <button
                    onClick={() => void sendMessage()}
                    disabled={sending || !text.trim()}
                    className="h-[44px] px-5 bg-neon hover:bg-white text-black font-extrabold text-xs sm:text-sm rounded-xl transition-colors disabled:opacity-30 disabled:cursor-not-allowed shrink-0 flex items-center gap-1.5 shadow-[0_0_15px_rgba(0,255,179,0.2)]"
                  >
                    {sending ? 'Enviando…' : 'Enviar 🚀'}
                  </button>
                </div>
              </footer>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-white/40">
              <span className="text-4xl mb-3">💬</span>
              <p className="text-base font-bold text-white">Selecciona una conversación</p>
              <p className="text-xs text-white/50 mt-1 max-w-sm">
                Elige un chat de la lista izquierda para ver el historial y responder en tiempo real.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
