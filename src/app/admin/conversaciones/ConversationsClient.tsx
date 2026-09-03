'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { PageHeader, EmptyState } from '../_ui/AdminUI';

type Channel = 'whatsapp' | 'instagram' | 'web';
type Conversation = {
  id: string; channel: Channel; name: string; phone: string | null; email: string | null; externalId: string;
  customerId: string | null; crmStatus: string; externalThreadId: string; status: string; humanTakeover: boolean;
  unreadCount: number; provider: string | null; transport: string | null; lastMessage: string | null;
  lastDirection: string | null; lastMessageStatus: string | null; lastMessageAt: string | null;
  lastInboundAt: string | null; serviceWindowExpiresAt: string | null; personal: boolean; aiEnabled: boolean;
};
type Message = {
  id: string; direction: 'inbound' | 'outbound'; message_type: string; body: string | null; status: string | null;
  provider: string | null; transport: string | null; source?: string | null; timestamp: string;
};
type AiSettings = {
  enabled: boolean;
  provider: string;
  model: string;
  providers?: Record<string, boolean>;
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
// Combines the 4 independent switches (global, per-conversation, human
// takeover, personal) into a single at-a-glance state, so you don't have to
// open a conversation to know whether Remy is actually going to answer it.
function conversationAiState(conversation: Conversation, aiGlobalEnabled: boolean) {
  if (conversation.personal) return { dot: '⚪', label: 'Personal', hint: 'Contacto personal: excluido del CRM y de Remy.' };
  if (conversation.humanTakeover) return { dot: '🔵', label: 'Tomado por humano', hint: 'Un humano tomó esta conversación. Remy está pausado hasta liberarla.' };
  if (conversation.channel === 'whatsapp' && !aiGlobalEnabled) return { dot: '⚪', label: 'Pausado (global)', hint: 'El interruptor global de WhatsApp IA está apagado. Afecta a todas las conversaciones por igual.' };
  if (!conversation.aiEnabled) return { dot: '🟠', label: 'Pausado aquí', hint: 'Apagaste a Remy en esta conversación puntual. Actívalo con el botón "Habilitar Remy" o con "Reactivar en todas".' };
  return { dot: '🟢', label: conversation.channel === 'whatsapp' ? 'Remy activo' : 'Remy listo', hint: 'Remy va a responder automáticamente a los próximos mensajes de este chat.' };
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
  const [filter, setFilter] = useState<'all' | Channel>('all');
  const [error, setError] = useState<string | null>(null);
  const [ai, setAi] = useState<AiSettings>({ enabled: false, provider: 'gemini', model: 'gemini-2.5-flash', providers: {} });
  const [savingAi, setSavingAi] = useState(false);
  const [bulkEnabling, setBulkEnabling] = useState(false);

  const visibleConversations = useMemo(() => filter === 'all' ? conversations : conversations.filter((item) => item.channel === filter), [conversations, filter]);
  const selected = useMemo(() => conversations.find((conversation) => conversation.id === selectedId) || null, [conversations, selectedId]);
  const windowState = useMemo(() => remainingWindow(selected?.serviceWindowExpiresAt || null), [selected?.serviceWindowExpiresAt]);
  const hasConnectedProvider = useMemo(() => Object.values(ai.providers || {}).some(Boolean), [ai.providers]);
  const pausedIndividuallyCount = useMemo(() => conversations.filter((item) => (
    (item.channel === 'whatsapp' || item.channel === 'instagram') && !item.aiEnabled && !item.personal
  )).length, [conversations]);

  const loadConversations = useCallback(async () => {
    const response = await fetch('/api/admin/conversations', { cache: 'no-store' });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || 'No se pudieron cargar las conversaciones');
    const next: Conversation[] = body.data || [];
    setConversations(next);
    setSelectedId((current) => current && next.some((item) => item.id === current) ? current : next[0]?.id || null);
  }, []);
  const loadAi = useCallback(async () => {
    const response = await fetch('/api/admin/ai/settings', { cache: 'no-store' });
    if (response.status === 401) return;
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || 'No se pudo cargar la configuración IA');
    setAi({
      enabled: Boolean(body.enabled),
      provider: String(body.provider || 'gemini'),
      model: String(body.model || 'gemini-2.5-flash'),
      providers: body.providers && typeof body.providers === 'object' ? body.providers : {},
    });
  }, []);
  const loadMessages = useCallback(async (conversationId: string, background = false) => {
    if (!background) setLoadingMessages(true);
    try {
      const response = await fetch(`/api/admin/conversations/${conversationId}/messages`, { cache: 'no-store' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'No se pudieron cargar los mensajes');
      setMessages(body.data || []);
    } finally {
      if (!background) setLoadingMessages(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadConversations(), loadAi()]).catch((err) => setError(err instanceof Error ? err.message : 'Error al cargar')).finally(() => setLoading(false));
  }, [loadConversations, loadAi]);
  useEffect(() => { if (selectedId) loadMessages(selectedId).catch((err) => setError(err instanceof Error ? err.message : 'Error al cargar mensajes')); }, [selectedId, loadMessages]);
  useEffect(() => {
    const timer = window.setInterval(() => {
      loadConversations().catch(() => undefined);
      if (selectedId) loadMessages(selectedId, true).catch(() => undefined);
    }, 8000);
    return () => window.clearInterval(timer);
  }, [loadConversations, loadMessages, selectedId]);
  useEffect(() => {
    if (visibleConversations.length && (!selectedId || !visibleConversations.some((item) => item.id === selectedId))) setSelectedId(visibleConversations[0].id);
  }, [visibleConversations, selectedId]);

  const toggleGlobalAi = async () => {
    setSavingAi(true); setError(null);
    try {
      const response = await fetch('/api/admin/ai/settings', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: !ai.enabled }),
      });
      const body = await response.json();
      if (!response.ok) {
        if (String(body.error || '').startsWith('provider_not_connected:')) throw new Error('El proveedor IA global no está conectado. Revisa Integraciones/Agentes.');
        throw new Error(body.error || 'No se pudo cambiar la IA automática');
      }
      await loadAi();
    } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo cambiar la IA automática'); }
    finally { setSavingAi(false); }
  };

  const bulkEnableAi = async () => {
    if (bulkEnabling || pausedIndividuallyCount === 0) return;
    const confirmed = window.confirm(
      `Esto va a reactivar Remy en ${pausedIndividuallyCount} conversación${pausedIndividuallyCount === 1 ? '' : 'es'} donde lo apagaste manualmente. `
      + 'No afecta a las conversaciones marcadas como Personal ni a las que tiene tomadas un humano. ¿Continuar?',
    );
    if (!confirmed) return;
    setBulkEnabling(true); setError(null);
    try {
      const response = await fetch('/api/admin/conversations/bulk-enable-ai', { method: 'POST' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'No se pudo reactivar Remy en las conversaciones');
      await loadConversations();
    } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo reactivar Remy en las conversaciones'); }
    finally { setBulkEnabling(false); }
  };

  const patchConversation = async (patch: { personal?: boolean; aiEnabled?: boolean; humanTakeover?: boolean }) => {
    if (!selected || updating) return;
    setUpdating(true); setError(null);
    try {
      const response = await fetch(`/api/admin/conversations/${selected.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error === 'personal_contact_ai_blocked' ? 'Los contactos personales nunca pueden tener IA automática.' : body.error || 'No se pudo actualizar');
      await loadConversations();
    } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo actualizar'); }
    finally { setUpdating(false); }
  };

  const send = async () => {
    if (!selectedId || !selected || !text.trim() || sending || !windowState.open) return;
    setSending(true); setError(null);
    try {
      const response = await fetch('/api/admin/messages/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conversationId: selectedId, text: text.trim() }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error === 'service_window_closed' ? body.message : body.error || 'No se pudo enviar el mensaje');
      setText('');
      await Promise.all([loadMessages(selectedId), loadConversations()]);
    } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo enviar el mensaje'); }
    finally { setSending(false); }
  };

  const counts = useMemo(() => ({
    all: conversations.length,
    whatsapp: conversations.filter((item) => item.channel === 'whatsapp').length,
    instagram: conversations.filter((item) => item.channel === 'instagram').length,
    web: conversations.filter((item) => item.channel === 'web').length,
  }), [conversations]);

  return (
    <div className="max-w-[1240px] text-crema">
      <PageHeader eyebrow="✦ Omnicanal" title="Conversaciones" action={
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <span className="rounded-full border border-neon/30 bg-neon/10 px-3 py-1.5 text-neon font-semibold">WhatsApp + Instagram + Web</span>
          <button onClick={() => void toggleGlobalAi()} disabled={savingAi || (!hasConnectedProvider && !ai.enabled)} title="Prende o apaga a Remy para TODO WhatsApp de una. No afecta los interruptores individuales de cada conversación." className={`rounded-full border px-3 py-1.5 font-semibold transition-colors disabled:opacity-40 ${ai.enabled ? 'border-neon/50 bg-neon/15 text-neon' : 'border-white/10 bg-white/5 text-white/60'}`}>
            {ai.enabled ? '🤖 WhatsApp IA global ON' : '🤖 WhatsApp IA global OFF'}
          </button>
          {pausedIndividuallyCount > 0 && (
            <button
              onClick={() => void bulkEnableAi()}
              disabled={bulkEnabling}
              title="Reactiva el interruptor individual de Remy en todas las conversaciones donde lo apagaste a mano. No toca conversaciones Personales ni tomadas por un humano."
              className="rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1.5 font-semibold text-amber-200 transition-colors disabled:opacity-40"
            >
              {bulkEnabling ? 'Reactivando…' : `🔄 Reactivar Remy en las ${pausedIndividuallyCount} pausadas`}
            </button>
          )}
        </div>
      } />

      <div className="mb-4 rounded-xl border border-white/10 bg-white/[0.025] p-3 flex flex-wrap items-center gap-3">
        <div className={`text-[10px] px-2.5 py-2 rounded-lg ${hasConnectedProvider ? 'text-neon bg-neon/10' : 'text-amber-200 bg-amber-400/10'}`}>
          {hasConnectedProvider ? 'Proveedor IA conectado' : 'Falta conectar un proveedor IA'}
        </div>
        <div className="text-[10px] text-white/45">El modelo de Remy se administra en <b>Agentes</b>. Este interruptor solo habilita o bloquea la automatización global de WhatsApp — cada conversación además tiene su propio interruptor individual (columna izquierda y botón &quot;Habilitar Remy&quot; en cada chat).</div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {([['all', `Todos ${counts.all}`], ['whatsapp', `🟢 WhatsApp ${counts.whatsapp}`], ['instagram', `🟣 Instagram ${counts.instagram}`], ['web', `🌐 Web ${counts.web}`]] as const).map(([key, label]) => (
          <button key={key} onClick={() => setFilter(key)} className={`rounded-full px-3 py-1.5 text-[11px] font-semibold border ${filter === key ? 'border-neon/50 bg-neon/15 text-neon' : 'border-white/10 bg-white/[0.03] text-white/55'}`}>{label}</button>
        ))}
      </div>
      {error && <div className="mb-4 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-xs text-red-200">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-[370px_minmax(0,1fr)] gap-5 min-h-[680px]">
        <div className="rounded-2xl border border-white/10 bg-[#050e0a]/90 overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10 text-xs text-white/60">{loading ? 'Cargando...' : `${visibleConversations.length} conversaciones`}</div>
          <div className="max-h-[720px] overflow-y-auto">
            {!loading && visibleConversations.length === 0 ? <EmptyState emoji="💬" texto="Aún no hay conversaciones en este canal." /> : visibleConversations.map((conversation) => {
              const active = conversation.id === selectedId; const meta = channelMeta(conversation.channel);
              const aiState = conversationAiState(conversation, ai.enabled);
              return <button key={conversation.id} onClick={() => setSelectedId(conversation.id)} className={`w-full text-left px-4 py-4 border-b border-white/5 ${active ? 'bg-neon/10' : 'hover:bg-white/[0.03]'}`}>
                <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="text-sm font-bold text-white truncate">{meta.icon} {conversation.name}</div><div className="text-[10px] text-white/40 mt-0.5 truncate">{conversation.channel === 'whatsapp' && conversation.phone ? `+${conversation.phone.replace(/^\+/, '')}` : meta.label}</div></div><div className="text-[9px] text-white/35 text-right shrink-0"><div>{formatDate(conversation.lastMessageAt)}</div></div></div>
                <div className="mt-2 text-xs text-white/55 truncate">{conversation.lastDirection === 'outbound' ? 'Tú: ' : ''}{conversation.lastMessage || 'Sin mensajes'}</div>
                <div title={aiState.hint} className="mt-1.5 inline-flex items-center gap-1 text-[10px] text-white/50">{aiState.dot} {aiState.label}</div>
              </button>;
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#050e0a] flex flex-col overflow-hidden min-h-[680px]">
          {!selected ? <div className="flex-1 grid place-items-center"><EmptyState emoji="💬" texto="Selecciona una conversación." /></div> : <>
            <div className="px-5 py-4 border-b border-white/10 flex flex-wrap items-start justify-between gap-3">
              <div><div className="font-display font-bold text-white">{channelMeta(selected.channel).icon} {selected.name}</div><div className="text-xs text-muted mt-1">{selected.channel === 'whatsapp' && selected.phone ? `+${selected.phone.replace(/^\+/, '')}` : selected.externalId} · {channelMeta(selected.channel).label}</div><div className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold ${windowState.open ? 'bg-neon/10 text-neon border border-neon/20' : 'bg-amber-400/10 text-amber-200 border border-amber-400/20'}`}>{windowState.open ? '🟢' : '🟠'} {windowState.label}</div></div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                {selected.channel !== 'web' && <button
                  onClick={() => void patchConversation({ aiEnabled: !selected.aiEnabled })}
                  disabled={updating || selected.personal || selected.humanTakeover}
                  title={selected.personal ? 'No puedes activar Remy: esta conversación está marcada como Personal.' : selected.humanTakeover ? 'No puedes activar Remy: un humano tiene tomada esta conversación. Libérala primero con "Liberar a Remy".' : 'Solo afecta a esta conversación. El interruptor global de WhatsApp está más arriba.'}
                  className={`rounded-lg border px-2.5 py-1.5 text-[10px] disabled:opacity-40 ${selected.aiEnabled ? 'border-neon/40 bg-neon/10 text-neon' : 'border-white/10 bg-white/5 text-white/50'}`}
                >{selected.aiEnabled ? '🤖 Remy habilitado' : '🤖 Habilitar Remy'}</button>}
                <button
                  onClick={() => void patchConversation({ humanTakeover: !selected.humanTakeover })}
                  disabled={updating || selected.personal}
                  title={selected.personal ? 'Las conversaciones personales no pasan por el CRM ni por Remy.' : selected.humanTakeover ? 'Vuelve a habilitar a Remy para esta conversación (según su interruptor individual).' : 'Pausa a Remy en esta conversación hasta que la liberes.'}
                  className={`rounded-lg border px-2.5 py-1.5 text-[10px] disabled:opacity-40 ${selected.humanTakeover ? 'border-sky-300/40 bg-sky-300/10 text-sky-200' : 'border-white/10 bg-white/5 text-white/50'}`}
                >{selected.humanTakeover ? '👤 Liberar a Remy' : '👤 Tomar conversación'}</button>
                <button onClick={() => void patchConversation({ personal: !selected.personal })} disabled={updating} title="Las conversaciones personales quedan fuera del CRM y nunca las contesta Remy, sin importar los otros interruptores." className={`rounded-lg border px-2.5 py-1.5 text-[10px] ${selected.personal ? 'border-amber-300/30 bg-amber-300/10 text-amber-200' : 'border-white/10 bg-white/5 text-white/50'}`}>{selected.personal ? '👤 Personal / No CRM' : 'Marcar como personal'}</button>
                <div className="text-right text-[10px] text-white/45"><div>CRM: {selected.personal ? 'excluido' : selected.crmStatus}</div><div>IA: {selected.channel === 'whatsapp' ? (ai.enabled && selected.aiEnabled && !selected.personal && !selected.humanTakeover ? 'activa' : 'inactiva') : (selected.aiEnabled && !selected.personal && !selected.humanTakeover ? 'preparada' : 'inactiva')}{selected.humanTakeover ? ' · humano' : ''}</div></div>
              </div>
            </div>
            {selected.personal && <div className="px-5 pb-3 -mt-1 text-[10px] text-amber-200/80">👤 Marcada como Personal: no puedes activar Remy ni la toma humana mientras esté así. Desmárcala primero si quieres automatizarla.</div>}
            {!selected.personal && selected.humanTakeover && <div className="px-5 pb-3 -mt-1 text-[10px] text-sky-200/80">🔵 Tomada por un humano: el botón &quot;Habilitar Remy&quot; queda bloqueado hasta que la liberes.</div>}

            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-3 bg-black/10">
              {loadingMessages ? <div className="text-center text-xs text-muted py-8">Cargando conversación...</div> : messages.length === 0 ? <EmptyState emoji="✉️" texto="Esta conversación todavía no tiene mensajes." /> : messages.map((message) => {
                const outbound = message.direction === 'outbound'; const remy = message.source === 'remy_ai';
                return <div key={message.id} className={`flex ${outbound ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${outbound ? 'bg-neon text-[#03110b] rounded-br-md' : 'bg-white/8 text-white border border-white/10 rounded-bl-md'}`}><div className="whitespace-pre-wrap break-words">{message.body || `[${message.message_type}]`}</div><div className={`mt-1.5 text-[9px] ${outbound ? 'text-black/50' : 'text-white/35'}`}>{formatDate(message.timestamp)}{outbound && message.status ? ` · ${message.status}` : ''}{remy ? ' · 🤖 Remy' : ''}{message.source === 'whatsapp_business_app' ? ' · enviado desde app' : ''}</div></div></div>;
              })}
            </div>

            <div className="border-t border-white/10 p-4 bg-[#050e0a]">
              {selected.humanTakeover && <div className="mb-3 rounded-xl border border-sky-300/20 bg-sky-300/10 p-3 text-xs text-sky-100">👤 Atención humana activa: Remy quedó pausado para esta conversación hasta que pulses “Liberar a Remy”.</div>}
              {!windowState.open && selected.channel === 'whatsapp' && <div className="mb-3 rounded-xl border border-amber-400/20 bg-amber-400/10 p-3 text-xs text-amber-100">La ventana API de 24 h está cerrada. El CRM bloquea el envío libre.</div>}
              <div className="flex gap-3 items-end"><textarea value={text} onChange={(event) => setText(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void send(); } }} rows={3} maxLength={4096} disabled={!windowState.open || selected.channel === 'web'} placeholder={windowState.open ? `Responder por ${channelMeta(selected.channel).label}...` : 'Ventana de respuesta cerrada'} className="flex-1 resize-none rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white outline-none focus:border-neon/50 disabled:opacity-45" /><button onClick={() => void send()} disabled={sending || !text.trim() || !windowState.open || selected.channel === 'web'} className="rounded-xl bg-neon text-black font-bold text-sm px-5 py-3 disabled:opacity-40">{sending ? 'Enviando...' : 'Enviar'}</button></div>
              <div className="mt-2 text-[10px] text-white/35">Respuesta humana manual disponible dentro de la ventana del canal. Remy solo responde si el canal, la conversación y el interruptor aplicable están habilitados y no hay takeover humano.</div>
            </div>
          </>}
        </div>
      </div>
    </div>
  );
}
