# Admin Web Push / Wonka Hub — Implementation Plan

## Goal

Implement real standards-based Web Push for the authenticated administrative PWA (Wonka Hub) without rebuilding checkout, Mercado Pago, Meta Purchase tracking, CRM, catalog, Remy, Instagram or WhatsApp.

Target paid-order flow:

`Mercado Pago verified paid transition -> order persisted -> existing Purchase/CAPI preserved -> notifyOrderPaid(order) -> idempotent Web Push delivery -> Android notification -> /admin/pedidos/<id>`

Push failure must never fail or roll back the payment webhook.

## Existing foundations to preserve

- Next.js 16 / React 19 app router.
- Supabase authentication and `admin_roles`.
- Existing admin-only manifest at `/admin/manifest.webmanifest` with `/admin` start URL/scope.
- Existing order details route `/admin/pedidos/[id]`.
- Existing Mercado Pago webhook validation, amount/currency validation and compare-and-set paid transition.
- Existing customer order notifications.
- Existing Meta Purchase/CAPI path and deduplication.

## Confirmed gaps

1. No Web Push/VAPID sender exists.
2. No persisted administrative push subscriptions or delivery-idempotency log exists.
3. Legacy root `/wonka-sw.js` can control the public origin and caches authenticated admin HTML; it also references the removed root manifest.
4. No admin UI exists to explicitly request notification permission, subscribe this device, disable it, or send a fixed test notification.
5. Current admin role helper can fail open on a role-query error; Push APIs must fail closed.
6. No reusable `notifyOrderPaid(order)` administrative notification layer exists.

## Task 1 — Security and PWA contracts (TDD)

Create contract tests first for:
- Public app must not publish an administrative manifest.
- Admin layout references only `/admin/manifest.webmanifest`.
- Admin manifest start URL and scope remain `/admin`.
- Root legacy worker is retirement-only: no fetch caching, deletes legacy caches, unregisters itself.
- New admin worker is served under `/admin/` and handles `push` + `notificationclick` without caching authenticated HTML.
- Push APIs use a strict authenticated admin guard.

## Task 2 — Database schema (TDD + migration)

Create `admin_push_subscriptions` and `admin_notification_deliveries` following existing DB conventions.

Subscriptions:
- id UUID
- user_id auth user UUID
- endpoint unique
- p256dh/auth keys
- optional device_name/user_agent
- enabled
- timestamps + last_success_at/last_failure_at/last_failure_reason

Deliveries:
- id UUID
- event_type (`order_paid`, `test`)
- order_id nullable for test
- user_id
- subscription_id
- status/attempt_count/sent_at/error/timestamps
- unique idempotency key for `order_paid + order_id + subscription_id`

Enable RLS and do not expose direct anon/authenticated table CRUD; normal access is through authenticated server routes using service role after strict admin validation.

## Task 3 — Standards Web Push sender

Implement server-only VAPID/Web Push using Node crypto primitives so no unnecessary external provider is introduced.

Environment:
- `WEB_PUSH_VAPID_PUBLIC_KEY`
- `WEB_PUSH_VAPID_PRIVATE_KEY`
- `WEB_PUSH_VAPID_SUBJECT`

The private key remains server-only. Add pure tests for VAPID formatting, payload encryption framing and safe notification payload construction.

## Task 4 — Admin Push API

Add authenticated admin endpoints for:
- status/public VAPID key
- subscribe current device
- disable current device subscription
- fixed server-controlled test push

Requirements:
- strict role check on server
- validate PushSubscription shape and endpoint HTTPS
- never accept arbitrary notification title/body/URL from client
- never list other users' subscriptions
- expired provider responses (404/410) disable subscription

## Task 5 — Admin UI and service worker

Add an admin-only client component rendered from the authenticated admin layout:
- status: activated/deactivated/unsupported/blocked
- `🔔 Activar notificaciones`
- explicit permission request only after click
- subscribe via `PushManager.subscribe()` with the server-returned VAPID public key
- save subscription through authenticated API
- `Enviar notificación de prueba`
- optional `Desactivar en este dispositivo`

Register only `/admin/wonka-sw.js` with scope `/admin/`.

Admin worker:
- `push` -> `showNotification`
- `notificationclick` -> focus matching admin client or open same-origin `/admin/...`
- no sensitive data beyond server payload
- no admin HTML caching

## Task 6 — Reusable notification service

Create a server-only notification layer such as `src/lib/notifications/order-paid.ts` / `web-push.ts`.

`notifyOrderPaid(db, order)`:
- reads enabled admin subscriptions
- creates/reserves per-subscription delivery idempotently
- sends minimal notification
- marks delivery sent/failed
- disables endpoint on 404/410
- never exposes PII in lock-screen payload

## Task 7 — Mercado Pago integration

Modify only the existing paid-transition winner path.

After successful compare-and-set and canonical order reload:
- keep existing customer `notifyOrderTransitions`
- if transition winner is `paid`, invoke `notifyOrderPaid(db, afterOrder)` in its own try/catch
- keep existing Meta `sendPaidPurchaseToMeta` behavior unchanged

Repeated webhook deliveries must not create duplicate Web Push deliveries.

## Task 8 — Verification

Run:
1. `npm test`
2. TypeScript
3. worker syntax check
4. lint
5. production build
6. Supabase migration + security advisor
7. production deploy
8. public page: no admin manifest/install registration
9. unauthenticated push API denied
10. authenticated admin subscription persists
11. fixed test push dispatch succeeds
12. duplicate `order_paid` delivery reservation is a no-op
13. simulated provider failure does not affect order/payment handling
14. production Mercado Pago/Meta code remains intact

Physical Android verification remains explicit: do not claim background/closed-app delivery until the subscribed Android device visibly receives the test notification and the user confirms it.