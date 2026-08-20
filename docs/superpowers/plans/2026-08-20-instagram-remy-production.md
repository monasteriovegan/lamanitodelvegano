# Instagram and Remy Production Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the existing shared Instagram/WhatsApp commerce pipeline, Meta app identity, legitimate external verification, and production-readiness evidence without duplicating architecture or changing protected advertising assets.

**Architecture:** Instagram remains a thin Meta adapter that emits the existing `NormalizedMessage` contract and uses the shared persistence, CRM, Remy, cart, order, and outbound layers. External configuration work is isolated from code tasks, and every external result is classified by evidence level rather than inferred from an HTTP 200.

**Tech Stack:** Next.js 16 App Router, TypeScript, Node test runner, Supabase/Postgres, Meta Graph API, Vercel, Google Workspace/DNS.

**Spec:** `docs/superpowers/specs/2026-08-20-instagram-remy-production-design.md`

## Global Constraints

- Do not modify Meta app `1388581679803769`.
- Preserve Dataset/Pixel `1982469039131019` and ad account `2925426834477416`.
- Do not modify campaigns, budgets, ads, creatives, or advertising strategy.
- Do not accept Tech Provider without later explicit authorization.
- Do not incur Google Workspace charges without approval after showing price details.
- Do not generate fake payments, purchases, or `Purchase` events.
- Preserve `event_name = Purchase` and `event_id = purchase_<orderId>` for real paid orders only.
- Never expose or log access tokens, app secrets, database secrets, passwords, or verification tokens.
- Use the official attached logo without AI reinterpretation.

---

### Task 1: Baseline and WhatsApp failure characterization

**Files:**
- Inspect: `package.json`
- Inspect: `test/*.test.ts`
- Inspect: `src/app/api/whatsapp/route.ts`
- Inspect: `src/lib/ai/remy*.ts`
- Modify only after RED evidence: the source file responsible for the reproduced failure
- Test: the existing failing test file

**Interfaces:**
- Consumes: current branch at or after `c7a004f`
- Produces: a clean baseline or a minimal root-cause fix with a regression test

- [ ] **Step 1: Capture the baseline**

Run `npm test` and retain the exact failing test name, assertion, stack, and total count.

- [ ] **Step 2: Trace the failing value**

Read the failing test and follow its inputs through the WhatsApp route, normalization, persistence, Remy invocation, and output boundary. Compare the failing path with the closest passing test.

- [ ] **Step 3: State one root-cause hypothesis**

Record in the task notes: `The test fails because <source behavior>, evidenced by <trace>; the expected contract is <contract>.`

- [ ] **Step 4: Establish RED**

If the existing assertion represents the required contract, run only that test and verify it fails for the hypothesized reason. If the fixture is invalid, add a new minimal regression case that exercises the valid contract and verify it fails before production changes.

- [ ] **Step 5: Implement the minimal fix and verify GREEN**

Change only the root-cause location, rerun the focused test, then `npm test`.

- [ ] **Step 6: Commit**

Commit only if a production or test correction was necessary, using `fix: correct Remy WhatsApp <root cause>`.

### Task 2: Official Meta icon asset

**Files:**
- Source: `C:/Users/usuario/Downloads/WhatsApp Image 2026-06-21 at 12.49.17 PM.jpeg`
- Create: `public/meta/app-icon-1024.png`
- Create: `public/meta/README.md`

**Interfaces:**
- Consumes: the authorized JPEG logo
- Produces: a 1024×1024 RGB/RGBA PNG whose complete outer circle is visible

- [ ] **Step 1: Inspect source dimensions and color mode**

Use a read-only image inspection and visually confirm the source matches the user-provided official logo.

- [ ] **Step 2: Convert mechanically**

Resize proportionally to fit inside 1024×1024, preserve the full image, center it on a neutral background matching the source edge, and do not redraw or generatively alter any element.

- [ ] **Step 3: Verify the artifact**

Assert width `1024`, height `1024`, format `PNG`, and mode `RGB` or `RGBA`; visually inspect the output and confirm the outer circle is not clipped.

- [ ] **Step 4: Document provenance**

Record the exact source filename, authorization date, mechanical operations, output dimensions, and prohibition on AI reinterpretation in `public/meta/README.md`.

- [ ] **Step 5: Commit**

Run `git diff --check`, then commit with `assets: add official Meta app icon`.

### Task 3: Meta Basic Settings

**Files:**
- Update: `docs/DOMINIO-META-PRODUCCION.md`
- Update: `docs/META-APP-REVIEW.md`

**Interfaces:**
- Consumes: `public/meta/app-icon-1024.png` and authenticated Meta session
- Produces: saved category and icon on app `1691394752113175`, with screenshot/visible evidence

- [ ] **Step 1: Reopen the principal app Basic Settings**

Confirm the visible App ID is `1691394752113175` before any mutation.

- [ ] **Step 2: Save the authorized category**

Select exactly `Negocios y páginas` when present; otherwise stop and document the current choices before selecting an equivalent.

- [ ] **Step 3: Upload the official icon**

Upload `public/meta/app-icon-1024.png`, save, reload, and visually verify the saved icon and category.

- [ ] **Step 4: Preserve email gating**

Leave Contact Email unchanged unless `contacto@lamanitodelvegano.cl` has passed a real inbound test.

- [ ] **Step 5: Document and commit**

Update both Meta documents with timestamped evidence and commit `docs: record Meta app identity completion`.

### Task 4: Production Meta and webhook audit

**Files:**
- Update: `docs/META-APP-REVIEW.md`
- Update: `docs/DOMINIO-META-PRODUCCION.md`

**Interfaces:**
- Consumes: existing tokens and authenticated Meta/Vercel sessions without printing secrets
- Produces: evidence for Page, IG account, scopes, subscriptions, fields, app mode, access state, and delivery level

- [ ] **Step 1: Verify immutable identities**

Confirm Page `1210803402107834`, Instagram `17841419477422736`, principal app `1691394752113175`, and Dataset `1982469039131019`.

- [ ] **Step 2: Audit Graph authorization safely**

Use metadata/debug endpoints or existing internal diagnostics that do not send messages or purchases. Record only scope names, asset IDs, expiry/status, and HTTP codes.

- [ ] **Step 3: Audit webhook configuration**

Verify callback URL, GET challenge behavior, Page/app subscriptions, subscribed fields, app mode, Advanced Access, and Access Verification.

- [ ] **Step 4: Review production logs**

Inspect post-deployment logs for Instagram/WhatsApp/Meta CAPI errors and scan for accidental token-bearing log statements without displaying secret values.

- [ ] **Step 5: Document and commit**

Classify endpoint, subscription, Meta test event, real tester DM, and external production DM independently; commit `docs: audit Meta Instagram production state`.

### Task 5: Instagram normalization coverage

**Files:**
- Modify: `test/messaging.test.ts`
- Modify: `src/lib/messaging/types.ts` only if the current contract cannot express attachment metadata
- Modify: `src/lib/messaging/normalize.ts`

**Interfaces:**
- Consumes: `normalizeMetaInstagram(payload: unknown): NormalizedMessage[]`
- Produces: stable normalized text, attachments, unsupported fallback, echo direction, and provider IDs

- [ ] **Step 1: Write RED tests**

Add focused tests for inbound text, image/video/audio attachment classification, unsupported attachment fallback, missing IDs, and business-originated echoes. Each assertion must target returned `NormalizedMessage` fields rather than source text.

- [ ] **Step 2: Verify RED**

Run `node --test test/messaging.test.ts` and confirm only the newly unsupported behavior fails.

- [ ] **Step 3: Implement minimal normalization**

Extend `messageText`, `messageType`, or the normalized contract only as required by the failed assertions. Preserve `provider_message_id = message.mid`, `external_thread_id = counterpartyId`, and `sender_type = human` for echoes.

- [ ] **Step 4: Verify GREEN**

Run the focused file and then `npm test`.

- [ ] **Step 5: Commit**

Commit `feat: complete Instagram message normalization`.

### Task 6: Instagram webhook orchestration and idempotency

**Files:**
- Create or modify: focused webhook test file under `test/`
- Modify: `src/app/api/instagram/route.ts`
- Modify: shared orchestration helper only if direct route testing proves coupling prevents behavior tests

**Interfaces:**
- Consumes: normalized messages and `persistMessage`
- Produces: one persistence operation and at most one Remy invocation per new eligible inbound message

- [ ] **Step 1: Write RED tests**

Cover valid and invalid GET verification, invalid signature, duplicate deliveries, self-message protection, persistence-before-AI, Remy disabled, and human takeover.

- [ ] **Step 2: Verify RED**

Run only the new webhook tests and confirm failures correspond to missing orchestration behavior.

- [ ] **Step 3: Implement minimal orchestration**

Keep the HTTP route thin. Process only `direction === inbound`, skip AI when `persistMessage().duplicate` is true, and require the existing Instagram automation authorization plus no takeover.

- [ ] **Step 4: Verify GREEN**

Run focused tests, `npm test`, and `npx tsc --noEmit`.

- [ ] **Step 5: Commit**

Commit `fix: make Instagram webhook processing idempotent`.

### Task 7: CRM, conversation, cart, and order integration

**Files:**
- Test: `test/repositories.test.ts` or a new focused commerce test file
- Modify only when RED identifies a gap: repositories and `src/lib/ai/remy-commerce.ts`
- Modify migration only if the production schema lacks an essential additive constraint

**Interfaces:**
- Consumes: `PersistedMessage` with `conversationId` and `customerId`
- Produces: durable Instagram contact, conversation, cart state, and order association through existing schemas

- [ ] **Step 1: Map existing functions and schema capabilities**

Identify the exact existing calls for identity resolution, conversation upsert, cart retrieval/update, order creation, and conversation-order association.

- [ ] **Step 2: Write RED behavior tests for demonstrated gaps**

Test new Instagram contact creation, existing identity update, multi-product cart preservation, confirmed order creation, and conversation/customer association. Do not add tests for behavior already passing unless they document a regression boundary.

- [ ] **Step 3: Verify RED and implement minimally**

Run focused tests, implement only the missing shared behavior, and avoid channel-specific commerce services.

- [ ] **Step 4: Verify GREEN**

Run focused tests, `npm test`, and `npx tsc --noEmit`.

- [ ] **Step 5: Commit**

Commit `feat: connect Instagram conversations to shared commerce` only if changes were needed.

### Task 8: Instagram outbound reliability and safe logging

**Files:**
- Test: focused transport test under `test/`
- Modify: `src/lib/messaging/transports/instagram-meta.ts`
- Modify: `src/lib/messaging/send.ts` if shared result metadata is incomplete

**Interfaces:**
- Consumes: `{to: string, text: string}` plus `{manual?: boolean, automatic?: boolean}`
- Produces: provider message ID on success and sanitized typed errors on failure

- [ ] **Step 1: Write RED tests**

Cover disabled real sends, manual/authorized automatic sends, HTTP 400/401/403, HTTP 429, retryable 5xx, and sanitization that excludes access tokens and full response bodies.

- [ ] **Step 2: Verify RED**

Run the focused transport tests and confirm the expected contract gaps.

- [ ] **Step 3: Implement minimal error classification**

Return success identifiers and throw errors containing stable category and HTTP status only. Retry only explicitly retryable failures with a bounded strategy; never retry permission failures.

- [ ] **Step 4: Verify GREEN**

Run focused tests, full tests, typecheck, and grep changed logging statements for `token`, `authorization`, and raw request bodies.

- [ ] **Step 5: Commit**

Commit `fix: harden Instagram outbound delivery`.

### Task 9: Purchase regression and CAPI safety

**Files:**
- Test: `test/tracking.test.ts`
- Inspect/modify only on RED: `src/lib/meta/conversions-api.ts`, payment webhooks, and `src/app/pedido/[id]/PurchaseTracking.tsx`

**Interfaces:**
- Consumes: real order state transitions
- Produces: one deduplicated browser/server `Purchase` only after paid

- [ ] **Step 1: Run existing tracking tests**

Verify Dataset ID, server-only token usage, paid-state gating, exact event name, exact event ID, attribution preservation, and safe logs.

- [ ] **Step 2: Add RED only for uncovered requirements**

Add behavior assertions for any uncovered requirement and verify they fail before modifying production code.

- [ ] **Step 3: Apply minimal correction and verify**

Run `node --test test/tracking.test.ts`, then the full suite. Do not call Meta's events endpoint with a fake purchase.

- [ ] **Step 4: Safe authorization probe**

Use the existing non-purchase CAPI status/authorization mechanism and production logs to classify authorization without emitting an event.

- [ ] **Step 5: Commit if needed**

Commit `fix: preserve paid-only Purchase deduplication` only when production changes are required.

### Task 10: Google Workspace preparation and DNS

**Files:**
- Update: `docs/DOMINIO-META-PRODUCCION.md`

**Interfaces:**
- Consumes: authenticated Google/Vercel sessions and current authoritative DNS
- Produces: either a real tested mailbox or an exact payment/action blocker

- [ ] **Step 1: Audit authoritative DNS**

Record current NS, MX, SPF, DKIM, and DMARC without mutation.

- [ ] **Step 2: Follow the official Workspace signup**

Use business/domain data already confirmed. Stop before any paid commitment and report visible plan, price, period, and taxes.

- [ ] **Step 3: Configure only exact Google values after authorization**

Create `contacto@lamanitodelvegano.cl`; publish exact MX, SPF, and generated DKIM. Publish initial DMARC observation only after SPF/DKIM are present.

- [ ] **Step 4: Test mail bidirectionally**

Receive from an external account and reply from the corporate mailbox. Do not configure Meta Contact Email before both mailbox identity and inbound receipt are verified.

- [ ] **Step 5: Document and commit**

Commit `docs: record corporate email configuration state`.

### Task 11: Legitimate E2E and App Review evidence

**Files:**
- Update: `docs/META-APP-REVIEW.md`
- Update: `docs/DOMINIO-META-PRODUCCION.md`

**Interfaces:**
- Consumes: deployed verified code and legitimate Meta accounts/tools
- Produces: a truthful evidence matrix and precise external blockers

- [ ] **Step 1: Deploy the verified commit**

Confirm the production deployment SHA and environment mapping without printing values.

- [ ] **Step 2: Execute the highest legitimate test available**

Prefer a real app-role tester DM `Hola Remy`. If unavailable, use Meta's webhook test and label it as simulated transport only.

- [ ] **Step 3: Trace the event end to end**

Check webhook delivery, sanitized logs, database message, conversation, CRM contact, Remy invocation, outbound result, cart, and order association. Do not pay or emit `Purchase`.

- [ ] **Step 4: Prepare App Review**

Record only demonstrated functionality, current permissions, Advanced Access, Access Verification, app mode, and the exact blocker. Do not accept Tech Provider.

- [ ] **Step 5: Commit**

Commit `docs: finalize Instagram App Review evidence`.

### Task 12: Final verification and handoff

**Files:**
- Update: mission documentation only where fresh evidence changes status

**Interfaces:**
- Consumes: all preceding commits and production evidence
- Produces: verified final report in the user's required template

- [ ] **Step 1: Inspect repository state and secret safety**

Run `git status --short`, `git diff --check`, and targeted secret/log scans. Never print secret file contents or environment values.

- [ ] **Step 2: Run full local verification**

Run `npx tsc --noEmit`, `npm run lint`, `npm test`, and `npm run build`; capture exit codes and exact failure counts.

- [ ] **Step 3: Verify production endpoints and logs**

Confirm canonical domain, webhook GET behavior, safe CAPI authorization status, deployment logs, and absence/presence of Meta 400/401/403 errors.

- [ ] **Step 4: Reconcile every acceptance criterion**

Classify each Meta/Instagram/CRM/Remy/cart/order/WhatsApp/Workspace item as proven, blocked, or not attempted, with direct evidence.

- [ ] **Step 5: Commit final documentation**

Commit `docs: report production readiness evidence` if documentation changed.
