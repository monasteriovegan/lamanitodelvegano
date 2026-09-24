# Pending HTTPS endpoint and Preview gate — 2026-09-24

## Current decision

The intended API hostname is `supabase.lamanitodelvegano.cl`. The Caddy configuration is prepared and syntax-validated, but is deliberately not running. DNS was not changed, ports 80/443 were not opened, and Envoy remains bound only to `127.0.0.1:8000`.

A publicly trusted certificate cannot be issued until the hostname points to the VPS and ports 80/443 reach Caddy. That activation requires explicit approval. Caddy's official documentation confirms both requirements for automatic public HTTPS.

## Security boundary

The pending proxy allowlists only the Supabase public API families:

- Auth
- REST
- GraphQL
- Realtime
- Storage
- Edge Functions
- the OAuth authorization-server discovery path

Every other path receives `404`. Studio, PostgreSQL, Supavisor, Envoy's administration interface, and internal services are not routed. In particular, the site root is not proxied to Studio. Request bodies are capped at 16 MiB at the public edge; the `productos` bucket retains its stricter 12 MiB database-level limit and MIME allowlist.

The pending Compose file pins `caddy:2.11.4-alpine`, uses host networking only so Caddy can reach loopback-bound Envoy, drops all capabilities except binding privileged ports, runs read-only, and persists only certificate state.

## Explicit activation sequence — not executed

1. Approve the hostname and create the required DNS record(s).
2. Confirm the record resolves only to the intended VPS. Add IPv6 only if its firewall path has been tested.
3. Copy `ops/self-hosted/caddy/` to `/opt/supabase-lamanito/reverse-proxy/active/`.
4. Open only TCP 80 and 443 in UFW; keep 5432, 6543, 8000, and Studio closed.
5. Start Caddy and verify a publicly trusted certificate, HSTS, API health, WebSocket upgrade, upload limits, and that `/` and Studio routes return `404`.
6. Only after those checks, configure Vercel Preview variables to the HTTPS hostname and newly generated self-hosted API keys.

## Rollback

Stop Caddy, remove only the UFW rules for 80/443, and revert the Preview-only variables/deployment. Envoy remains loopback-only throughout. No database rollback is required because activating or removing the proxy does not mutate PostgreSQL.

## Current blocker

Vercel Preview is intentionally blocked: the backend has no trusted public HTTPS endpoint while DNS changes are prohibited. Creating Preview variables now would produce a broken or insecure deployment, so no Vercel environment was changed.
