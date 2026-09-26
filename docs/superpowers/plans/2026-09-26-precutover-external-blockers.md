# Precutover External Blockers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve or precisely hand off the remaining Meta, SMTP, Mercado Pago, and offline-escrow blockers without cutting Production over.

**Architecture:** Security-sensitive policy is moved into small pure helpers with behavioral tests, while provider secrets remain outside Git and Production. Preview-safe Meta reconnection may write only the self-hosted connection records and uses provider GET/read-only checks; webhook subscription and outbound remain disabled. External provider setup is completed only through authenticated human handoff points.

**Tech Stack:** Next.js 16, TypeScript, Node test runner, Supabase self-hosted v0.8.1/PostgreSQL 17, Vercel Preview, Docker Compose, Meta Graph API, Mercado Pago Webhooks, SMTP.

**Spec:** `docs/superpowers/specs/2026-09-26-precutover-external-blockers.md`

## Global Constraints

- Never mutate Vercel Production, production webhooks, public DNS, managed Supabase, or payment/outbound state.
- Never print, log, or commit secrets.
- Keep public signup disabled and all messaging/CAPI side effects off.
- Preserve historical Meta connection rows.
- Pause for the user at authentication, OAuth consent, credential creation, domain verification, mailbox, and physical-media steps.

## Review Focus

- An absent Mercado Pago secret must return a configuration failure before a payment lookup.
- Missing or incorrect cron authorization must always return 401, even when `CRON_SECRET` is absent.
- Preview Meta reconnection must not call the provider webhook-subscription POST endpoint.
- New Meta credentials must be decryptable while old ciphertext remains retained as history.
- SMTP reset links must target the self-hosted callback and remain single-use while signup stays disabled.

---

### Task 1: Fail-closed payment and cron guards

**Files:**
- Create: `src/lib/payments/mercadopago-webhook-signature.ts`
- Create: `src/lib/security/cron-authorization.ts`
- Create: `test/precutover-secret-guards.test.ts`
- Modify: `src/lib/payments/mercadopago.ts`
- Modify: `src/app/api/pagos/mercadopago-webhook/route.ts`
- Modify: `src/app/api/cron/carritos-abandonados/route.ts`
- Modify: `src/app/api/cron/sales-opportunities/route.ts`
- Modify: `src/app/api/cron/reconcile-pending-sales/route.ts`

**Interfaces:**
- Produces: `validateMercadoPagoWebhookSignature(input): boolean`; `hasValidCronAuthorization(authorization, secret): boolean`.
- Consumes: standard Mercado Pago `x-signature` manifest and Vercel `Authorization: Bearer <CRON_SECRET>`.

- [ ] Write behavioral tests for missing/invalid/valid Mercado Pago signatures and missing/invalid/valid cron secrets.
- [ ] Run the focused tests and verify they fail because the pure guards do not yet exist/fail open.
- [ ] Implement the pure guards and route-level 503 for missing Mercado Pago secret.
- [ ] Use the cron guard in all three routes so missing configuration fails closed.
- [ ] Run focused and full tests, then commit.

### Task 2: Read-only Meta reconnection policy

**Files:**
- Create: `src/lib/meta/reconnect-policy.ts`
- Create: `test/meta-reconnect-read-only.test.ts`
- Modify: `src/app/api/meta/assets/select/route.ts`
- Modify: `src/app/admin/integraciones/MetaConnectionPanel.tsx`

**Interfaces:**
- Produces: `metaReconnectReadOnly(environment): boolean` and an asset-selection response containing `mode: 'read_only' | 'live'`.
- Consumes: `LMV_PREVIEW_SAFE_MODE`, `META_SEND_MODE`, and the existing encrypted Meta connection.

- [ ] Write tests proving Preview/safe mode is read-only and explicit live mode is required for webhook subscription.
- [ ] Run the focused test and verify RED.
- [ ] Implement the policy; in read-only mode use only token/asset GET checks, never `subscribeMetaPages`.
- [ ] Keep assets locally selected, activate the new connection, archive older active Meta rows, and report read-only status accurately in the UI.
- [ ] Run focused and full tests, then commit.

### Task 3: Secure Preview/future-cutover configuration

**Files:**
- Create outside Git: protected one-shot provisioning script and encrypted/local escrow only if necessary.
- Modify outside Git: branch-scoped Vercel Preview secret configuration and root-only VPS future-cutover secret file.

**Interfaces:**
- Produces: the same new 32-byte base64 key in Preview and protected future-cutover storage, without emitting it.
- Consumes: Vercel CLI authenticated project linkage and VPS SSH/sudo.

- [ ] Inventory relevant Vercel scopes by name/presence only and verify Production remains untouched.
- [ ] Generate the key in memory; validate decoded length without printing a fingerprint or value.
- [ ] Store it as a sensitive variable only for Preview branch `staging/supabase-self-hosted` and in a root-only future-cutover file on the VPS.
- [ ] Redeploy only Preview and confirm safe-mode variables remain active.
- [ ] Verify the key is present/nonempty at both destinations without displaying it.

### Task 4: Provider discovery and human handoffs

**Files:**
- Modify outside Git only after human action: Meta OAuth connection rows, SMTP `.env`, Mercado Pago secure Preview/future-cutover variable.
- Create: `docs/operations/2026-09-26-precutover-external-blockers-result.md`

**Interfaces:**
- Consumes: authenticated Meta, email-provider, Mercado Pago, and administrator-mailbox sessions.
- Produces: non-sensitive OK/ERROR evidence and exact remaining handoffs.

- [ ] Inspect existing provider accounts/configuration read-only and identify the legitimate SMTP option.
- [ ] Stop for Meta/Facebook and Instagram OAuth consent; after return validate decryptability, selected assets, scopes, and expiry read-only.
- [ ] Stop for SMTP account/domain/credential action; configure self-hosted Auth and prove one controlled password reset.
- [ ] Stop for Mercado Pago Webhooks secret reveal/create; store only in secure non-Production/future-cutover scopes and run a signed controlled test.
- [ ] Verify Gemini presence, all three crons, escrow integrity, containers, Preview E2E, tests, type-check, and build.
- [ ] Record the component matrix and binary verdict; do not run the final delta or cutover.
