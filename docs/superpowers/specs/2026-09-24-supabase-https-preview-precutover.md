# Supabase HTTPS and Preview precutover specification

## Objective

Expose the isolated self-hosted Supabase through a dedicated trusted HTTPS hostname, connect only a branch-scoped Vercel Preview, validate the application safely end to end, and stop before production cutover.

## Binding constraints

- The managed Supabase origin remains read-only and intact.
- Do not change Vercel Production variables, the production deployment, the apex domain, `www`, mail DNS, external production webhooks, Meta CAPI, messaging, or payment endpoints.
- The only authorized DNS mutation is an explicit record for `supabase.lamanitodelvegano.cl` pointing at `31.220.99.191`.
- Public listeners may be SSH, HTTP, and HTTPS only. PostgreSQL, Supavisor, Studio, Envoy, and Docker-internal services remain private.
- The Platform S3 migration key must be revoked and local temporary copies removed before infrastructure changes.
- Keep self-hosted Supabase pinned to `self-hosted/v0.8.1`, PostgreSQL 17, Envoy, and no Logs/Analytics.
- Never print or commit secrets or private object paths.
- Missing Storage objects must fail safely and must not block commercial flows when no critical object is missing.
- Do not execute real payments, real CAPI, outbound WhatsApp, outbound Instagram, or production cron jobs.
- Keep rollback possible at every stage and stop before the final data delta or production cutover.

## Required outcomes

1. Revoke the temporary Platform S3 credential and remove known local copies without exposing values.
2. Preserve the existing DNS zone while adding only `supabase.lamanitodelvegano.cl` for the VPS.
3. Serve only the public Supabase API families through Caddy with trusted TLS; keep internal services private.
4. Set self-hosted public/Auth URLs to the HTTPS hostname and apply the reversible legacy public-Storage URL rewrite only on the destination.
5. Create branch-scoped Vercel Preview variables and deploy a Preview without altering any Production-scoped value.
6. Validate storefront, Auth, admin, orders, stock, CRM, Wonka, Storage, and safe integration behavior against the real Preview.
7. Maintain daily encrypted backups, create a second offline escrow of the backup key, and prove restore documentation remains valid.
8. Remove global `NOPASSWD` from `supabaseops` only after proving a second SSH session and a durable sudo mechanism.
9. Produce an evidence-based delta/cutover/rollback report and stop before cutover.
