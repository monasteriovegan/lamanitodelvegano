export const dynamic = 'force-dynamic';

const WORKER_SOURCE = `
function safeAdminPath(value) {
  try {
    const raw = typeof value === 'string' ? value : '/admin';
    const target = new URL(raw, self.location.origin);
    if (target.origin !== self.location.origin) return '/admin';
    if (target.pathname !== '/admin' && !target.pathname.startsWith('/admin/')) return '/admin';
    return target.pathname + target.search + target.hash;
  } catch (_) {
    return '/admin';
  }
}

self.addEventListener('install', function () {
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', function (event) {
  var payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (_) {
    payload = {};
  }
  var title = typeof payload.title === 'string' && payload.title ? payload.title : 'Wonka Hub';
  var body = typeof payload.body === 'string' ? payload.body : 'Tienes una nueva notificación administrativa.';
  var url = safeAdminPath(payload.url);
  var tag = typeof payload.tag === 'string' && payload.tag ? payload.tag : 'wonka-admin';
  event.waitUntil(self.registration.showNotification(title, {
    body: body,
    icon: '/api/wonka-icon/192',
    badge: '/api/wonka-icon/192',
    tag: tag,
    renotify: false,
    data: { url: url }
  }));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var path = safeAdminPath(event.notification && event.notification.data && event.notification.data.url);
  var targetUrl = new URL(path, self.location.origin).href;
  event.waitUntil((async function () {
    var windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (var i = 0; i < windows.length; i += 1) {
      var client = windows[i];
      try {
        var parsed = new URL(client.url);
        if (parsed.origin === self.location.origin && (parsed.pathname === '/admin' || parsed.pathname.startsWith('/admin/'))) {
          if ('navigate' in client) await client.navigate(targetUrl);
          await client.focus();
          return;
        }
      } catch (_) {}
    }
    if (self.clients.openWindow) await self.clients.openWindow(targetUrl);
  })());
});
`;

export async function GET() {
  return new Response(WORKER_SOURCE, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'no-store, max-age=0',
      'Service-Worker-Allowed': '/admin/',
    },
  });
}
