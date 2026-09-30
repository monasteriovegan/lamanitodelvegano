# Vercel Cron → VPS systemd cutover

## Scope

This runbook migrates only these production schedules. The authenticated GET endpoints and application logic remain on Vercel.

| Job | Endpoint | UTC |
|---|---|---|
| `lmv-reconciliation` | `/api/cron/reconcile-pending-sales` | 08:00 |
| `lmv-abandoned-carts` | `/api/cron/carritos-abandonados` | 13:00 |
| `lmv-opportunities` | `/api/cron/sales-opportunities` | 14:00 |

## Immutable safety controls

- Remy is globally OFF.
- WhatsApp and Instagram are ON/READ_ONLY.
- Meta Pixel and Meta CAPI are ON.
- Tests do not send real email/messages and do not create payments.
- VPS timers remain disabled until Vercel reports no migrated schedules.
- No full VPS reboot, managed-Supabase mutation, DNS change, or secret output.

## Pre-cutover inventory

- Pre-cutover/rollback commit: `0787aa1e19bb87d496778de030b21cf6dd7ded33`.
- Last retained Vercel execution: not retained. Last expected instants before the 2026-09-30 cutover were reconciliation `2026-09-29T08:00:00Z`, abandoned carts `2026-09-29T13:00:00Z`, and opportunities `2026-09-29T14:00:00Z`.
- VPS services installed: all three unit pairs passed `systemd-analyze verify`.
- VPS timers disabled: all three reported `disabled/inactive` throughout controlled tests.
- Manual tests: reconciliation `2026-09-30T02:21:14Z` (2.698s) and `02:21:18Z` (1.076s), opportunities `02:21:41Z` (17.242s), abandoned carts `02:22:50Z` (0.516s); all HTTP 200 with safe Vercel request IDs retained in journald.
- Sanitized before/after counts were identical: orders `67` (`57` paid), conversation links `39` (duplicate pairs `0`), outbound messages `3149`, contacted carts `2`, opportunities `643` (`207` due).

## Secure secret installation

The existing Production variable was present but empty. It was rotated in place to a cryptographically random value, streamed to Vercel and the VPS through stdin/memory, and never printed or retained in the repository. The final VPS file is:

```text
/etc/lmv-cron/cron.env  root:root  0600
```

The file contains the canonical HTTPS base URL and existing secret. Never echo the value, place it in a command argument, or retain the temporary pull. Verify only owner, mode, and non-empty key presence.

## Disabled installation and verification

```bash
sudo ops/self-hosted/cron/install.sh
systemctl is-enabled lmv-reconciliation.timer lmv-abandoned-carts.timer lmv-opportunities.timer
systemd-analyze calendar '*-*-* 08:00:00 UTC'
systemd-analyze calendar '*-*-* 13:00:00 UTC'
systemd-analyze calendar '*-*-* 14:00:00 UTC'
```

Expected before cutover: all three timers disabled/inactive; six units pass `systemd-analyze verify`.

## Controlled tests

1. Record non-sensitive counts for orders, conversation/order links, outbound messages, contacted carts, opportunity states, and reconciliation state.
2. Verify unauthenticated calls return 401.
3. Run reconciliation twice and compare duplicate-sensitive counts.
4. Run opportunities while both channels remain read-only; outbound counts must not change.
5. Outside 13:00 UTC, save the existing `opportunity_cart_cutover` boolean, set it true, invoke abandoned carts, and restore the previous boolean in an unconditional trap.
6. If any email/message is sent or attempted, stop; leave Vercel schedules active.
7. Verify journal fields and absence of secrets/PII/bodies.

## No-overlap cutover

1. Commit only removal of the three `vercel.json` entries; record its parent as rollback commit.
2. Deploy that exact commit to Vercel Production.
3. Require `vercel crons ls` to show none of the three paths.
4. Production deployment `dpl_AtJXL6L2X2pSN5UHWDM85fkMvM7U` reached READY and `vercel crons ls` first confirmed zero jobs at `2026-09-30T02:36:38Z`; all VPS timers were still disabled/inactive at that check.
5. Only then run:

```bash
systemctl enable --now lmv-reconciliation.timer lmv-abandoned-carts.timer lmv-opportunities.timer
systemctl list-timers --all 'lmv-*'
```

6. VPS timers were enabled at `2026-09-30T02:37:30Z`. First future runs are reconciliation `2026-09-30T08:00:00Z`, abandoned carts `2026-09-30T13:00:00Z`, and opportunities `2026-09-30T14:00:00Z`.

## Evidence

```bash
systemctl is-enabled lmv-reconciliation.timer lmv-abandoned-carts.timer lmv-opportunities.timer
systemctl is-active lmv-reconciliation.timer lmv-abandoned-carts.timer lmv-opportunities.timer
systemctl list-timers --all 'lmv-*'
journalctl -u lmv-reconciliation.service -u lmv-abandoned-carts.service -u lmv-opportunities.service --since '-36 hours' --no-pager
systemctl start lmv-supabase-healthcheck.service
journalctl -u lmv-supabase-healthcheck.service -n 30 --no-pager
```

Confirm eleven healthy Supabase containers, protected environment-file metadata, canonical web/Auth/catalog/checkout read paths, runtime/channel invariants, and zero Vercel cron definitions.

## Rollback

1. Immediately disable/stop all VPS timers:

```bash
systemctl disable --now lmv-reconciliation.timer lmv-abandoned-carts.timer lmv-opportunities.timer
```

2. Restore only the three prior `vercel.json` entries from the recorded pre-cutover parent.
3. Run tests/build and deploy Production.
4. Require `vercel crons ls` to show the three original paths/schedules.
5. Verify VPS timers remain disabled. Do not modify endpoint logic or `CRON_SECRET`.

Rollback commit: `0787aa1e19bb87d496778de030b21cf6dd7ded33`.

## Final production audit

Production deployment `dpl_AtJXL6L2X2pSN5UHWDM85fkMvM7U` is READY from commit `0b73c4ef531666b2ebb09a2d63a42ddd543e9e9e`.

| Job | Before | Now | Schedule | Last controlled test | State |
|---|---|---|---|---|---|
| Reconciliation | Vercel Cron | `lmv-reconciliation.timer` | `08:00 UTC` daily | `2026-09-30T02:21:18Z`, 1.076s, HTTP 200; second run had no duplicate or count change | enabled/active |
| Abandoned carts | Vercel Cron | `lmv-abandoned-carts.timer` | `13:00 UTC` daily | `2026-09-30T02:22:50Z`, 0.516s, HTTP 200; controlled probe reported zero sends and exact gate restoration | enabled/active |
| Opportunities | Vercel Cron | `lmv-opportunities.timer` | `14:00 UTC` daily | `2026-09-30T02:21:41Z`, 17.242s, HTTP 200; outbound count unchanged | enabled/active |

| System | Effective state | Authoritative control |
|---|---|---|
| Remy | OFF | `agent_runtime_configs(agent='remy').enabled=false` and global `ai_enabled=false` |
| Meta CAPI | ON | Production access token plus configured Pixel/dataset; paid-order guards and `conversion_events.event_id` outbox provide payment gating and idempotency independently of Remy |
| Meta Pixel | ON | `integraciones_secretas.meta_pixel_id`; a headless production browser observed `fbq`, the Facebook script, the Pixel DOM node, and initial PageView |
| WhatsApp | ON / READ_ONLY | `channel_settings`: enabled=true, auto_reply=false, read_only=true |
| Instagram | ON / READ_ONLY | `channel_settings`: enabled=true, auto_reply=false, read_only=true |

Final evidence:

- `vercel crons ls`: zero jobs.
- Three VPS timers: enabled/active; next runs `2026-09-30T08:00:00Z`, `13:00:00Z`, and `14:00:00Z`.
- Integrated healthcheck: success; 11/11 Supabase containers healthy, cron timers=3, disk used 10%, memory available 82%, latest backup successful and under 24 hours old.
- Web smoke: canonical root 200, unauthenticated admin 307 to login, login 200, catalog 200 with 14 products, product page 200, checkout page 200, no payment created.
- Meta CAPI diagnostic: HTTP 200, token authorized, dataset configured, Meta validation status 400 for an intentionally empty batch, and `eventSent=false`.
- All three cron endpoints return 401 without authorization. `/etc/lmv-cron/cron.env` is `root:root` mode `0600`; the secret is absent from process arguments, unit text, Git-shaped tracked content, and journals.
- Repository verification: focused scheduler tests 12/12, Meta/payment tests 17/17, full suite 529/529, and ESLint passes for the changed TypeScript file. Repository-wide lint retains 506 pre-existing findings in unchanged files. Local builds cannot access protected Supabase values, while the exact cutover commit passed the remote Vercel production build.
- Rollback pressure test: the rollback commit contains exactly the original three schedules, and the documented order is disable VPS timers, restore/deploy Vercel schedules, verify Vercel, then remain in rollback mode with VPS timers disabled.
