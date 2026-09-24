# Supabase Storage Recovery and Preview Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recover verifiable Storage media, make missing media safe, and prepare a tested self-hosted Preview without production cutover.

**Architecture:** Treat the migrated `storage.objects` metadata as the authoritative object list, keep private paths out of committed artifacts, and match read-only local candidates by size plus hash. Upload verified files through the supported S3/API surface only. Gate HTTPS and Vercel Preview behind a reachable hostname while completing code hardening and backups independently.

**Tech Stack:** Supabase self-hosted v0.8.1, PostgreSQL 17, Storage S3 API, PowerShell, rclone, Next.js 16, TypeScript, Node test runner, Docker Compose, systemd.

**Spec:** `docs/superpowers/specs/2026-09-24-supabase-storage-recovery-preview-readiness.md`

## Global Constraints

- Managed Supabase is read-only; no plan or billing changes.
- Never print, log, commit, or document credential values or private content.
- Do not change DNS, Vercel Production, production variables, external webhooks, or managed Supabase.
- Do not expose PostgreSQL, Supavisor, Studio, or internal services.
- Do not copy objects into `volumes/storage/`; use Storage API/S3 only.
- Do not run real payments, CAPI, outbound WhatsApp, or outbound Instagram.
- Every code change follows RED-GREEN TDD and every commit is small and reversible.
- Stop before cutover.

## Review Focus

- A broken remote product image must render a deterministic fallback without hiding product name, price, or purchase controls.
- Missing Supabase environment variables must fail closed and must never connect to the managed project.
- Private Storage paths and customer identifiers must not appear in committed/output manifests.
- Candidate files with only a matching basename must remain unverified until size and hash/ETag match.
- Backup success must be demonstrated by a restore drill, not inferred from archive creation.

---

### Task 1: Secure Storage manifest and reference map

**Files:**
- Create outside Git: `work/phase4b/private/storage-objects.csv`
- Create: `outputs/phase4b-storage-manifest-sanitized.csv`
- Create: `outputs/phase4b-storage-summary.md`

**Interfaces:**
- Consumes: migrated `storage.buckets`, `storage.objects`, and the six known URL-bearing DB fields.
- Produces: one authoritative row per object with stable object ID, safe path label/hash, size, MIME, visibility, DB reference count, functional context, and impact.

- [ ] Export all 127 target metadata rows to a local private file without stdout and verify aggregate counts/bytes per bucket.
- [ ] Query reference counts for `productos.imagen_url`, `seasons.banner_image`, `ajustes.data`, `omnichannel_messages.payload`, `wonka_jobs.input`, and `wonka_messages.metadata`.
- [ ] Classify impact using exact rules: active product/catalog references are CRITICAL; recent CRM/Wonka references are IMPORTANT; old conversation/OCR attachments are HISTORICAL.
- [ ] Generate a sanitized CSV that uses full public product paths but SHA-256 opaque identifiers for private paths.
- [ ] Verify the sanitized row count is 127 and that no email, phone, access token, signed query string, or private path is present.

### Task 2: Read-only recovery search and official sample

**Files:**
- Create outside Git: `work/phase4b/private/candidates.csv`
- Modify: `outputs/phase4b-storage-manifest-sanitized.csv`
- Modify: `outputs/phase4b-storage-summary.md`

**Interfaces:**
- Consumes: Task 1 private manifest.
- Produces: verified/probable/downloadable/HTTP-402/not-located status for every object.

- [ ] Build a read-only local file index across repository worktree, all Git objects/branches, `public/`, Documents, Desktop, Downloads, Codex, Antigravity, scratch/workspaces, prior LMV folders, builds, backups, and caches.
- [ ] Match candidates first by size and basename/path hints, then compute SHA-256 and MD5 only for candidates.
- [ ] Accept `recuperado y verificado` only when the Storage ETag is a simple MD5 and matches, or another trusted hash/byte comparison proves identity.
- [ ] Test at most one public product object and one private object through official Platform endpoints; after any HTTP 402, record it and stop remote sampling.
- [ ] Update all 127 statuses and summarize exact counts/bytes by impact and recovery class.

### Task 3: Supported upload and Storage verification

**Files:**
- Create outside Git: `work/phase4b/private/upload-manifest.csv`
- Modify: `outputs/phase4b-storage-summary.md`

**Interfaces:**
- Consumes: Task 2 verified candidates only.
- Produces: uploaded self-hosted objects with original bucket/path and post-upload verification.

- [ ] Confirm/create only buckets present in the live manifest and preserve their public flags.
- [ ] Upload verified candidates via `http://127.0.0.1:8000/storage/v1/s3` or the official Storage API using temporary root-only credentials.
- [ ] Verify remote path, byte size, and hash/ETag after upload; never overwrite a differing existing object.
- [ ] Test one recovered public URL and one recovered private signed URL when available.
- [ ] Record complete/incomplete bucket status and securely remove temporary transfer configuration.

### Task 4: Missing-media fallbacks and fail-closed Supabase configuration

**Files:**
- Create: `src/components/media/SafeStorageImage.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/app/productos/[slug]/VistaProducto.tsx`
- Modify: `src/components/tienda/ProductDetailModal.tsx`
- Modify: `src/components/tienda/CampaignCatalog.tsx`
- Modify: `src/app/admin/productos/page.tsx`
- Modify: `src/lib/supabase/server.ts`
- Test: `test/storage-media-fallback.test.ts`
- Test: `test/supabase-env-fail-closed.test.ts`

**Interfaces:**
- Produces: `SafeStorageImage` that swaps a failed image for caller-provided non-media UI; server client throws a configuration error when URL/key is absent.

- [ ] Write `storage-media-fallback.test.ts` asserting the component handles `onError` and every critical product/catalog renderer uses it; run and observe failure because the component is absent.
- [ ] Implement `SafeStorageImage` with a client-side failure state and replace critical raw remote images while preserving emoji/color/name/price/purchase controls; run the focused test green.
- [ ] Write `supabase-env-fail-closed.test.ts` asserting `server.ts` contains no managed project ref or dummy key and throws on missing required variables; run and observe failure.
- [ ] Remove the hard-coded fallback, validate URL/key, and throw a redacted configuration error; run the focused test green.
- [ ] Run the full Node suite, `npx tsc --noEmit`, and `npm run build`; commit as `fix: fail safely when Supabase media or config is missing`.

### Task 5: Storage upload hardening, URL readiness, and secret classification

**Files:**
- Modify: `src/app/api/admin/media/sign/route.ts`
- Test: `test/admin-media-sign-security.test.ts`
- Create via CLI: `supabase/migrations/<timestamp>_restrict_storage_uploads.sql`
- Create: `docs/operations/2026-09-24-supabase-secret-readiness.md`
- Create: `docs/operations/2026-09-24-supabase-url-readiness.md`

**Interfaces:**
- Consumes: existing admin-authenticated signed-upload flow and reversible URL rewrite migration.
- Produces: bounded uploads, no open anonymous INSERT, and no URL rewrite until a final HTTPS origin exists.

- [ ] Write a failing route contract test requiring an explicit 12 MiB server-side upper bound and image/video type allowlist.
- [ ] Enforce the size bound and keep authentication, random server path, and allowed MIME validation; run focused and full tests.
- [ ] Use `npx supabase migration new restrict_storage_uploads`, then drop only `storage_anon_insert`; validate SQL in a transaction and rollback.
- [ ] Reclassify every secret as CONSERVAR/REGENERAR/RECONFIGURAR/ELIMINAR without values; explicitly preserve `META_TOKEN_ENCRYPTION_KEY` and use new self-hosted Supabase keys.
- [ ] Extend the URL inventory with functional use and recovery state; do not execute the rewrite migration.
- [ ] Commit as `security: restrict storage uploads for self hosted preview`.

### Task 6: Automated encrypted backups and isolated restore drill

**Files:**
- Create on VPS: `/opt/supabase-lamanito/backup/bin/backup.sh`
- Create on VPS: `/opt/supabase-lamanito/backup/bin/healthcheck.sh`
- Create on VPS: `/etc/systemd/system/lmv-supabase-backup.service`
- Create on VPS: `/etc/systemd/system/lmv-supabase-backup.timer`
- Create: `docs/operations/2026-09-24-supabase-backup-restore.md`

**Interfaces:**
- Produces: daily encrypted DB/config/Storage backup, retention, offsite copy, health checks, and proven restore steps.

- [ ] Create root-only scripts and environment files using `UMask=0077`; logs contain filenames/status only.
- [ ] Dump roles/schema/data, archive Storage through its supported surface, encrypt before offsite copy, and retain 7 daily, 4 weekly, and 6 monthly points.
- [ ] Enable the daily timer and execute one manual backup.
- [ ] Restore into an isolated temporary PostgreSQL database and temporary Storage prefix/bucket, compare counts/checksums, then remove only the explicitly named drill resources.
- [ ] Add monitoring for container health, restart loops, disk, RAM, backup age, and future TLS expiry.
- [ ] Commit documentation as `docs: verify self hosted backup and restore drill`.

### Task 7: HTTPS configuration without DNS mutation

**Files:**
- Create on VPS: `/opt/supabase-lamanito/reverse-proxy/Caddyfile.pending`
- Create: `docs/operations/2026-09-24-supabase-https-preview.md`

**Interfaces:**
- Consumes: chosen future hostname `supabase.lamanitodelvegano.cl` unless explicitly changed.
- Produces: reviewed reverse-proxy configuration ready for activation after DNS approval.

- [ ] Prepare but do not activate a Caddy vhost that proxies only to `127.0.0.1:8000`, preserves WebSocket/forwarding headers, limits request bodies, and excludes Studio.
- [ ] Document required `A`/`AAAA` record, UFW 80/443 changes, certificate issuance, rollback, and health probes.
- [ ] Verify current public listeners remain SSH-only and mark HTTPS BLOCKED until DNS/activation approval.
- [ ] Commit as `docs: prepare self hosted Supabase HTTPS endpoint`.

### Task 8: Preview gate and safe functional validation

**Files:**
- Create: `docs/operations/2026-09-24-supabase-preview-validation.md`

**Interfaces:**
- Consumes: active trusted HTTPS endpoint, new self-hosted keys, safe external-integration modes.
- Produces: Vercel Preview or an explicit blocker; never Production changes.

- [ ] Confirm through Vercel CLI/API that only Preview-scoped variables would be changed and take a names-only snapshot of current scopes.
- [ ] If HTTPS is reachable, configure Preview-only Supabase variables and disable real side effects; otherwise record the precise blocker and do not create a broken Preview.
- [ ] Run `npm test`, `npx tsc --noEmit`, and `npm run build` with self-hosted Preview env.
- [ ] Exercise the requested storefront/admin/CRM/Wonka/read-only channel matrix; payments remain sandbox/dry-run and outbound/CAPI stay disabled.
- [ ] Prove browser/server traffic does not contact the managed project except catalogued historical URLs.
- [ ] Commit as `docs: record self hosted Preview validation`.

### Task 9: Final readiness, cutover checklist, and rollback checklist

**Files:**
- Create: `outputs/supabase-self-hosted-precutover-report.md`
- Create: `docs/operations/2026-09-24-supabase-cutover-rollback-checklist.md`

**Interfaces:**
- Consumes: all prior task evidence.
- Produces: exact recovered/pending media, readiness verdict, risks, cutover checklist, and rollback checklist.

- [ ] Report objects/bytes recovered and pending by CRITICAL/IMPORTANT/HISTORICAL and bucket completeness.
- [ ] State separately whether missing files block catalog, checkout, orders, stock, admin, CRM, Wonka, new WhatsApp, or new Instagram.
- [ ] Summarize Auth, secrets, URLs, HTTPS, Preview, tests, functional checks, backups, resources, and public ports.
- [ ] Write exact go/no-go gates, final sync, Vercel Production switch, observation, and rollback steps without executing them.
- [ ] Run secret scan, `git diff --check`, complete test/build verification, and a fresh VPS health/port check.
- [ ] Commit as `docs: record Supabase precutover readiness` and stop for explicit approval.

