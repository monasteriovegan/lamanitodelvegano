# Vercel Cron to VPS systemd Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the three Vercel Cron schedules with hardened, observable, authenticated systemd timers on the Contabo VPS without overlapping schedulers or changing production behavior.

**Architecture:** A restricted `lmv-cron` user runs three oneshot services through one small transport-only runner. The runner calls the existing canonical HTTPS GET endpoints with the existing Bearer secret, local locks, bounded timeouts, safe journal fields, and narrowly controlled pre-response retries; the existing 30-minute VPS healthcheck gains timer/service freshness checks. Cutover is two-phase: validate installed-but-disabled VPS units, remove Vercel schedules and verify absence, then enable VPS timers.

**Tech Stack:** Next.js 16/Vercel Cron, Bash, curl, systemd 255 timers/services, journald, Supabase PostgreSQL, Node test runner.

**Spec:** `docs/superpowers/specs/2026-09-29-vercel-cron-to-vps-systemd.md`

## Global Constraints

- Preserve `08:00`, `13:00`, and `14:00` UTC exactly; every timer must be timezone-explicit and DST-independent.
- Keep all three GET endpoints and exact fail-closed `CRON_SECRET` Bearer authentication.
- Never expose or version `CRON_SECRET`; store it only at `/etc/lmv-cron/cron.env`, owned `root:root`, mode `0600`, and never pass it in process arguments.
- Never allow the Vercel and VPS schedulers to be enabled at the same time.
- No real email, WhatsApp, Instagram, payment, or purchase may be generated during validation.
- Remy stays OFF; WhatsApp and Instagram stay ON/READ_ONLY; Meta Pixel and Meta CAPI stay ON.
- Do not modify managed Supabase, DNS, business schedules, endpoint business logic, or production channel preferences.
- Do not reboot the VPS; use daemon reload and individual unit/timer operations only.
- Preserve the unrelated untracked `supabase/.temp/` directory unchanged.

## Review Focus

- A second launch while a job is still running must log `already_running`, make no HTTP request, and exit zero; Task 2 integration test owns this.
- A 401/403/5xx or curl timeout must fail the service and must not trigger an uncertain retry; Task 2 runner test and Task 4 manual validation own this.
- A DNS/connect failure may retry once, but only before any HTTP response; Task 2 runner test owns this.
- The abandoned-cart validation must leave outbound messages, contacted-cart state, and runtime/channel controls unchanged even though eligible carts exist; Task 4 owns this.
- Cutover interruption after Vercel removal but before timer enablement must be recoverable without dual scheduling; Tasks 5 and 7 own this.

---

### Task 1: Freeze the audited contract and create the failing migration tests

**Files:**
- Modify: `test/order-reconcile-vercel-cron.test.ts`
- Create: `test/vps-systemd-cron-migration.test.ts`
- Read before code: the relevant routing/runtime pages under `node_modules/next/dist/docs/`

**Interfaces:**
- Consumes: schedules, paths, controls, and unit names from the specification.
- Produces: failing tests that require no migrated entries in `vercel.json`, three versioned timer/service pairs, and the existing fail-closed route contract.

- [ ] **Step 1: Read the relevant Next.js 16 route-handler/runtime documentation under `node_modules/next/dist/docs/` and record any constraint that affects the existing GET handlers.**

- [ ] **Step 2: Replace the old “Vercel reconciliation schedule exists” expectation with a test named `Vercel contains none of the three migrated schedules` using the three literal paths.**

- [ ] **Step 3: Add a test named `all migrated endpoints retain GET fail-closed authorization and 60 second bounds` that imports or exercises the real authorization helper and checks the three route contracts.**

- [ ] **Step 4: Add a configuration test that parses the six unit files through a small INI parser and asserts the literal UTC calendars, `Persistent=true`, required service user/environment file, timeout, hardening, and runner arguments without secret values.**

- [ ] **Step 5: Run the focused tests and confirm they fail because the VPS artifacts do not exist and the Vercel schedules still do.**

Run: `node --test test/order-reconcile-vercel-cron.test.ts test/vps-systemd-cron-migration.test.ts`

Expected: FAIL for missing systemd artifacts and still-present Vercel entries; existing authorization assertions remain PASS.

### Task 2: Implement the transport runner and hardened systemd units

**Files:**
- Create: `ops/self-hosted/cron/lmv-cron-run`
- Create: `ops/self-hosted/cron/lmv-reconciliation.service`
- Create: `ops/self-hosted/cron/lmv-reconciliation.timer`
- Create: `ops/self-hosted/cron/lmv-abandoned-carts.service`
- Create: `ops/self-hosted/cron/lmv-abandoned-carts.timer`
- Create: `ops/self-hosted/cron/lmv-opportunities.service`
- Create: `ops/self-hosted/cron/lmv-opportunities.timer`
- Create: `ops/self-hosted/cron/cron.env.example`
- Create: `ops/self-hosted/cron/50-lmv-journal-retention.conf`
- Modify: `test/vps-systemd-cron-migration.test.ts`

**Interfaces:**
- Consumes: `CRON_SECRET` and `LMV_CRON_BASE_URL` from `/etc/lmv-cron/cron.env`; service arguments are `<job-name> <endpoint-path>`.
- Produces: `/usr/local/libexec/lmv-cron-run` behavior and six unit files consumable by Task 3.

- [ ] **Step 1: Add executable runner tests with a controlled fake curl boundary for success, HTTP failure, timeout, one safe pre-response retry, secret absence from argv/output, and `already_running`.**

- [ ] **Step 2: Run the runner tests before implementation and confirm each new behavior fails for the named reason.**

- [ ] **Step 3: Implement `lmv-cron-run <job> <path>` with job/path allowlists, private temporary files, non-blocking `flock`, 10-second connect timeout, 75-second total timeout, `--fail-with-body`, safe request-ID extraction, UTC structured journal lines, and no response-body logging.**

- [ ] **Step 4: Allow one 15-second delayed retry only for curl DNS/connect exit codes with HTTP status `000`; never retry timeout, TLS ambiguity, or an HTTP response.**

- [ ] **Step 5: Add the three services with `User=lmv-cron`, `EnvironmentFile=/etc/lmv-cron/cron.env`, 90-second service timeout, runtime lock directory, journal output, empty capability bounding set, `NoNewPrivileges`, `ProtectSystem=strict`, `ProtectHome`, `PrivateTmp`, kernel/control-group protections, and AF_UNIX/INET/INET6 networking only.**

- [ ] **Step 6: Add the three explicit UTC timers with `Persistent=true`, `RandomizedDelaySec=0`, and the literal schedules from the spec.**

- [ ] **Step 7: Re-run focused Node tests and the executable runner tests.**

Expected: PASS, and the secret sentinel appears in neither stdout/stderr nor captured process arguments.

- [ ] **Step 8: Commit the runner/unit foundation.**

```bash
git add ops/self-hosted/cron test/order-reconcile-vercel-cron.test.ts test/vps-systemd-cron-migration.test.ts
git commit -m "ops: add hardened VPS cron timers"
```

### Task 3: Extend the existing healthcheck and add idempotent installation

**Files:**
- Modify: `ops/self-hosted/backup/healthcheck.sh`
- Create: `ops/self-hosted/cron/install.sh`
- Create: `docs/operations/2026-09-29-vercel-cron-vps-cutover.md`
- Modify: `test/vps-systemd-cron-migration.test.ts`

**Interfaces:**
- Consumes: the six Task 2 unit files and runner.
- Produces: an idempotent root installer, extended healthcheck, and exact operator/rollback runbook.

- [ ] **Step 1: Add controlled-command tests for healthcheck detection of a disabled timer, failed service, completion older than 36 hours, two failures in 36 hours, and a healthy three-job state.**

- [ ] **Step 2: Run those tests and confirm the unextended healthcheck fails them.**

- [ ] **Step 3: Extend the existing healthcheck with the three timer/service checks while retaining all eleven container, disk, memory, and backup checks.**

- [ ] **Step 4: Implement `install.sh` to create the no-login `lmv-cron` user, install root-owned runner/units/drop-in, create `/etc/lmv-cron` without overwriting an existing secret file, install the extended healthcheck, run `systemd-analyze verify`, and leave all new timers disabled.**

- [ ] **Step 5: Document secure secret transfer, validation snapshots, cutover timestamps, enable order, evidence commands, and exact rollback commands without values.**

- [ ] **Step 6: Run the focused tests and full repository tests.**

Run: `npm test`

Expected: all tests PASS.

- [ ] **Step 7: Commit health monitoring and runbook.**

```bash
git add ops/self-hosted/backup/healthcheck.sh ops/self-hosted/cron/install.sh docs/operations/2026-09-29-vercel-cron-vps-cutover.md test/vps-systemd-cron-migration.test.ts
git commit -m "ops: monitor VPS cron execution"
```

### Task 4: Install disabled units and perform controlled production-safe tests

**Files:**
- Create outside Git: `work/cron-migration/` evidence files containing only sanitized statuses/counts.
- Install on VPS: `/usr/local/libexec/lmv-cron-run`, `/etc/systemd/system/lmv-*.{service,timer}`, `/etc/lmv-cron/cron.env`.

**Interfaces:**
- Consumes: Task 3 installer, existing Vercel encrypted `CRON_SECRET`, existing runtime gates.
- Produces: three tested services with timers still disabled and a sanitized evidence bundle.

- [ ] **Step 1: Verify Git is clean except the pre-existing `supabase/.temp/`, Vercel still lists all three schedules, and no new timer is enabled.**

- [ ] **Step 2: Transfer the existing `CRON_SECRET` from Vercel to the VPS through stdin/memory without displaying it; create `/etc/lmv-cron/cron.env` atomically as `root:root 0600`; verify only path, owner, mode, and non-empty status.**

- [ ] **Step 3: Run `install.sh`, `systemctl daemon-reload`, `systemd-analyze verify`, and `systemd-analyze calendar` for all three timer expressions; confirm every timer is disabled/inactive.**

- [ ] **Step 4: Call each endpoint without Authorization and assert 401; do not log response bodies.**

- [ ] **Step 5: Snapshot only non-sensitive counts/hashes: orders, conversation links, outbound messages by channel, contacted carts, opportunity states, and reconciliation state; reconfirm Remy OFF, both channels ON/READ_ONLY, and Meta Pixel/CAPI effective ON.**

- [ ] **Step 6: Manually start `lmv-reconciliation.service` twice, record status/duration/request ID, and prove the second run creates no duplicate order/link or payment confirmation. Stop if preflight indicates an unsafe non-idempotent candidate.**

- [ ] **Step 7: Manually start `lmv-opportunities.service` while channel read-only controls are unchanged; assert 2xx and unchanged outbound-message counts.**

- [ ] **Step 8: Outside the 13:00 UTC safety window, atomically save the current `opportunity_cart_cutover` boolean, set it true, start `lmv-abandoned-carts.service`, and restore the exact prior boolean in an unconditional trap.**

- [ ] **Step 9: Assert the cart test returns 2xx with zero sends, does not change contacted-cart or outbound-message counts, and leaves all runtime/channel controls exactly as before.**

- [ ] **Step 10: Verify journals contain required safe fields but no secret sentinel, token, PII, or response body; verify `already_running` with a controlled concurrent runner test.**

- [ ] **Step 11: Stop on any 401/403/5xx, unexpected mutation, missing gate restoration, duplicate, or outbound delivery. Leave Vercel schedules active and do not proceed to Task 5.**

### Task 5: Create the identifiable cutover commit and remove only Vercel schedules

**Files:**
- Modify: `vercel.json`
- Modify: `docs/operations/2026-09-29-vercel-cron-vps-cutover.md`

**Interfaces:**
- Consumes: passing Task 4 evidence with all VPS timers disabled.
- Produces: a cutover commit whose parent is the one-command rollback target.

- [ ] **Step 1: Record the pre-cutover commit, last retrievable Vercel execution (or explicitly `not retained` plus last expected scheduled instant), planned disable UTC time, and first future VPS run for each job.**

- [ ] **Step 2: Remove exactly the three entries from `vercel.json`, leaving endpoints and `CRON_SECRET` untouched.**

- [ ] **Step 3: Run the focused tests, full tests, lint, and production build.**

Run: `node --test test/order-reconcile-vercel-cron.test.ts test/vps-systemd-cron-migration.test.ts && npm test && npm run lint && npm run build`

Expected: all commands PASS.

- [ ] **Step 4: Commit the scheduler cutover separately and record its parent as rollback commit.**

```bash
git add vercel.json docs/operations/2026-09-29-vercel-cron-vps-cutover.md
git commit -m "ops: move production cron schedules to VPS"
```

### Task 6: Deploy the no-overlap cutover and enable VPS timers

**Files:**
- Update evidence/runbook only with sanitized timestamps/statuses.

**Interfaces:**
- Consumes: Task 5 cutover commit and Task 4 disabled/validated VPS services.
- Produces: zero Vercel schedules and three enabled persistent VPS timers.

- [ ] **Step 1: Deploy the exact Task 5 commit to Vercel Production and wait for Ready.**

- [ ] **Step 2: Run `vercel crons ls` and require that none of the three paths exists; if any remains, do not enable VPS timers.**

- [ ] **Step 3: Record the Vercel-disable UTC timestamp, then `systemctl enable --now` the three timers and record the VPS-enable UTC timestamp.**

- [ ] **Step 4: Verify `is-enabled`, `is-active`, `Persistent=true`, and `systemctl list-timers --all`; compare next triggers against 08:00/13:00/14:00 UTC, not server local time.**

- [ ] **Step 5: Restart only the three timer units and reconfirm active/enabled state and unchanged next trigger; do not reboot the VPS.**

- [ ] **Step 6: Install/apply the 256 MiB/1 GiB/30-day journal retention drop-in and reload/restart journald without rebooting.**

### Task 7: Verify production, monitoring, state invariants, and rollback readiness

**Files:**
- Finalize: `docs/operations/2026-09-29-vercel-cron-vps-cutover.md`

**Interfaces:**
- Consumes: live state after Task 6.
- Produces: final audit table and verified rollback instructions.

- [ ] **Step 1: Run the existing `lmv-supabase-healthcheck.service`; require success, eleven healthy Supabase containers, three healthy cron timers, fresh backup, acceptable disk, and acceptable memory.**

- [ ] **Step 2: Verify the canonical web returns 2xx and perform read-only smoke tests for Auth session handling, catalog/product access, and the checkout read/calculation path; do not create a payment or purchase.**

- [ ] **Step 3: Reconfirm Remy OFF, WhatsApp and Instagram ON/READ_ONLY, Meta Pixel ON, Meta CAPI ON, and unchanged channel/runtime flags.**

- [ ] **Step 4: Verify each endpoint still returns 401 without a secret and that the services use the protected environment file; verify the secret is absent from Git, process arguments, systemd unit text, and journal.**

- [ ] **Step 5: Run final repository tests and review `git diff`/`git status`, preserving `supabase/.temp/`.**

- [ ] **Step 6: Pressure-test rollback without executing it: confirm disabling three timers precedes restoration/redeploy of the pre-cutover `vercel.json`, and that Vercel schedules would be verified before leaving rollback mode.**

- [ ] **Step 7: Commit only the sanitized final operations report, if it changed, and push the deployed commits.**

- [ ] **Step 8: Deliver the required `Job | Antes | Ahora | Schedule | Última prueba | Estado` table, unit/timer mappings, next runs, durations, auth/log/health evidence, environment-file path/mode, deployed commit, Vercel state, VPS state, and rollback commit. End with the exact success or failure terminal phrase from the specification.**
