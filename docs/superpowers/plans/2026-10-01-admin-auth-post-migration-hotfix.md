# Admin Auth Post-Migration Hotfix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore production admin password recovery on self-hosted Supabase, force canonical-domain redirects, and block callback open redirects without changing unrelated systems.

**Architecture:** Keep password authentication in Supabase Auth and preserve the migrated user/hash. Centralize the admin recovery URL and callback target validation in a pure module, then correct only the effective GoTrue URL/SMTP configuration and recreate only the Auth container. Deploy the tested web artifact, send one controlled recovery email, and stop when the administrator must choose the new password.

**Tech Stack:** Next.js 16.2.9 App Router, React 19, TypeScript, `@supabase/ssr`, Supabase Auth/GoTrue v2.196.0, Docker Compose, Vercel.

**Spec:** `C:/Users/usuario/.codex/attachments/f19f21cb-ae5c-4b43-8b74-444ce8f3b00f/pasted-text.txt`

## Global Constraints

- Never print or persist passwords, password hashes, recovery tokens, JWTs, SMTP credentials, or API secrets.
- Do not modify the managed Supabase project or reset a password directly in SQL.
- Preserve Remy OFF; Meta CAPI/Pixel ON; WhatsApp/Instagram ON/READ_ONLY; VPS timers; Mercado Pago; orders, stock, and customers.
- Do not reboot the VPS; recreate only the Auth service if its effective configuration changes.
- Production recovery must use `https://lamanitodelvegano.cl` and never use a Vercel deployment, managed Supabase host, or localhost as fallback.
- Stop once a human must enter the new password.

## Review Focus

- `next=https://evil.example`, protocol-relative values, and backslash variants must never leave the canonical host.
- A recovery request from a Vercel preview must still target the canonical production callback.
- Missing or malformed `next` values must fall back to `/admin/productos`.
- The production callback with `next=/admin/update-password` must survive code exchange and cookie writes.
- GoTrue must keep SMTP configured while changing only canonical URL/allowlist values.

---

### Task 1: Canonical recovery URL and safe callback target

**Files:**
- Create: `src/lib/auth/admin-auth-redirects.ts`
- Modify: `src/app/(auth)/admin/login/page.tsx`
- Modify: `src/app/(auth)/admin/callback/route.ts`
- Test: `test/admin-auth-recovery.test.ts`

**Interfaces:**
- Produces: `adminRecoveryRedirectUrl(): string` and `safeAdminCallbackPath(raw: string | null): string`.
- Consumes: `OFFICIAL_SITE_URL` from `src/lib/site-url.ts`.

- [ ] **Step 1: Write failing tests for canonical recovery, valid update-password callback, missing fallback, and external/protocol-relative/backslash rejection.**
- [ ] **Step 2: Run `node --test test/admin-auth-recovery.test.ts` and verify failures are caused by missing helpers/current unsafe code.**
- [ ] **Step 3: Implement the pure helpers and use them from login and callback.**
- [ ] **Step 4: Run the focused test and verify it passes.**
- [ ] **Step 5: Commit the application hotfix.**

### Task 2: Correct effective GoTrue production URLs

**Files:**
- Modify outside Git on VPS: `/opt/supabase-lamanito/stack/.env`
- Create outside Git on VPS: root-only timestamped `.env` backup
- Create: `docs/operations/2026-10-01-admin-auth-recovery-hotfix.md`

**Interfaces:**
- Consumes: exact canonical callback produced by Task 1.
- Produces: `SITE_URL=https://lamanitodelvegano.cl` and an allowlist limited to the required canonical callback URLs.

- [ ] **Step 1: Capture sanitized before-state and health evidence.**
- [ ] **Step 2: Back up `.env`, update only `SITE_URL` and `ADDITIONAL_REDIRECT_URLS`, and recreate only Auth.**
- [ ] **Step 3: Verify effective container environment, SMTP presence/connectivity, Auth health, and absence of Vercel/managed/localhost fallbacks.**
- [ ] **Step 4: Record sanitized evidence in the operation report.**

### Task 3: Deploy and controlled production recovery proof

**Files:**
- Modify: operation report from Task 2

**Interfaces:**
- Consumes: tested application artifact and corrected GoTrue configuration.
- Produces: one production recovery request whose email URL hostname/path are canonical, with no token logged.

- [ ] **Step 1: Run focused tests, full suite, lint/type/build verification.**
- [ ] **Step 2: Commit, deploy to Vercel Production, and verify the canonical login/callback paths.**
- [ ] **Step 3: Submit one recovery request for the existing administrator and verify delivery plus canonical hostname/path without recording the token.**
- [ ] **Step 4: Stop at the new-password form for manual password entry; after the user confirms, verify login and `/admin/productos`.**
- [ ] **Step 5: Finalize the incident matrix and commit/deployment identifiers.**

