# Supabase self-hosted backup and restore drill — 2026-09-24

## Scope and status

This procedure protects only the isolated self-hosted environment. It does not change the managed Supabase project, DNS, or Vercel. The first encrypted backup and an isolated restore drill completed successfully on 2026-09-24.

## Backup contents

- PostgreSQL 17 roles, schema, and data are dumped separately from the healthy `supabase-db` container.
- Storage objects are read through the supported self-hosted S3 endpoint. The backup contains the 27 binaries that are actually present. The 100 metadata-only objects known to be unavailable are explicitly excluded so a missing binary cannot silently turn the scheduled backup into a partial failure.
- The pinned self-hosted configuration is included: `.env`, Compose files, Envoy/Kong, database initialization SQL, Functions, pooler, and reverse-proxy templates. Raw PostgreSQL and Storage volume files are not copied.
- Every plaintext file in the staging tree is covered by `SHA256SUMS` before encryption.
- The archive is encrypted with AES-256-CBC, PBKDF2, a random salt, and a random 256-bit key. Plaintext staging is removed by a guarded cleanup trap. Storage backup uses the public HTTPS S3 endpoint derived from `SUPABASE_PUBLIC_URL`; this is required because S3 signatures include the canonical host after the HTTPS origin is active.

## Locations and permissions

- Backup program: `/opt/supabase-lamanito/backup/bin/backup.sh`, owned by root, mode `0700`.
- Restore drill: `/opt/supabase-lamanito/backup/bin/restore-drill.sh`, owned by root, mode `0700`.
- Encryption key: `/opt/supabase-lamanito/backup/.key`, owned by root, mode `0600`.
- VPS archives: `/opt/supabase-lamanito/backup/{daily,weekly,monthly}`, root-only.
- Offsite handoff contains encrypted material only: `/opt/supabase-lamanito/backup/offsite`, readable by `supabaseops`.
- Windows encrypted key envelopes: `outputs/lmv-selfhost-backup-key.dpapi` and `outputs/lmv-selfhost-backup-key-escrow-2.dpapi`. Both protect the same key with independent DPAPI entropy for the current Windows account.
- Windows encrypted archive copy: `outputs/backups/`.

No plaintext transfer copy of the encryption key remains on Windows or in `/tmp` on the VPS.

## Automation and retention

- `lmv-supabase-backup.timer`: daily at 05:15 UTC, with up to five minutes randomized delay and persistent catch-up.
- VPS retention: 7 daily, 4 weekly, and 6 monthly encrypted archives.
- `lmv-supabase-healthcheck.timer`: every 30 minutes; explicitly checks all 11 expected containers, fails if available memory falls below 10%, disk is at least 80%, or the newest backup is older than 36 hours.
- Windows Scheduled Task `LMV Supabase encrypted offsite backup`: daily at 03:15 local time, `StartWhenAvailable`, and pulls the latest encrypted archive over SSH. It verifies SHA-256 before reporting success and retains seven copies.

The Windows task uses interactive logon so no Windows password is stored. If the account is logged out at the trigger time, Task Scheduler starts it when the user next logs in.

## Verified restore drill

The latest verified run produced `lmv-supabase-20260925T033110Z.tar.gz.enc` and its offsite checksum matched. A temporary database named exactly `lmv_restore_drill_20260924` was created from `template0`, then the schema and data dumps were restored with stop-on-error behavior. Exact row counts for all 129 restored tables matched the live self-hosted database. The drill verified 325 primary/foreign-key constraints and 27 Storage objects / 39,405,106 bytes. The temporary database and plaintext drill directory were removed after validation.

## Manual checks

```bash
sudo systemctl status lmv-supabase-backup.timer
sudo systemctl status lmv-supabase-healthcheck.timer
sudo /opt/supabase-lamanito/backup/bin/healthcheck.sh
sudo /opt/supabase-lamanito/backup/bin/restore-drill.sh
```

Do not run a restore against `postgres`. A recovery must target a new database first, pass exact count and constraint comparisons, and only then be considered for a separately approved recovery operation.

## Remaining backup risks

- The 100 known unavailable Storage binaries cannot be backed up; their database metadata is included, but their object files are absent.
- Two independent DPAPI envelopes now exist outside the VPS, but both remain on the same Windows computer. Copy the second envelope to disconnected removable media under separate custody before cutover; no removable volume was connected during this phase.
- The DPAPI envelope is recoverable only by this Windows account on this Windows installation. Losing both the VPS key and this account profile would make the encrypted archives unrecoverable.
- Health checks are local systemd failures only; an external alert destination has not been configured because no notification service was authorized.
