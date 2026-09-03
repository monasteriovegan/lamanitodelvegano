# Admin Messaging & CRM Observations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the admin CRM accurately represent WhatsApp/Instagram conversations, enrich Instagram customers with their real username/name, and make CRM counts truthful without changing existing customer/order data.

**Architecture:** Keep provider status notifications as transport metadata rather than chat bubbles, enrich Instagram identities server-side with the active Instagram Login credential after authenticated webhook persistence, and filter personal contacts from the CRM list while exposing an explicit contacts-vs-customers count. Preserve the current channel-specific Remy policy: the existing top switch is WhatsApp-only; make that distinction clearer rather than silently changing Instagram automation semantics.

**Tech Stack:** Next.js App Router, TypeScript, Supabase/Postgres, Meta WhatsApp Cloud API, Instagram API with Instagram Login, Node test runner.

**Spec:** Live production observations reported 2026-09-03 and root-cause evidence gathered from production DB/runtime plus current Meta API documentation.

## Global Constraints

- Do not expose Meta access tokens, app secrets, HMAC values, verify tokens, or encryption keys.
- Do not weaken webhook HMAC verification.
- A failed Instagram profile lookup must never fail or delay message persistence.
- Do not delete or fabricate CRM contacts, messages, orders, or payments.
- Personal contacts remain excluded from CRM/Remy behavior.
- Status notifications (`status:*`) remain persisted/usable for delivery state but are not rendered as standalone chat messages.
- Existing WhatsApp global AI toggle remains WhatsApp-only; Instagram is controlled by Remy runtime channel metadata plus per-conversation safety gates.

---

### Task 1: Hide orphan WhatsApp status notifications from chat UI

**Files:**
- Modify: `src/app/api/admin/conversations/route.ts`
- Modify: `src/app/api/admin/conversations/[id]/messages/route.ts`
- Test: `test/admin-conversation-message-visibility.test.ts`

**Interfaces:**
- Consumes: `omnichannel_messages.message_type` values.
- Produces: admin conversation list/message APIs containing conversational content only, while status data remains in storage.

- [ ] **Step 1: Write the failing test**

Create a source-contract regression test asserting both admin queries exclude `message_type` values prefixed with `status:` from UI datasets, while persistence code remains untouched.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/admin-conversation-message-visibility.test.ts`
Expected: FAIL because current admin APIs return status rows.

- [ ] **Step 3: Write minimal implementation**

Add `.not('message_type', 'like', 'status:%')` to the admin conversation-list message query and conversation-message query. Do not alter webhook persistence or provider status updates.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- test/admin-conversation-message-visibility.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

Commit message: `fix: hide provider status rows from conversation UI`

---

### Task 2: Enrich Instagram contacts from the Instagram User Profile API

**Files:**
- Create: `src/lib/meta/instagram-profile.ts`
- Modify: `src/app/api/instagram/route.ts`
- Modify: `src/lib/repositories/customers-repository.ts`
- Test: `test/instagram-profile-enrichment.test.ts`

**Interfaces:**
- Consumes: authenticated inbound Instagram scoped user ID, business unit ID, active `meta_instagram_login` credential.
- Produces: `{ name: string | null; username: string | null }` profile enrichment and safe contact metadata update.

- [ ] **Step 1: Write the failing test**

Create tests requiring a server-only profile helper to call `https://graph.instagram.com/<version>/<IGSID>?fields=name,username` with the token only in the Authorization header, plus webhook integration that performs enrichment only after a verified inbound message is persisted and catches lookup failures.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/instagram-profile-enrichment.test.ts`
Expected: FAIL because the profile helper and enrichment call do not exist.

- [ ] **Step 3: Write minimal implementation**

Implement `fetchInstagramUserProfile(accessToken, scopedUserId)` and a repository method that updates `display_name`, `nombre`, and `metadata.instagram_username` only when non-empty profile fields are returned. In the Instagram webhook, after `persistMessage` succeeds for a non-duplicate inbound message, resolve the active Instagram Login credential for the already-resolved business unit and enrich the contact in a `try/catch`; never fail the webhook on profile errors.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- test/instagram-profile-enrichment.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

Commit message: `feat: enrich Instagram CRM contacts with profile names`

---

### Task 3: Make CRM contact counts truthful

**Files:**
- Modify: `src/lib/repositories/customers-repository.ts`
- Modify: `src/app/admin/clientes/page.tsx`
- Test: `test/admin-customer-counts.test.ts`

**Interfaces:**
- Consumes: `omnichannel_contacts.metadata.personal`, `total_orders`.
- Produces: default CRM list excluding personal contacts, badge that distinguishes CRM contacts from customers with orders.

- [ ] **Step 1: Write the failing test**

Create a regression test asserting `CustomerRepository.list()` excludes contacts marked `metadata.personal=true` by default and the page labels the total as `contactos CRM` while separately deriving buyers from `total_orders > 0`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/admin-customer-counts.test.ts`
Expected: FAIL because current list returns all contacts and labels all of them `clientes registrados`.

- [ ] **Step 3: Write minimal implementation**

Filter personal contacts after mapping (without deleting them) and show `N contactos CRM · M clientes con pedidos` in the page header.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- test/admin-customer-counts.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

Commit message: `fix: distinguish CRM contacts from buying customers`

---

### Task 4: Clarify Remy channel controls in the admin UI

**Files:**
- Modify: `src/app/admin/conversaciones/ConversationsClient.tsx`
- Test: `test/admin-remy-channel-controls.test.ts`

**Interfaces:**
- Consumes: existing `ai.enabled` WhatsApp master, per-conversation `aiEnabled`, Instagram runtime channel configuration.
- Produces: UI copy that cannot be read as a global all-channel kill switch.

- [ ] **Step 1: Write the failing test**

Require the header/button/help copy to state explicitly that the master toggle controls WhatsApp only and that Instagram automation is controlled per conversation/agent channel configuration.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/admin-remy-channel-controls.test.ts`
Expected: FAIL until the wording is unambiguous in all relevant places.

- [ ] **Step 3: Write minimal implementation**

Rename the control to `Remy WhatsApp global ON/OFF` and add concise Instagram-specific explanatory copy near the channel controls. Do not change runtime behavior in this task.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- test/admin-remy-channel-controls.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

Commit message: `fix: clarify Remy WhatsApp-only master switch`

---

### Task 5: Detect WhatsApp Business App echo readiness

**Files:**
- Modify: `src/lib/meta/waba-subscription.ts`
- Modify: `src/lib/meta/setup-messaging.ts`
- Test: `test/meta-waba-subscription.test.ts`

**Interfaces:**
- Consumes: WABA subscription read-back and existing safe setup diagnostics.
- Produces: explicit coexistence echo readiness signal without falsely claiming app-originated WhatsApp messages are mirrored when `smb_message_echoes` has not been observed/configured.

- [ ] **Step 1: Write the failing test**

Extend the WABA/setup tests so setup reports `smb_message_echoes` readiness separately from the standard `messages` subscription and never treats status-only traffic as proof of app-message mirroring.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/meta-waba-subscription.test.ts`
Expected: FAIL because setup currently verifies only `messages`.

- [ ] **Step 3: Write minimal implementation**

Expose a safe `coexistenceEchoReady`/observed field from setup diagnostics based on subscription/read-back/observability. Do not mutate webhook subscriptions unless the current Meta API surface proves that mutation is supported for this field; preserve existing WABA `messages` subscription.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- test/meta-waba-subscription.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

Commit message: `fix: expose WhatsApp coexistence echo readiness`

---

### Task 6: Full verification and production rollout

**Files:**
- No new production behavior unless a failing verification proves a remaining defect.

**Interfaces:**
- Consumes: all prior tasks.
- Produces: production evidence for UI and provider flows.

- [ ] **Step 1: Run full CI locally/in GitHub Actions**

Run: `npm test`, TypeScript, worker syntax, lint, and build through repository CI.
Expected: all required steps successful.

- [ ] **Step 2: Review diff for secrets and scope**

Confirm no token/app secret/verify token/logged user message payload was added and no order/customer data mutation was introduced.

- [ ] **Step 3: Merge and deploy**

Merge only after CI passes; verify Vercel production deployment is READY on `lamanitodelvegano.cl`.

- [ ] **Step 4: Verify production UI/data**

Confirm status events no longer render as messages/previews; CRM count excludes personal contacts; a fresh Instagram DM resolves a profile name/username when Meta returns it; Remy control copy clearly distinguishes WhatsApp from Instagram.

- [ ] **Step 5: Verify WhatsApp coexistence separately**

Send one real message from the WhatsApp Business App. Confirm a new outbound message body appears in CRM. If `smb_message_echoes` is still absent, report the exact Meta subscription/configuration boundary rather than fabricating a success claim.
