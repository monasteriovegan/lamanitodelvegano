# Self-hosted Preview validation — 2026-09-24

## Outcome

The application passed a production build and an internal end-to-end smoke test against the isolated self-hosted Supabase through an SSH loopback tunnel. A Vercel Preview deployment was not created because the backend has no trusted public HTTPS endpoint while DNS changes are prohibited.

No Vercel variable, Production variable, alias, domain, or deployment was changed.

## Vercel read-only inventory

The linked project is `lamanitodelvegano` under the `monasteriovegan` account. Vercel CLI 54.9.1 was authenticated. The Preview scope currently contains encrypted entries including:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SITE_URL`
- Meta/WhatsApp settings
- Mercado Pago, Gemini, cron, and gateway settings

Several of those entries are shared between Preview and Production. Values were not read or printed. They were deliberately left untouched; replacing a shared entry would risk Production and pointing Preview at HTTP/loopback would create a broken deployment.

## Auth posture

Email/password login was enabled in the isolated Auth service so the application's real admin login can work. Public registration remains disabled (`DISABLE_SIGNUP=true`), anonymous users remain disabled, and Google/OAuth providers remain disabled. This change affected only the isolated self-hosted stack.

The smoke test created a random temporary Auth user in the destination, granted it a temporary `admin_roles` row, signed in through the Auth API, built an SSR cookie session, and loaded `/admin/productos` with HTTP 200. Cleanup returned the destination to exactly 2 Auth users and 2 admin-role rows.

## Functional checks

- Public home: HTTP 200.
- Public product detail: HTTP 200.
- Anonymous admin access: redirected to `/admin/login`.
- Authenticated admin product page: HTTP 200.
- Catalog read under anonymous RLS: 14 products.
- Product read: succeeded.
- Order read with server credential: 67 orders; contents were not printed.
- Auth admin login and `admin_roles` relationship: succeeded.
- Admin signed-upload route: succeeded for an allowed image descriptor.
- Private Storage signed URL: a temporary PNG was uploaded to `wonka-attachments`, downloaded byte-for-byte through a 60-second signed URL, and removed.
- Temporary Storage objects remaining: 0.
- Production build: succeeded with Next.js 16.2.9 against the isolated backend.
- TypeScript: clean.
- Node test suite: 494 passed, 0 failed.

No checkout purchase, stock mutation, payment request, webhook, Meta CAPI event, WhatsApp outbound message, Instagram outbound message, cron job, or real order mutation was executed.

## Preview deployment blocker

Vercel cannot reach `127.0.0.1:8000`, and exposing plain HTTP would violate the migration security requirements. The next valid gate is:

1. approve and configure `supabase.lamanitodelvegano.cl` DNS;
2. activate the validated Caddy proxy and only TCP 80/443;
3. verify trusted TLS and Studio denial;
4. create branch-scoped Preview variables, using newly generated self-hosted keys and keeping Production entries unchanged;
5. deploy Preview and repeat the same smoke checks over HTTPS.

Until those steps are approved, Preview status is `BLOCKED_SAFE`: locally validated, not publicly deployed.
