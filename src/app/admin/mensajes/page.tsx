'use client';

import { useState, useEffect } from 'react';
import { PageHeader, Badge, EmptyState } from '../_ui/AdminUI';

export default function MensajesPage() {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any | null>(null);
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/messages');
      const d = await r.json();
      setMessages(d.data || []);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const markRead = async (id: string, is_read: boolean) => {
    try {
      await fetch(`/api/admin/messages/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_read }),
      });
      load();
      if (selected?.id === id) {
        setSelected((s: any) => ({ ...s, is_read }));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const del = async (id: string) => {
    if (!confirm('¿Eliminar este mensaje?')) return;
    try {
      const r = await fetch(`/api/admin/messages/${id}`, { method: 'DELETE' });
      if (r.ok) {
        setSelected(null);
        load();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const openMsg = (m: any) => {
    setSelected(m);
    if (!m.is_read) markRead(m.id, true);
  };

  const filtered = messages.filter(m =>
    filter === 'all' ? true : filter === 'unread' ? !m.is_read : m.is_read
  );
  const unread = messages.filter(m => !m.is_read).length;

  return (
    <div className="max-w-[1000px] text-crema">
      <PageHeader
        eyebrow="✦ Comunicaciones"
        title="Bandeja de Entrada"
        action={
          <div className="flex gap-1.5 bg-white/5 p-1 rounded-xl">
            {(['all', 'unread', 'read'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  filter === f ? 'bg-neon text-black shadow-md' : 'text-muted hover:text-white'
                }`}
              >
                {f === 'all' ? 'Todos' : f === 'unread' ? `No leídos (${unread})` : 'Leídos'}
              </button>
            ))}
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        {/* Left Side: List */}
        <div className="bg-[#050e0a]/80 border border-white/10 rounded-2xl overflow-hidden shadow-lg divide-y divide-white/5">
          {loading ? (
            <div className="text-center py-12 text-muted text-sm font-medium">
              Cargando mensajes del servidor...
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState emoji="✉️" texto="No hay mensajes en esta bandeja." />
          ) : (
            filtered.map((m: any) => {
              const isSelected = selected?.id === m.id;
              return (
                <div
                  key={m.id}
                  onClick={() => openMsg(m)}
                  className={`p-4 transition-all cursor-pointer hover:bg-white/[0.01] ${
                    isSelected ? 'bg-white/[0.02]' : ''
                  } ${!m.is_read ? 'font-bold' : ''}`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <div className="text-sm text-white flex items-center gap-2">
                      {!m.is_read && <span className="w-2.5 h-2.5 rounded-full bg-neon animate-pulse" />}
                      {m.name}
                    </div>
                    <div className="text-[10px] text-muted font-mono">
                      {new Date(m.created_at).toLocaleDateString('es-CL')}
                    </div>
                  </div>
                  <div className="text-xs text-neon font-medium truncate mb-1">{m.subject || '(sin asunto)'}</div>
                  <div className="text-xs text-muted truncate">{m.message}</div>
                </div>
              );
            })
          )}
        </div>

        {/* Right Side: Message Detail */}
        {selected ? (
          <div className="bg-[#050e0a] border border-white/10 rounded-2xl p-6 shadow-xl relative">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="font-display font-bold text-lg text-white mb-1">
                  {selected.subject || '(sin asunto)'}
                </h3>
                <div className="text-xs text-muted font-mono">
                  {new Date(selected.created_at).toLocaleString('es-CL')}
                </div>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="text-muted hover:text-white text-base font-semibold"
              >
                ✕
              </button>
            </div>

            <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 mb-6 text-xs grid grid-cols-2 gap-4">
              {[
                ['Nombre', selected.name],
                ['Email', selected.email],
                ['Teléfono', selected.phone || '—'],
              ].map(([k, v]) => (
                <div key={k} className="col-span-2 sm:col-span-1">
                  <div className="text-[9px] uppercase tracking-wider text-neon font-bold mb-0.5">{k}</div>
                  <div className="text-white font-medium">{v}</div>
                </div>
              ))}
            </div>

            <div className="text-sm text-white/90 leading-relaxed bg-white/5 border border-white/10 rounded-xl p-4 min-h-[140px] whitespace-pre-wrap mb-6">
              {selected.message}
            </div>

            <div className="flex gap-3 pt-5 border-t border-white/5 flex-wrap">
              <a
                href={`mailto:${selected.email}?subject=Re: ${encodeURIComponent(
                  selected.subject || 'Tu mensaje a La Manito del Vegano'
                )}`}
                className="bg-neon hover:bg-neon/90 text-black px-4 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5"
              >
                ✉ Responder por mail
              </a>
              {selected.phone && (
                <a
                  href={`https://wa.me/${selected.phone.replace(/\D/g, '')}?text=${encodeURIComponent(
                    `Hola ${selected.name}, gracias por contactar a La Manito del Vegano ✦`
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="bg-[rgba(0,255,179,0.1)] hover:bg-[rgba(0,255,179,0.15)] border border-neon/30 text-neon px-4 py-2.5 rounded-xl font-bold text-xs transition-all"
                >
                  WhatsApp
                </a>
              )}
              <button
                onClick={() => markRead(selected.id, !selected.is_read)}
                className="bg-white/5 hover:bg-white/10 border border-white/10 text-white px-4 py-2.5 rounded-xl font-semibold text-xs transition-all"
              >
                {selected.is_read ? 'Marcar no leído' : 'Marcar leído'}
              </button>
              <button
                onClick={() => del(selected.id)}
                className="ml-auto bg-rojo/10 hover:bg-rojo/20 border border-rojo/30 text-rojo px-4 py-2.5 rounded-xl font-bold text-xs transition-all"
              >
                Eliminar
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-[#050e0a] border border-white/10 rounded-2xl p-8 text-center hidden md:block">
            <EmptyState emoji="✉️" texto="Selecciona un mensaje de la lista para leer su contenido." />
          </div>
        )}
      </div>
    </div>
  );
}
