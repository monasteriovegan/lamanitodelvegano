# Supabase HTTPS and Preview Precutover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish the isolated self-hosted Supabase securely, validate a branch-only Vercel Preview, and leave a reversible cutover package without touching production.

**Architecture:** Vercel DNS receives one explicit `A` record that overrides its wildcard for the backend hostname. A hardened Caddy container terminates TLS on 80/443 and proxies an allowlist of Supabase API paths to loopback Envoy. Vercel Preview receives branch-specific credentials from secure sources, while Production records remain unchanged.

**Tech Stack:** Supabase self-hosted v0.8.1, PostgreSQL 17, Envoy, Caddy 2.11.4, Docker Compose, UFW, Vercel CLI 54.9.1, Next.js 16, TypeScript, Node test runner.

**Spec:** `docs/superpowers/specs/2026-09-24-supabase-https-preview-precutover.md`

## Global Constraints

- Managed Supabase stays read-only and Vercel Production remains untouched.
- Add only `supabase.lamanitodelvegano.cl -> 31.220.99.191`; do not alter apex, `www`, MX, SPF, DKIM, DMARC, or other subdomains.
- Public ports are limited to 22, 80, and 443; never publish 5432, 6543, 8000, Studio, or internal Docker services.
- Use only new self-hosted Supabase keys; never copy Platform JWT/API keys.
- Never print, log, or commit secrets.
- Disable outbound messaging, CAPI, real payments, production webhooks, and Preview cron side effects.
- Keep every database and infrastructure mutation reversible.
- Stop before final delta and production cutover.

## Review Focus

- A wildcard Vercel DNS answer must be replaced only for the exact backend hostname, without disturbing the web or email zone.
- Caddy must expose API paths while returning 404 for Studio/root and preserving Realtime WebSocket upgrades.
- Branch-specific Preview variables must override shared Preview values without mutating the same records used by Production.
- Legacy URL rewrite must update only recoverable public Storage URLs and preserve signed or missing-object references for safe regeneration/fallback.
- Removing `NOPASSWD` must not strand the sole administrator; SSH and sudo must be proven from a second session first.

---

### Task 1: Credential gate and immutable baselines

**Files:**
- Modify: `docs/operations/2026-09-24-supabase-secret-readiness.md`
- Create outside Git: `work/precutover/private/baseline/`

**Interfaces:**
- Produces: provider-side revocation confirmation, cleared clipboard/config checks, DNS/VPS/Vercel names-only baselines.

- [ ] Record the user's provider-side S3-key revocation confirmation without values.
- [ ] Clear the current clipboard and verify no standard `rclone.conf` or repository credential file remains.
- [ ] Export names-only DNS, Vercel scope, Compose health, UFW, listeners, resource, database-count, and Storage-count evidence outside Git.
- [ ] Commit only the redacted readiness note.

### Task 2: Exact DNS record and trusted HTTPS gateway

**Files:**
- Modify: `docs/operations/2026-09-24-supabase-https-preview.md`
- Deploy from: `ops/self-hosted/caddy/Caddyfile`
- Deploy from: `ops/self-hosted/caddy/docker-compose.caddy.pending.yml`

**Interfaces:**
- Consumes: Task 1 DNS baseline and inactive validated Caddy config.
- Produces: explicit `A` record, active TLS gateway, and external endpoint evidence.

- [ ] Snapshot the zone, assert that no explicit `supabase` record exists, and add exactly one `A` record to `31.220.99.191`.
- [ ] Verify authoritative and public DNS answers and compare unchanged apex, `www`, MX, and TXT record hashes.
- [ ] Copy the reviewed Caddy bundle to an active root-owned directory, open only UFW 80/443, and start Caddy.
- [ ] Verify a trusted certificate, HTTP-to-HTTPS redirect, Auth health, REST, Storage, JWKS, Realtime upgrade behavior, root/Studio denial, and public listeners.
- [ ] Document rollback using the exact DNS record ID, Caddy Compose command, and UFW rules; commit.

### Task 3: Self-hosted public/Auth URLs and reversible legacy rewrite

**Files:**
- Modify on VPS: `/opt/supabase-lamanito/stack/.env`
- Apply destination-only migration: `supabase/migrations/20260924145426_prepare_legacy_supabase_url_rewrite.sql`
- Modify: `docs/operations/2026-09-24-supabase-url-readiness.md`

**Interfaces:**
- Consumes: Task 2 HTTPS origin.
- Produces: destination services advertising the final backend origin and a backed-up, reversible rewrite result.

- [ ] Back up the protected self-hosted `.env`, then set `SUPABASE_PUBLIC_URL=https://supabase.lamanitodelvegano.cl` and `API_EXTERNAL_URL=https://supabase.lamanitodelvegano.cl/auth/v1` without printing values.
- [ ] Keep `SITE_URL` on the temporary internal test value until the exact Preview URL exists; keep Google OAuth disabled unless verified as used.
- [ ] Recreate only affected containers and verify 11/11 health plus external endpoints.
- [ ] Count all old-host references by table/field and classify public, signed, and missing-object references.
- [ ] Install and execute the prepared rewrite on the destination only; verify backup rows, changed rows, reversibility in a rolled-back drill, no broken missing-object URLs, and no origin mutation.
- [ ] Regenerate signed URLs only during access tests; never persist copied signatures. Commit redacted results.

### Task 4: Branch-scoped Vercel Preview configuration and deployment

**Files:**
- Modify: `docs/operations/2026-09-24-supabase-preview-validation.md`
- Verify: `src/lib/supabase/server.ts`
- Verify: `test/supabase-env-fail-closed.test.ts`

**Interfaces:**
- Consumes: Task 3 HTTPS endpoint, self-hosted public key, self-hosted server key, and safe integration modes.
- Produces: exact Preview URL and branch-specific Preview configuration.

- [ ] Create branch-specific overrides for `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` by streaming secure VPS values directly to Vercel CLI stdin.
- [ ] Add branch-specific `META_SEND_MODE=disabled`, `META_WHATSAPP_SEND_MODE=disabled`, and side-effect-safe settings without changing shared or Production records.
- [ ] Reuse external secrets only when already stored securely and necessary for read-only validation; do not invent SMTP, OAuth, sandbox, or provider values.
- [ ] Run the complete test suite, TypeScript, relevant lint, and production build with branch Preview configuration.
- [ ] Deploy a non-Production Preview with `--skip-domain`, capture its exact URL, then set self-hosted `SITE_URL` and exact/wildcard Preview redirects before recreating Auth.
- [ ] Verify Production environment IDs/targets and the production deployment remain unchanged; commit redacted evidence.

### Task 5: Preview end-to-end and safe integration validation

**Files:**
- Modify: `docs/operations/2026-09-24-supabase-preview-validation.md`
- Create outside Git: `work/precutover/private/e2e/`

**Interfaces:**
- Consumes: Task 4 deployed Preview and self-hosted Auth redirects.
- Produces: reproducible functional matrix with cleanup proof and no real side effects.

- [ ] Exercise homepage, catalog, categories, product, variants, images, cart, availability, coupons, dispatch, zones, and checkout dry-run.
- [ ] Exercise login, logout, session recovery, admin, orders, products, stock, CRM, conversations, Wonka, and missing-attachment fallbacks with a temporary destination-only admin/session if needed.
- [ ] Test public object access, private signed URL, and administrative upload through supported Storage APIs; remove only the temporary object/user afterward.
- [ ] Validate Mercado Pago handler signatures, callback construction, idempotency, and status mapping with fixtures or sandbox only; do not create a real payment preference without a verified sandbox credential.
- [ ] Validate Meta/WhatsApp/Instagram token decryption and read-only account detection without sending, changing webhooks, or emitting CAPI.
- [ ] Prove no application request contacts the managed Supabase host except inventoried historical fallback strings; record exact pass/fail evidence and commit.

### Task 6: Backup escrow and administrator hardening

**Files:**
- Modify: `docs/operations/2026-09-24-supabase-backup-restore.md`
- Modify: `docs/operations/2026-09-24-supabase-https-preview.md`
- Create outside Git: second offline escrow artifact under `outputs/`

**Interfaces:**
- Produces: two independently stored encrypted-key escrows, current backup/restore proof, SSH continuity, and sudo without global `NOPASSWD`.

- [ ] Run the health check, backup timer inspection, offsite encrypted-copy check, and isolated restore verification.
- [ ] Create a second DPAPI-protected backup-key escrow distinct from the existing artifact and verify it decrypts to the same key without printing it.
- [ ] Establish a safe sudo password/mechanism for `supabaseops` without exposing it, open a second SSH session, and verify both SSH and sudo.
- [ ] Remove only `/etc/sudoers.d/90-supabaseops` global `NOPASSWD`, validate sudoers, and re-test administration before closing the original session.
- [ ] Document recovery through Contabo console/root access and commit redacted evidence.

### Task 7: Delta analysis, final report, and stop gate

**Files:**
- Modify: `outputs/supabase-self-hosted-precutover-report.md`
- Modify: `docs/operations/2026-09-24-supabase-cutover-rollback-checklist.md`

**Interfaces:**
- Consumes: all prior evidence.
- Produces: factual GO/NO-GO assessment and exact future delta/cutover/rollback runbook.

- [ ] Compare current managed-source counts read-only against the Phase 4 snapshot and identify tables that can change before cutover.
- [ ] Re-check HTTPS, DNS, 11/11 health, ports, RAM/disk, Auth, Storage, old URLs, backup age, and Preview behavior.
- [ ] Document the exact freeze, final roles/schema/data delta, sequence reconciliation, verification, Production-variable, webhook, deploy, smoke, observation, and rollback order without executing it.
- [ ] Run secret scan, `git diff --check`, full tests, TypeScript, lint, build, and fresh external/internal probes.
- [ ] Commit the final report and stop before any final delta, Production change, webhook change, or cutover.
