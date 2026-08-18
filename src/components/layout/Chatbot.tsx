'use client';

import { useState, useEffect, useRef } from 'react';
import { useCart } from '@/lib/cart/CartContext';

interface Message {
  role: 'user' | 'model';
  parts: { text: string }[];
}

function getOrCreateWebSession() {
  const key = 'remy_web_session';
  const current = window.localStorage.getItem(key);
  if (current && /^[a-zA-Z0-9_-]{8,100}$/.test(current)) return current;
  const created = `web_${crypto.randomUUID()}`;
  window.localStorage.setItem(key, created);
  return created;
}

export function Chatbot() {
  const { items: cartItems, replaceCart } = useCart();
  const [isOpen, setIsOpen] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'model',
      parts: [{ text: '¡Hola! Soy el Chef Remy 🦍🌱. ¿Te puedo ayudar a elegir algo rico de nuestro taller hoy o tienes alguna duda?' }]
    }
  ]);
  const [inputVal, setInputVal] = useState('');
  const [loading, setLoading] = useState(false);
  const chatBodyRef = useRef<HTMLDivElement>(null);
  const sessionIdRef = useRef('');

  useEffect(() => {
    sessionIdRef.current = getOrCreateWebSession();
    const timer = setTimeout(() => {
      setIsOpen(prev => {
        if (!prev) setShowTooltip(true);
        return prev;
      });
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (chatBodyRef.current) {
      chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const toggleChat = () => {
    setIsOpen(!isOpen);
    setShowTooltip(false);
  };

  const handleSend = async (forceMsg?: string) => {
    const text = (forceMsg || inputVal).trim();
    if (!text) return;

    if (!forceMsg) setInputVal('');
    setLoading(true);

    const userMessage: Message = { role: 'user', parts: [{ text }] };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);

    try {
      const sessionId = sessionIdRef.current || getOrCreateWebSession();
      sessionIdRef.current = sessionId;
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // El backend mantiene CRM, carrito conversacional y contexto. En web
        // sincronizamos además el carrito visual para que Remy lo manipule de verdad.
        body: JSON.stringify({ history: newMessages.slice(-6), sessionId, cartItems })
      });

      const data = await response.json();
      if (!response.ok && !data?.respuesta) throw new Error('chat_unavailable');
      if (data?.sessionId && /^[a-zA-Z0-9_-]{8,100}$/.test(data.sessionId)) {
        sessionIdRef.current = data.sessionId;
        window.localStorage.setItem('remy_web_session', data.sessionId);
      }
      if (Array.isArray(data?.cartItems)) replaceCart(data.cartItems);

      setMessages(prev => [
        ...prev,
        { role: 'model', parts: [{ text: data.respuesta || 'Ahora mismo no pude responder.' }] }
      ]);
    } catch (err) {
      console.error(err);
      setMessages(prev => [
        ...prev,
        { role: 'model', parts: [{ text: 'Ahora mismo no pude responder. Escríbenos por WhatsApp y te ayudamos enseguida.' }] }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Botón flotante de WhatsApp */}
      <a
        href="https://wa.me/56990816124"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 left-6 z-[400] bg-wa hover:bg-[#1da851] text-white w-12 h-12 rounded-full flex items-center justify-center shadow-[0_4px_16px_rgba(37,211,102,0.4)] transition-all hover:scale-105"
        aria-label="Contactar por WhatsApp"
      >
        <svg className="w-6 h-6 fill-white" viewBox="0 0 24 24">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"></path>
          <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.118 1.528 5.849L0 24l6.335-1.508C8.05 23.443 9.982 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.881 0-3.63-.498-5.145-1.367l-.368-.213-3.762.896.952-3.653-.24-.384A9.952 9.952 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"></path>
        </svg>
      </a>

      {showTooltip && (
        <div
          onClick={toggleChat}
          className="fixed bottom-8 right-24 z-[850] bg-[#0d1e16] text-neon border border-[rgba(0,255,179,0.3)] px-4 py-2.5 rounded-xl text-xs font-medium shadow-[0_4px_15px_rgba(0,255,179,0.15)] flex items-center gap-2 cursor-pointer transition-all hover:scale-102"
        >
          <span>¡Hola! ¿Te ayudo a elegir algo rico? 🌿</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowTooltip(false);
            }}
            className="text-white opacity-60 hover:opacity-100 text-sm ml-1"
          >
            ×
          </button>
        </div>
      )}

      <button
        onClick={toggleChat}
        className="fixed bottom-6 right-6 w-12 h-12 md:w-[60px] md:h-[60px] bg-v3 hover:bg-v2 text-white rounded-full flex items-center justify-center shadow-[0_8px_24px_rgba(64,145,108,0.3)] cursor-pointer z-[900] border-2 border-neon overflow-hidden p-0 transition-transform hover:scale-110 active:scale-95"
        style={{ boxShadow: '0 0 15px rgba(0, 255, 179, 0.25)' }}
      >
        <img
          src="/remy.jpg"
          alt="Chef Remy"
          className="w-full h-full object-cover rounded-full"
          onError={(e) => {
            (e.target as HTMLElement).style.display = 'none';
            (e.target as HTMLElement).parentElement!.innerHTML = '💬';
          }}
        />
      </button>

      {isOpen && (
        <div
          className="fixed bottom-24 right-6 w-[340px] h-[480px] bg-[#030907]/95 border border-[rgba(0,255,179,0.25)] rounded-2xl shadow-[0_12px_40px_rgba(0,255,179,0.15)] z-[900] flex flex-col overflow-hidden backdrop-blur-md"
          style={{ animation: 'fadeInScale 0.25s cubic-bezier(0.165, 0.84, 0.44, 1)' }}
        >
          <div className="bg-[#0d1e16]/90 border-b border-[rgba(0,255,179,0.2)] p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[rgba(0,255,179,0.1)] border border-[rgba(0,255,179,0.3)] flex items-center justify-center overflow-hidden">
              <img src="/remy.jpg" alt="Chef Remy" className="w-full h-full object-cover" />
            </div>
            <div>
              <div className="font-serif font-bold text-sm text-white">Chef Remy 🦍🌱</div>
              <div className="text-[10px] text-[rgba(255,255,255,0.7)] flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-[#4ADE80] rounded-full animate-pulse"></span> En línea
              </div>
            </div>
            <button onClick={toggleChat} className="ml-auto text-white opacity-85 hover:opacity-100 text-2xl">×</button>
          </div>

          <div ref={chatBodyRef} className="flex-1 p-4 overflow-y-auto flex flex-col gap-3 bg-[#030907]">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${m.role === 'model' ? 'bg-[rgba(0,255,179,0.08)] text-texto border border-[rgba(0,255,179,0.15)] rounded-bl-sm align-self-start' : 'bg-neon text-[#020705] font-semibold rounded-br-sm align-self-end'}`}
                style={{ alignSelf: m.role === 'model' ? 'flex-start' : 'flex-end' }}
              >
                {m.parts[0].text}
              </div>
            ))}
            {loading && (
              <div className="max-w-[85%] px-4 py-2.5 rounded-2xl text-sm bg-[rgba(0,255,179,0.08)] text-texto border border-[rgba(0,255,179,0.15)] rounded-bl-sm align-self-start flex gap-1 items-center">
                <span className="w-1.5 h-1.5 bg-muted rounded-full animate-bounce"></span>
                <span className="w-1.5 h-1.5 bg-muted rounded-full animate-bounce delay-100"></span>
                <span className="w-1.5 h-1.5 bg-muted rounded-full animate-bounce delay-200"></span>
              </div>
            )}
          </div>

          <div className="p-4 bg-[#0d1e16]/90 border-t border-[rgba(0,255,179,0.2)] flex gap-2 items-center">
            <input
              type="text"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Escribe tu mensaje..."
              disabled={loading}
              className="flex-1 bg-[#030907] text-white border border-[rgba(0,255,179,0.3)] rounded-full px-4 py-2 text-sm outline-none transition-all focus:border-neon focus:shadow-[0_0_8px_rgba(0,255,179,0.3)]"
            />
            <button
              onClick={() => handleSend()}
              disabled={loading || !inputVal.trim()}
              className="w-9 h-9 rounded-full bg-neon disabled:bg-white/10 disabled:text-white/30 text-[#020705] flex items-center justify-center cursor-pointer transition-all hover:bg-white flex-shrink-0"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"></path>
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
