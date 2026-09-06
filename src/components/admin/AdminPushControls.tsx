'use client';

import { useEffect, useState } from 'react';

type PushState = 'checking' | 'unsupported' | 'blocked' | 'inactive' | 'active' | 'working' | 'error';

function urlBase64ToArrayBuffer(value: string): ArrayBuffer {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const decoded = atob(base64);
  const bytes = new Uint8Array(decoded.length);
  for (let i = 0; i < decoded.length; i += 1) bytes[i] = decoded.charCodeAt(i);
  return bytes.buffer;
}

async function registerAdminWorker() {
  return navigator.serviceWorker.register('/admin/wonka-sw.js', { scope: '/admin/' });
}

async function retireLegacyRootWorker() {
  const registrations = await navigator.serviceWorker.getRegistrations();
  const rootScope = `${window.location.origin}/`;
  for (const registration of registrations) {
    const script = registration.active?.scriptURL || registration.waiting?.scriptURL || registration.installing?.scriptURL || '';
    if (registration.scope === rootScope && script.endsWith('/wonka-sw.js')) {
      await registration.update().catch(() => undefined);
    }
  }
}

export function AdminPushControls() {
  const [state, setState] = useState<PushState>('checking');
  const [message, setMessage] = useState('Revisando este dispositivo…');

  const refresh = async (registration?: ServiceWorkerRegistration) => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      setState('unsupported');
      setMessage('Este navegador no soporta Web Push.');
      return;
    }
    if (Notification.permission === 'denied') {
      setState('blocked');
      setMessage('Notificaciones bloqueadas en el navegador.');
      return;
    }
    const reg = registration || await navigator.serviceWorker.getRegistration('/admin/');
    const subscription = reg ? await reg.pushManager.getSubscription() : null;
    if (Notification.permission === 'granted' && subscription) {
      setState('active');
      setMessage('Notificaciones activadas en este dispositivo.');
    } else {
      setState('inactive');
      setMessage('Notificaciones desactivadas en este dispositivo.');
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
        if (!cancelled) {
          setState('unsupported');
          setMessage('Este navegador no soporta Web Push.');
        }
        return;
      }
      try {
        await retireLegacyRootWorker();
        const registration = await registerAdminWorker();
        if (!cancelled) await refresh(registration);
      } catch {
        if (!cancelled) {
          setState('error');
          setMessage('No se pudo inicializar el servicio de notificaciones.');
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const activate = async () => {
    try {
      setState('working');
      setMessage('Activando notificaciones…');
      const statusResponse = await fetch('/api/admin/push/status', { cache: 'no-store' });
      if (!statusResponse.ok) throw new Error('No autorizado para activar notificaciones.');
      const status = await statusResponse.json();
      if (!status?.configured || !status?.publicKey) throw new Error('Web Push todavía no está configurado en el servidor.');

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        await refresh();
        return;
      }

      const registration = await registerAdminWorker();
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToArrayBuffer(String(status.publicKey)),
        });
      }

      const save = await fetch('/api/admin/push/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: subscription.toJSON(),
          deviceName: navigator.platform || 'Android / navegador',
        }),
      });
      if (!save.ok) throw new Error('No se pudo guardar la suscripción del dispositivo.');
      setState('active');
      setMessage('Notificaciones activadas en este dispositivo.');
    } catch (error) {
      setState('error');
      setMessage(error instanceof Error ? error.message : 'No se pudieron activar las notificaciones.');
    }
  };

  const sendTest = async () => {
    try {
      setState('working');
      setMessage('Enviando notificación de prueba…');
      const registration = await registerAdminWorker();
      const subscription = await registration.pushManager.getSubscription();
      if (!subscription) throw new Error('Primero activa las notificaciones en este dispositivo.');
      const response = await fetch('/api/admin/push/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error || 'No se pudo enviar la prueba.');
      setState('active');
      setMessage('Prueba enviada. Revisa la barra de notificaciones de Android.');
    } catch (error) {
      setState('error');
      setMessage(error instanceof Error ? error.message : 'Falló la notificación de prueba.');
    }
  };

  const disable = async () => {
    try {
      setState('working');
      setMessage('Desactivando este dispositivo…');
      const registration = await navigator.serviceWorker.getRegistration('/admin/');
      const subscription = registration ? await registration.pushManager.getSubscription() : null;
      if (subscription) {
        const response = await fetch('/api/admin/push/subscriptions', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        if (!response.ok) throw new Error('No se pudo desactivar la suscripción en el servidor.');
        await subscription.unsubscribe();
      }
      setState('inactive');
      setMessage('Notificaciones desactivadas en este dispositivo.');
    } catch (error) {
      setState('error');
      setMessage(error instanceof Error ? error.message : 'No se pudo desactivar este dispositivo.');
    }
  };

  const active = state === 'active';
  const busy = state === 'working' || state === 'checking';

  return (
    <section className="mb-4 rounded-2xl border border-white/10 bg-white/[0.035] p-4" aria-label="Notificaciones de Wonka Hub">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-bold text-white">🔔 Wonka Hub · Notificaciones</p>
          <p className="mt-1 text-xs text-white/60" aria-live="polite">{message}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!active && state !== 'unsupported' && state !== 'blocked' ? (
            <button type="button" disabled={busy} onClick={activate} className="rounded-full bg-neon px-4 py-2 text-xs font-bold text-[#020705] disabled:opacity-50">
              🔔 Activar notificaciones
            </button>
          ) : null}
          {active ? (
            <>
              <button type="button" disabled={busy} onClick={sendTest} className="rounded-full border border-neon/50 px-4 py-2 text-xs font-bold text-neon disabled:opacity-50">
                Enviar notificación de prueba
              </button>
              <button type="button" disabled={busy} onClick={disable} className="rounded-full border border-white/15 px-4 py-2 text-xs font-semibold text-white/70 disabled:opacity-50">
                Desactivar en este dispositivo
              </button>
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
}
