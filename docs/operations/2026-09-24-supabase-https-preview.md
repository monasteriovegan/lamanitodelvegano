# HTTPS endpoint and Preview gate — 2026-09-24

## Active endpoint

The API hostname is `supabase.lamanitodelvegano.cl`. Vercel DNS now contains the single explicit record `supabase A 31.220.99.191` (record ID `rec_e1582f9f72a3812d3bd4dba4`), which overrides the existing wildcard only for that hostname. The apex, `www`, MX, SPF, DKIM, DMARC, and every other explicit record were left unchanged.

Caddy is active from `/opt/supabase-lamanito/reverse-proxy/active`. It obtained a Let's Encrypt certificate for the exact hostname, valid from 2026-09-24 through 2026-12-23, and redirects HTTP to HTTPS. Envoy remains bound only to `127.0.0.1:8000`.

## Security boundary

The proxy allowlists only the Supabase public API families:

- Auth
- REST
- GraphQL
- Realtime
- Storage
- Edge Functions
- the OAuth authorization-server discovery path

Every other path receives `404`. Studio, PostgreSQL, Supavisor, Envoy's administration interface, and internal services are not routed. In particular, the site root is not proxied to Studio. Request bodies are capped at 16 MiB at the public edge; the `productos` bucket retains its stricter 12 MiB database-level limit and MIME allowlist.

The Compose file pins `caddy:2.11.4-alpine`, uses host networking only so Caddy can reach loopback-bound Envoy, drops all capabilities except binding privileged ports, runs read-only, and persists only certificate state.

## Verified behavior

- Authoritative DNS, Cloudflare, and Google resolve the hostname to `31.220.99.191` with TTL 60.
- HTTP returns `308` to the same HTTPS hostname.
- TLS verification succeeds and the certificate subject is the exact hostname.
- Auth health returns `200` with the self-hosted anonymous key.
- REST can read one `productos` row under its existing RLS and returns `200`.
- Storage health and JWKS return `200`.
- Realtime reaches Envoy and rejects a keyless handshake with `401`, confirming routing without granting access.
- `/`, `/studio`, and every non-allowlisted route return `404`; Studio is not exposed.
- External TCP checks reach only 22, 80, and 443. Ports 3000, 5432, 6543, and 8000 are unreachable externally.
- All 11 Supabase containers remain healthy; `lmv-caddy` is running.
- UFW remains deny-by-default and now permits only SSH, HTTP, and HTTPS for IPv4/IPv6.

## Rollback

1. Stop only the gateway: `cd /opt/supabase-lamanito/reverse-proxy/active && sudo docker compose down`.
2. Remove only `rec_e1582f9f72a3812d3bd4dba4`: `vercel dns remove rec_e1582f9f72a3812d3bd4dba4`.
3. Remove only the named UFW rules for TCP 80 and 443; retain TCP 22.
4. Revert only branch-scoped Preview variables/deployment if already created.

Envoy remains loopback-only throughout. Removing the public gateway does not require a database rollback.

## Vercel Preview activated

The isolated branch `staging/supabase-self-hosted` deploys only to Vercel Preview. Its stable alias is `https://lmv-selfhost-preview.vercel.app`; deployment `dpl_F9ABHiLqAuAZvoDvzvG9uJ9M9KAT` was `Ready` when verified. Nine environment variables are scoped to the `preview` target and this exact Git branch. They point to the self-hosted API and enable `LMV_PREVIEW_SAFE_MODE`; no Production variable was changed.

Self-hosted Auth now uses the stable Preview alias as `SITE_URL` and includes it in the redirect allow-list. Google OAuth remains disabled because no valid existing configuration was available, so no callback was invented or changed.

Vercel Authentication remains enabled for the Preview. Automated checks used the authenticated `vercel curl` path; the protection was not disabled.

The full Preview smoke passed with temporary, cleaned-up resources: three public pages, nine authenticated admin pages, login/refresh/logout, catalog and availability reads, a checkout validation dry-run with zero order writes, both payment providers blocked by Preview safe mode, a signed private object, and the administrative signed-upload route.
