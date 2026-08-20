'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { PageHeader, EmptyState } from '../_ui/AdminUI';

type Conversation = {
  id: string;
  channel: 'whatsapp' | 'instagram' | 'web';
  name: string;
  phone: string | null;
  crmStatus: string;
  lastMessage: string | null;
  lastMessageAt: string | null;
  orderId: number | null;
  personal: boolean;
};

type SaleDraft = {
  conversationId: string;
  saleDetected: boolean;
  customerName: string;
  phone: string;
  email: string;
  address: string;
  comuna: string;
  deliveryDate: string;
  paymentMethod: 'transfer' | 'mercadopago' | 'flow' | 'whatsapp' | 'unknown';
  paymentEvidence: boolean;
  zoneId: string | null;
  zoneName: string | null;
  items: Array<{ productId: string; productName: string; quantity: number; format: string | null; variety: string | null }>;
  transcriptTotal: number | null;
  calculated: { subtotal: number; shipping: number; total: number } | null;
  notes: string;
  missing: string[];
};

const MISSING_LABELS: Record<string, string> = {
  venta_no_detectada: 'No se detectó una venta cerrada',
  nombre: 'Nombre',
  telefono: 'Teléfono',
  productos: 'Productos',
  direccion: 'Dirección',
  comuna: 'Comuna',
  fecha_entrega: 'Fecha de entrega',
  zona_despacho: 'Zona de despacho',
  medio_pago: 'Medio de pago',
  validacion_pedido: 'Validación de precios/stock',
  total_no_coincide: 'El total del chat no coincide con catálogo + despacho',
};

function clp(value: number | null | undefined) {
  return `$${Number(value || 0).toLocaleString('es-CL')}`;
}

function dateLabel(value: string | null) {
  if (!value) return '';
  return new Date(value).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' });
}

function paymentLabel(value: SaleDraft['paymentMethod']) {
  if (value === 'transfer') return 'Transferencia';
  if (value === 'mercadopago') return 'Mercado Pago';
  if (value === 'flow') return 'Flow';
  if (value === 'whatsapp') return 'Coordinación por WhatsApp';
  return 'No detectado';
}

export default function ConversationSalesClient() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<SaleDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [preparing, setPreparing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ orderId: number; trackingNumber?: string | null; total?: number } | null>(null);

  const load = useCallback(async () => {
    const response = await fetch('/api/admin/conversations', { cache: 'no-store' });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || 'No se pudieron cargar las conversaciones');
    setConversations((body.data || []).filter((item: Conversation) => item.channel !== 'web' && !item.personal));
  }, []);

  useEffect(() => {
    setLoading(true);
    load().catch((err) => setError(err instanceof Error ? err.message : 'Error al cargar')).finally(() => setLoading(false));
  }, [load]);

  const pending = useMemo(() => conversations.filter((item) => !item.orderId), [conversations]);
  const selected = useMemo(() => conversations.find((item) => item.id === selectedId) || null, [conversations, selectedId]);

  const prepare = async (conversation: Conversation) => {
    setSelectedId(conversation.id);
    setDraft(null);
    setSuccess(null);
    setPreparing(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/conversations/${conversation.id}/sale`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'prepare' }),
      });
      const body = await response.json();
      if (!response.ok) {
        if (String(body.error || '').startsWith('conversation_already_has_order:')) throw new Error('Esta conversación ya tiene un pedido registrado.');
        throw new Error(body.error || 'No se pudo analizar la conversación');
      }
      setDraft(body.draft);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo analizar la venta');
    } finally {
      setPreparing(false);
    }
  };

  const confirm = async () => {
    if (!selected || !draft || draft.missing.length || confirming) return;
    setConfirming(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/conversations/${selected.id}/sale`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'confirm', draft }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'No se pudo registrar el pedido');
      setSuccess({ orderId: Number(body.orderId), trackingNumber: body.trackingNumber || null, total: body.total });
      setDraft(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar el pedido');
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="max-w-[1180px] text-crema">
      <PageHeader eyebrow="✦ CRM + Pedidos" title="Ventas desde conversaciones" action={
        <Link href="/admin/conversaciones" className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] text-white/70 hover:text-white">Ver conversaciones</Link>
      } />

      <div className="mb-5 rounded-2xl border border-neon/20 bg-neon/[0.05] p-4 text-xs text-white/70 leading-relaxed">
        Cuando cierres una venta manual por WhatsApp o Instagram, pulsa <b className="text-neon">Preparar pedido</b>. Remy lee el historial sólo para completar el borrador; no responde al cliente ni crea nada. El pedido, CRM, stock y pago sólo cambian cuando tú pulsas <b className="text-white">Confirmar pedido</b>.
      </div>

      {error && <div className="mb-4 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-xs text-red-200">{error}</div>}
      {success && <div className="mb-4 rounded-xl border border-neon/30 bg-neon/10 px-4 py-3 text-sm text-neon">✅ Pedido #{success.orderId} registrado{success.trackingNumber ? ` · ${success.trackingNumber}` : ''}{success.total ? ` · ${clp(success.total)}` : ''}. <Link className="underline font-bold" href={`/admin/pedidos/${success.orderId}`}>Abrir pedido</Link></div>}

      <div className="grid grid-cols-1 lg:grid-cols-[420px_minmax(0,1fr)] gap-5">
        <section className="rounded-2xl border border-white/10 bg-[#050e0a] overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10 text-xs text-white/55">{loading ? 'Cargando...' : `${pending.length} conversaciones sin pedido`}</div>
          <div className="max-h-[700px] overflow-y-auto">
            {!loading && pending.length === 0 ? <EmptyState emoji="✅" texto="No hay conversaciones pendientes de registrar como pedido." /> : pending.map((conversation) => (
              <div key={conversation.id} className={`p-4 border-b border-white/5 ${selectedId === conversation.id ? 'bg-neon/[0.07]' : ''}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-bold text-sm text-white truncate">{conversation.channel === 'whatsapp' ? '🟢' : '🟣'} {conversation.name}</div>
                    <div className="text-[10px] text-white/40 mt-1">CRM: {conversation.crmStatus} · {dateLabel(conversation.lastMessageAt)}</div>
                  </div>
                  <button onClick={() => void prepare(conversation)} disabled={preparing} className="shrink-0 rounded-lg bg-neon px-3 py-2 text-[10px] font-bold text-black disabled:opacity-40">
                    {preparing && selectedId === conversation.id ? 'Analizando…' : '🧾 Preparar pedido'}
                  </button>
                </div>
                <div className="mt-2 text-xs text-white/55 line-clamp-2">{conversation.lastMessage || 'Sin vista previa'}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-[#050e0a] min-h-[520px] p-5">
          {!draft && !preparing ? <EmptyState emoji="🧾" texto="Selecciona una conversación y prepara el pedido." /> : preparing ? <div className="h-full min-h-[420px] grid place-items-center text-sm text-white/50">Remy está leyendo la conversación y contrastando catálogo, stock y despacho…</div> : draft && (
            <div>
              <div className="flex items-start justify-between gap-3 mb-5">
                <div>
                  <div className="text-[10px] tracking-[2px] uppercase text-neon font-bold">Borrador detectado</div>
                  <h2 className="font-display font-bold text-xl text-white mt-1">{draft.customerName || 'Cliente sin nombre'}</h2>
                  <div className="text-xs text-white/45 mt-1">{draft.phone || 'Sin teléfono'} · {paymentLabel(draft.paymentMethod)}</div>
                </div>
                <span className={`rounded-full px-3 py-1 text-[10px] font-bold border ${draft.saleDetected ? 'border-neon/30 bg-neon/10 text-neon' : 'border-amber-400/30 bg-amber-400/10 text-amber-200'}`}>{draft.saleDetected ? 'Venta detectada' : 'No concluyente'}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4 text-xs">
                <div className="rounded-xl bg-white/[0.035] border border-white/10 p-3"><div className="text-white/35 uppercase text-[9px] mb-1">Despacho</div><div className="text-white">{draft.address || '—'}</div><div className="text-white/55 mt-1">{draft.comuna || '—'} · {draft.zoneName || 'Zona sin detectar'}</div></div>
                <div className="rounded-xl bg-white/[0.035] border border-white/10 p-3"><div className="text-white/35 uppercase text-[9px] mb-1">Entrega / Pago</div><div className="text-white">{draft.deliveryDate || 'Fecha sin detectar'}</div><div className="text-white/55 mt-1">{paymentLabel(draft.paymentMethod)}{draft.paymentEvidence ? ' · comprobante/evidencia en chat' : ''}</div></div>
              </div>

              <div className="rounded-xl border border-white/10 overflow-hidden mb-4">
                {draft.items.length ? draft.items.map((item, index) => (
                  <div key={`${item.productId}-${index}`} className="flex items-center justify-between gap-3 px-4 py-3 border-b last:border-b-0 border-white/5 text-sm">
                    <div><div className="text-white font-semibold">{item.quantity} × {item.productName}</div><div className="text-[10px] text-white/40">{[item.format, item.variety].filter(Boolean).join(' · ') || 'Formato estándar'}</div></div>
                  </div>
                )) : <div className="p-4 text-xs text-amber-200">No se pudieron identificar productos del catálogo con seguridad.</div>}
              </div>

              {draft.calculated && <div className="rounded-xl bg-white/[0.035] border border-white/10 p-4 mb-4 text-sm"><div className="flex justify-between text-white/55"><span>Productos</span><span>{clp(draft.calculated.subtotal)}</span></div><div className="flex justify-between text-white/55 mt-1"><span>Despacho</span><span>{clp(draft.calculated.shipping)}</span></div><div className="flex justify-between text-neon font-bold text-base mt-2 pt-2 border-t border-white/10"><span>Total</span><span>{clp(draft.calculated.total)}</span></div>{draft.transcriptTotal ? <div className="text-[10px] text-white/40 mt-2">Total mencionado en chat: {clp(draft.transcriptTotal)}</div> : null}</div>}

              {draft.missing.length > 0 ? (
                <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 mb-4"><div className="text-xs font-bold text-amber-200 mb-2">⚠️ Falta validar antes de crear el pedido:</div><div className="flex flex-wrap gap-2">{draft.missing.map((item) => <span key={item} className="rounded-full bg-black/20 px-2.5 py-1 text-[10px] text-amber-100">{MISSING_LABELS[item] || item}</span>)}</div><div className="text-[10px] text-amber-100/60 mt-3">No se descontará stock ni se marcará pago mientras exista una inconsistencia.</div></div>
              ) : (
                <div className="rounded-xl border border-neon/30 bg-neon/10 p-4 mb-4 text-xs text-neon">✓ Datos suficientes y precios/stock revalidados. {draft.paymentMethod === 'transfer' ? 'Al confirmar, la transferencia quedará marcada como pagada porque esta acción es tu validación humana.' : 'El pago quedará pendiente hasta confirmación de la pasarela.'}</div>
              )}

              {draft.notes && <div className="text-xs text-white/45 mb-4">Nota detectada: {draft.notes}</div>}
              <button onClick={() => void confirm()} disabled={draft.missing.length > 0 || confirming} className="w-full rounded-xl bg-neon py-3 text-sm font-bold text-black disabled:opacity-35">{confirming ? 'Registrando…' : draft.paymentMethod === 'transfer' ? '✅ Confirmar pedido y transferencia' : '✅ Confirmar pedido'}</button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
