# Supabase Phase 4 Data, Auth, and Storage Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a verified, isolated copy of production database data, Auth state, and Storage objects on the existing self-hosted stack without changing any production endpoint.

**Architecture:** Treat the managed project as a read-only source. Create official logical dumps on the VPS, retain protected originals, copy an AES-256-GCM encrypted archive to Windows, restore data transactionally with triggers disabled, and copy Storage only through S3-compatible endpoints with `rclone`. All comparisons emit counts, hashes, and metadata only.

**Tech Stack:** Supabase CLI 2.117.0, PostgreSQL 17, Docker Compose, PowerShell/.NET AES-GCM and DPAPI, rclone S3, SSH.

**Spec:** `docs/operations/2026-09-23-supabase-phase4-scope.md`

## Global Constraints

- Do not change DNS, Vercel Production, production variables, or public endpoints.
- The managed project is read-only except for credentials already explicitly authorized for extraction.
- Never print, log, commit, or persist plaintext secrets outside protected temporary files.
- Keep only SSH public; Envoy remains on `127.0.0.1:8000`; do not publish database, pooler, or Studio.
- Do not run live purchases, payment callbacks, outbound messaging, Meta CAPI, or real webhooks.
- Stop the Storage subtask if Platform S3 is blocked; do not substitute direct filesystem copying.

## Review Focus

- A data dump that silently omits `auth` or `storage` operational rows must fail verification against source counts.
- Version mismatches in Auth/Storage tables must be corrected only in the isolated dump/target, never at source.
- Trigger suppression must be active only inside the restore transaction and return to `origin` afterward.
- Backup encryption must be decrypt-tested before deleting the local plaintext staging copy.
- Storage verification must compare both object count and total bytes for every source bucket.

---

### Task 1: Preflight and final official logical backup

**Files:**
- Create outside Git on VPS: `/opt/supabase-lamanito/backups/phase4/roles.sql`
- Create outside Git on VPS: `/opt/supabase-lamanito/backups/phase4/schema.sql`
- Create outside Git on VPS: `/opt/supabase-lamanito/backups/phase4/data.sql`
- Create outside Git on VPS: `/opt/supabase-lamanito/backups/phase4/SHA256SUMS`

**Interfaces:**
- Consumes: managed database password entered interactively.
- Produces: protected, checksummed SQL inputs for Tasks 2 and 3.

- [ ] Verify source database size, destination free disk, container health, firewall, and loopback-only bindings.
- [ ] Generate the `supabase db dump --dry-run` scripts for roles, schema, and `--data-only --use-copy -x storage.buckets_vectors -x storage.vector_indexes`.
- [ ] Run those exact scripts in the official tools image with the password supplied through a temporary mode-0600 env file.
- [ ] Destroy the temporary credential file and verify it is absent.
- [ ] Verify all three SQL files are non-empty, mode 0600, root-owned, and contain the expected COPY/DDL classes.
- [ ] Generate SHA-256 checksums and verify them with `sha256sum -c`.

Expected: all checks pass; no data restore has occurred.

### Task 2: Encrypted off-VPS backup

**Files:**
- Create: `outputs/lmv-phase4-backup-2026-09-23.zip.aes`
- Create: `outputs/lmv-phase4-backup-2026-09-23.key.dpapi`
- Create: `outputs/lmv-phase4-backup-2026-09-23.manifest.txt`
- Create: `outputs/restore-lmv-phase4-backup.ps1`

**Interfaces:**
- Consumes: Task 1 SQL files and hashes.
- Produces: a decrypt-tested AES-256-GCM archive and current-user DPAPI-wrapped key.

- [ ] Copy the three protected dumps and checksum manifest to a temporary Windows staging directory outside Git.
- [ ] Archive the files without displaying contents.
- [ ] Generate a random 256-bit AES key and protect it with Windows DPAPI for the current user.
- [ ] Encrypt the archive with AES-256-GCM; persist nonce/tag with the ciphertext and write no plaintext key.
- [ ] Decrypt to a temporary verification path, verify `SHA256SUMS`, then delete all local plaintext staging and verification files.

Expected: encrypted archive and DPAPI key remain outside Git; a tested recovery script is present.

### Task 3: Transactional database and Auth restore

**Files:**
- Consume on VPS: `/opt/supabase-lamanito/backups/phase4/data.sql`
- Create outside Git: `/opt/supabase-lamanito/backups/phase4/data-restore.log`

**Interfaces:**
- Consumes: Task 1 data dump and the already-restored schema.
- Produces: isolated application data and Auth state.

- [ ] Inspect COPY targets and compare them with target tables/columns without outputting row contents.
- [ ] Preserve a pre-data target checkpoint and verify target business/Auth/Storage tables are empty.
- [ ] Run `psql --single-transaction --set ON_ERROR_STOP=1`, set `session_replication_role = replica`, and load `data.sql`.
- [ ] Correct only isolated dump/target compatibility issues documented by Supabase; repeat the final import from the empty checkpoint.
- [ ] Verify `session_replication_role = origin` after completion.
- [ ] Compare source and destination counts for every table, Auth users/identities, PK/FK validity, sequences, and critical-table hashes.
- [ ] Verify password hashes by null/non-null counts and deterministic hash-of-hashes without printing any hash.
- [ ] Verify `admin_roles.user_id` resolves to migrated `auth.users.id`.

Expected: zero count differences for included tables; no orphan FKs; two Auth users and their identities preserved.

### Task 4: External-secret disposition matrix

**Files:**
- Create: `docs/operations/2026-09-23-supabase-phase4-secret-matrix.md`

**Interfaces:**
- Consumes: environment-variable names from Vercel, self-host `.env` keys, and repository references; never values.
- Produces: keep/regenerate/reconfigure decisions for later cutover.

- [ ] Enumerate secret names and consumers from Vercel and code without downloading values.
- [ ] Mark `META_TOKEN_ENCRYPTION_KEY` as preserve-exactly and explain why existing encrypted tokens depend on it.
- [ ] Classify Meta/WhatsApp, Flow, Mercado Pago, Google OAuth, Gemini, SMTP/Resend, cron, gateway, JWT/API, database, and S3 credentials.
- [ ] Record future destination and cutover dependency without writing secret values.

Expected: matrix contains names and decisions only; secret-value scan is clean.

### Task 5: Storage S3-to-S3 migration

**Files:**
- Create outside Git on VPS: `/opt/supabase-lamanito/backups/phase4/rclone.conf` mode 0600, removed after transfer.
- Create outside Git on VPS: `/opt/supabase-lamanito/backups/phase4/storage-manifest.txt` without credentials.

**Interfaces:**
- Consumes: Platform S3 credentials entered interactively and existing self-host S3 protocol credentials.
- Produces: copied Storage objects plus per-bucket count/byte verification.

- [ ] Install the official Ubuntu `rclone` package if absent and record its version.
- [ ] Verify the self-host S3 endpoint internally at `http://127.0.0.1:8000/storage/v1/s3`.
- [ ] Obtain Platform S3 credentials interactively; do not print or store them beyond a protected temporary config.
- [ ] Run `rclone lsd` and stop this task if quota restrictions or credentials block a complete source listing.
- [ ] Inventory source buckets and reconcile with the requested names. Treat absent `products`/`blog` as absent, not silently empty.
- [ ] Create only matching real buckets on self-host with the same public/private flag.
- [ ] Run `rclone copy` from Platform S3 to self-hosted S3; never write into `volumes/storage/`.
- [ ] Compare per-bucket object counts, total bytes, and path-list hashes; verify metadata through `storage.objects`.
- [ ] Delete the temporary rclone configuration and verify its absence.

Expected: every accessible source bucket has exact count/byte/path parity, or the task reports a quota/credential blocker without fallback copying.

### Task 6: Old-URL migration preparation

**Files:**
- Create via Supabase CLI: one reversible migration under `supabase/migrations/`.
- Create: `docs/operations/2026-09-23-supabase-phase4-url-inventory.md`

**Interfaces:**
- Consumes: destination copy and the approximately 80 old-host references.
- Produces: classified inventory and an unexecuted, parameterized/reversible migration plan.

- [ ] Recount old-host references by table/column on source and destination without outputting values.
- [ ] Classify each location as Storage URL or non-Storage API URL using host/path aggregates only.
- [ ] Generate a migration file through `supabase migration new`; require an explicit future hostname parameter and include a reversal strategy.
- [ ] Do not execute replacement while the final hostname is undefined.

Expected: counts match source/destination and zero URLs are changed.

### Task 7: Internal validation and final report

**Files:**
- Create: `docs/operations/2026-09-23-supabase-phase4-result.md`

**Interfaces:**
- Consumes: Tasks 1–6 verification outputs.
- Produces: final evidence report and stop point before cutover.

- [ ] Verify all containers healthy, endpoints local, firewall unchanged, and forbidden ports absent.
- [ ] Re-run all table/Auth/sequence/FK/count comparisons and database/storage sizes.
- [ ] Test an internal admin identity without enabling public OAuth; do not expose credentials or create production sessions.
- [ ] Test catalog/product/order reads and public/private Storage access only against loopback.
- [ ] Generate and validate a signed URL for a private copied object without printing the URL.
- [ ] Review `storage_anon_insert`, identify its real code path, and document a more restrictive alternative.
- [ ] Record RAM/disk, differences, blocked checks, risks, and explicit confirmation that Vercel/DNS remain unchanged.
- [ ] Commit documentation/migrations in small reversible commits and stop.

Expected: final report contains evidence only, no secret values or production mutations.
