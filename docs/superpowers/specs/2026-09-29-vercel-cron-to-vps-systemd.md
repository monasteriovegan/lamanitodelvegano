# Vercel Cron to VPS systemd Migration Specification

## Objective

Move the three production Vercel Cron schedules to authenticated systemd timers on the Contabo VPS without changing their UTC schedules, HTTP routes, HTTP method, business logic, authentication contract, or production channel controls.

## Audited baseline

| Cron | Schedule (UTC) | Endpoint / method | Side effects | Auth | Idempotency | Dependencies |
|---|---|---|---|---|---|---|
| Reconciliation | `0 8 * * *` | `GET /api/cron/reconcile-pending-sales` | Reads conversations/messages; upserts reconciliation state; can link messages/conversations to existing orders, add review notes, or create a canonical order after strict sale detection. It does not send customer messages or confirm payment. | Exact `Authorization: Bearer $CRON_SECRET`; missing/empty/mismatched secret fails closed with 401. | Strong application keys (`conversation:<id>` or per-cycle first-message key), duplicate detection, conflict-safe conversation/order linking, plus reconciliation-state upsert. A second run may increment attempt metadata but must not create a duplicate order. | Self-hosted Supabase; order/pricing repositories; configured Groq/Gemini extraction provider when a candidate requires extraction. Handler max duration: 60 s. |
| Abandoned carts | `0 13 * * *` | `GET /api/cron/carritos-abandonados` | Evaluates/upserts opportunities; normally may send WhatsApp and/or Resend email, then set `carritos_abandonados.contactado=true`. Current `ai_enabled=false` blocks WhatsApp, but **does not block email fallback**. | Same fail-closed Bearer contract. | Already-contacted/recovered carts are excluded. The opportunity upsert is conflict-safe. Email delivery followed by a failed DB update remains a sequential-duplicate risk, so automatic uncertain retries are forbidden. | Self-hosted Supabase; Remy runtime config; Meta WhatsApp transport; Resend. Handler max duration: 60 s. |
| Opportunities | `0 14 * * *` | `GET /api/cron/sales-opportunities` | Evaluates/upserts opportunities; claims due rows; when allowed can send WhatsApp/Instagram, persist outbound messages, and advance follow-up state. | Same fail-closed Bearer contract. | Five-minute claim token, due-state transition, provider-message tracking, and follow-up state make concurrent/duplicate delivery guarded. | Self-hosted Supabase; Remy runtime config; channel settings; Meta WhatsApp/Instagram transports. Handler max duration: 60 s. |

Source handlers:

- `src/app/api/cron/reconcile-pending-sales/route.ts`
- `src/app/api/cron/carritos-abandonados/route.ts`
- `src/app/api/cron/sales-opportunities/route.ts`

Shared controls:

- `src/lib/security/cron-authorization.ts`
- `src/lib/runtime/production-controls.ts`

The live Vercel project currently reports exactly these three schedules. Vercel runtime-log searches for all three paths over seven days returned no retained matches, so historical duration cannot be claimed from available logs. The migration must capture durations from the controlled service tests and journal thereafter.

## Current safety state

- Remy runtime: globally disabled.
- WhatsApp: enabled, automatic reply disabled, read-only enabled.
- Instagram: enabled, automatic reply disabled, read-only enabled.
- Remy metadata currently has `opportunity_auto_send=true` and `opportunity_cart_cutover=false`.
- There are currently eligible abandoned carts and due opportunities, so a normal cart test could have real effects.
- Meta Pixel and Meta CAPI must remain enabled and are outside the timer migration.

The abandoned-cart manual test must therefore temporarily engage the existing persisted `opportunity_cart_cutover` gate, outside the 13:00 UTC Vercel window, with a trap that restores its prior value. Before and after the test, outbound-message counts, contacted-cart counts, and the four safety controls above must be compared. No test may send email, WhatsApp, or Instagram messages.

## VPS architecture

- One non-login service account: `lmv-cron`.
- One root-owned `0600` environment file: `/etc/lmv-cron/cron.env`.
- The environment file contains `CRON_SECRET` and the canonical HTTPS base URL; no secret appears in Git, unit files, process arguments, or journal output.
- One versioned runner invokes the existing HTTPS endpoints with `curl --fail-with-body`, a 10 s connect timeout and a total timeout longer than the 60 s Vercel handler limit.
- The authorization header is supplied through curl configuration on a private file descriptor, not through process arguments.
- Each service uses a non-blocking local `flock`. An overlapping invocation logs `already_running` and exits successfully without issuing HTTP traffic.
- Only DNS/connect failures proven to occur before an HTTP response receive one delayed retry. HTTP failures and timeouts are not retried automatically because their side-effect status may be uncertain.
- Each journal run logs job, UTC start/end, duration, HTTP status, outcome, attempt count, and sanitized request ID. Response bodies, secrets, tokens, and PII are never logged.

Required units:

- `lmv-reconciliation.service` / `lmv-reconciliation.timer` at 08:00 UTC
- `lmv-abandoned-carts.service` / `lmv-abandoned-carts.timer` at 13:00 UTC
- `lmv-opportunities.service` / `lmv-opportunities.timer` at 14:00 UTC

All timers use explicit UTC `OnCalendar`, `Persistent=true`, zero randomized delay, and are enabled only after Vercel confirms the schedules are absent.

## Existing VPS integration

The VPS runs systemd 255, is NTP-synchronized, and uses local timezone `Europe/Berlin`; explicit UTC timers are mandatory. `curl`, `flock`, `jq`, and `systemd-run` are installed. The existing `lmv-supabase-healthcheck.timer` runs every 30 minutes and verifies eleven healthy Supabase containers, disk, memory, and backup freshness. It must be extended—not duplicated—to also detect:

- disabled/missing timer;
- failed service result;
- last service completion older than 36 hours;
- at least two failure journal events in 36 hours.

Journal retention must be capped at 256 MiB, preserve at least 1 GiB free, and retain at most 30 days. Current journal use is approximately 93 MiB.

## Cutover sequence

1. Add and test versioned runner, unit files, installation logic, healthcheck extension, and runbook without removing Vercel schedules.
2. Install the runner/services/timers on the VPS with all three timers disabled.
3. Transfer the existing Vercel `CRON_SECRET` into `/etc/lmv-cron/cron.env` without displaying it, and verify ownership/mode only.
4. Verify unauthenticated calls return 401 and authorized manual services return 2xx.
5. Run reconciliation twice and prove no duplicate orders/links; run opportunities under existing read-only channel controls; run abandoned carts only while the existing cart-cutover gate is temporarily true and guaranteed to be restored.
6. Capture the last observable/expected Vercel execution, cutover UTC timestamp, and first future VPS execution.
7. Commit removal of only the three `vercel.json` cron entries, deploy Production, and confirm `vercel crons ls` reports none of the three.
8. Only then enable/start all three VPS timers and verify their next UTC times.
9. Run the extended healthcheck and production smoke tests for web, Auth, catalog/checkout read path, and eleven Supabase containers.

At no point may Vercel and VPS schedulers be active simultaneously. No full VPS reboot is permitted; persistence is proven from `is-enabled`, `Persistent=true`, daemon reload, and individual timer restarts.

## Rollback

If any VPS timer or service is unsafe or unhealthy: disable and stop all three timers, restore only the prior `vercel.json` cron entries from the identified pre-cutover commit, redeploy Production, verify the three Vercel schedules, and leave endpoint business logic unchanged.

## Invariants

- Remy remains globally OFF.
- WhatsApp and Instagram remain ON/READ_ONLY.
- Meta Pixel and Meta CAPI remain ON.
- No real outbound message, email, payment, or purchase is generated during validation.
- No managed Supabase mutation, DNS change, business schedule change, full VPS reboot, or Git secret is allowed.

