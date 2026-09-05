# Remy Opportunity Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a safe multichannel sales-opportunity engine that detects recoverable Instagram/WhatsApp conversations, shows recommendations while Remy is off, and can execute tightly gated follow-ups when Remy is enabled.

**Architecture:** Keep detection, policy, messaging, persistence, execution, and attribution as separate units. Persist opportunities in one canonical `sales_opportunities` table keyed by business/conversation/stage, reuse existing `sendMessage`, `conversations`, `omnichannel_messages`, `carritos_abandonados`, `pedidos`, and Meta payloads, and deploy first in observation/copilot mode without automatically enabling Remy.

**Tech Stack:** Next.js App Router, TypeScript, Supabase/Postgres, Meta Instagram/WhatsApp messaging, Vercel cron, Node test runner.

**Spec:** `docs/superpowers/specs/2026-09-05-remy-opportunity-engine-design.md`

## Global Constraints

- Detector and executor remain separate.
- `ai_enabled = false` must never send an automatic follow-up.
- WhatsApp `read_only`/`disabled` must never send an automatic follow-up.
- `human_takeover`, personal contacts, paid/completed orders, opt-out/rejection, dismissed opportunities, and two previous automatic follow-ups all block automation.
- Continue on the customer's original channel; no cross-channel contact without explicit consent.
- Maximum two automatic follow-ups per opportunity.
- Do not invent price, stock, delivery date, discount, or read/ad signals.
- Do not break inbound webhook persistence when opportunity evaluation fails.
- Existing abandoned-cart recovery remains active until observation mode proves the new engine; never send duplicate recovery messages.
- Automatic Remy activation is separate from code deployment.

---

## File Structure

### New files
- `supabase/migrations/20260905090000_sales_opportunities.sql` — canonical opportunity schema, indexes, RLS/service-role protections.
- `src/lib/opportunities/types.ts` — stage/status/priority and DTO types.
- `src/lib/opportunities/detector.ts` — pure commercial-signal classification and scoring.
- `src/lib/opportunities/policy.ts` — timing, channel, anti-spam, human-takeover and send gates.
- `src/lib/opportunities/message.ts` — deterministic safe follow-up draft generation.
- `src/lib/opportunities/service.ts` — create/update/close/list opportunities.
- `src/lib/opportunities/runner.ts` — idempotent due-opportunity executor.
- `src/lib/opportunities/attribution.ts` — close/convert opportunities when an order appears.
- `src/app/api/admin/sales-opportunities/route.ts` — admin list API.
- `src/app/api/admin/sales-opportunities/[id]/route.ts` — dismiss/snooze/update-draft API.
- `src/app/api/admin/sales-opportunities/[id]/send/route.ts` — manual canonical send API.
- `src/app/api/cron/sales-opportunities/route.ts` — scheduled detector/runner endpoint.
- `src/app/admin/oportunidades/page.tsx` — CRM opportunity inbox.
- `src/app/admin/oportunidades/OpportunityActions.tsx` — client actions for send/edit/snooze/dismiss.
- `test/remy-opportunity-detector.test.ts`
- `test/remy-opportunity-policy.test.ts`
- `test/remy-opportunity-message.test.ts`
- `test/remy-opportunity-service-contract.test.ts`
- `test/remy-opportunity-runner-contract.test.ts`
- `test/admin-sales-opportunities.test.ts`
- `test/remy-opportunity-attribution.test.ts`

### Existing files to modify
- `src/lib/messaging/messages.ts` — non-blocking reevaluation hook after persisted message.
- `src/app/api/instagram/route.ts` — persist normalized referral/ad context when present; no dependency on it.
- `src/lib/messaging/normalize.ts` — normalize Instagram referral/ad context into raw payload metadata without fabricating fields.
- `src/app/api/cron/carritos-abandonados/route.ts` — observation-mode bridge to opportunity engine while preserving current sender until cutover.
- `src/lib/orders/instagram-auto-sale.ts` and/or canonical order-creation integration point — invoke attribution after order creation without changing order semantics.
- `src/lib/repositories/orders-repository.ts` — call attribution only after successful persisted order creation if this is the canonical cross-channel point.
- `src/app/admin/AdminSidebar.tsx` and `src/app/admin/MobileAdminNav.tsx` — add “Oportunidades” navigation.
- `vercel.json` — add opportunity cron at a safe cadence.

---

### Task 1: Canonical opportunity schema

**Files:**
- Create: `supabase/migrations/20260905090000_sales_opportunities.sql`
- Test: `test/remy-opportunity-service-contract.test.ts`

**Interfaces:**
- Produces table `sales_opportunities` with status/stage/priority fields and one-open-opportunity uniqueness.

- [ ] **Step 1: Write the failing schema contract test**

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const sql = fs.readFileSync('supabase/migrations/20260905090000_sales_opportunities.sql', 'utf8');

test('sales opportunities schema has lifecycle and anti-duplicate constraints', () => {
  for (const token of ['sales_opportunities', 'conversation_id', 'business_unit_id', 'followup_count', 'next_followup_at', 'converted_order_id', 'converted_revenue']) {
    assert.match(sql, new RegExp(token));
  }
  assert.match(sql, /where\s+status\s+in\s*\([^)]*open[^)]*snoozed/is);
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npm test -- --test-name-pattern="sales opportunities schema"`
Expected: FAIL because migration file does not exist.

- [ ] **Step 3: Add migration**

Create enum-like CHECK constraints (not Postgres enum types) for:

```sql
status text not null check (status in ('open','snoozed','dismissed','converted','expired')),
priority text not null check (priority in ('high','medium','low')),
stage text not null check (stage in ('payment_pending','cart_abandoned','shipping_or_price_question','product_interest','general_interest')),
followup_count integer not null default 0 check (followup_count between 0 and 2)
```

Include business/conversation/customer/channel/source/reason/product-context/timing/conversion/audit columns from the spec; add indexes on `(business_unit_id,status,next_followup_at)`, `conversation_id`, `converted_order_id`; add a partial unique index on `(business_unit_id,conversation_id,stage)` for `status in ('open','snoozed')`. Enable RLS and grant no direct anon/authenticated mutation; service-role/admin server paths own writes.

- [ ] **Step 4: Run schema test GREEN**

Run: `npm test -- --test-name-pattern="sales opportunities schema"`
Expected: PASS.

- [ ] **Step 5: Apply migration on a Supabase development branch or transactional validation target before production**

Verify inserts/updates, uniqueness, max-two constraint, and rollback/branch disposal after smoke testing.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260905090000_sales_opportunities.sql test/remy-opportunity-service-contract.test.ts
git commit -m "feat: add sales opportunity schema"
```

---

### Task 2: Pure detector and scoring

**Files:**
- Create: `src/lib/opportunities/types.ts`
- Create: `src/lib/opportunities/detector.ts`
- Test: `test/remy-opportunity-detector.test.ts`

**Interfaces:**
- Produces `detectOpportunity(input: OpportunityDetectionInput): OpportunityDecision | null`.

- [ ] **Step 1: Write failing detector tests**

Cover exact cases:

```ts
assert.equal(detectOpportunity({ hasUnpaidOrder:true, hasCart:false, askedPrice:false, askedShipping:false, productMentioned:true, lastBusinessMessageAt:now, lastCustomerMessageAt:earlier, ...base })?.stage, 'payment_pending');
assert.equal(detectOpportunity({ hasUnpaidOrder:false, hasCart:true, cartSubtotal:23900, ...base })?.stage, 'cart_abandoned');
assert.equal(detectOpportunity({ askedPrice:true, askedShipping:true, productMentioned:true, ...base })?.priority, 'high');
assert.equal(detectOpportunity({ optedOut:true, ...base }), null);
assert.equal(detectOpportunity({ hasPaidOrder:true, ...base }), null);
```

- [ ] **Step 2: Run RED**

Run: `npm test -- --test-name-pattern="opportunity detector"`
Expected: FAIL because detector is missing.

- [ ] **Step 3: Implement deterministic scoring**

Use weighted facts, not LLM output:

```ts
payment_pending = 100;
cart_abandoned = 85;
shipping_or_price_question = 65;
product_interest = 45;
general_interest = 20;
adSourceBonus = 5;
```

Map score `>=80 -> high`, `>=40 -> medium`, otherwise `low`. Exclusions return `null` before scoring.

- [ ] **Step 4: Run detector tests GREEN**

- [ ] **Step 5: Commit**

```bash
git add src/lib/opportunities/types.ts src/lib/opportunities/detector.ts test/remy-opportunity-detector.test.ts
git commit -m "feat: detect recoverable sales opportunities"
```

---

### Task 3: Follow-up policy and safe message drafts

**Files:**
- Create: `src/lib/opportunities/policy.ts`
- Create: `src/lib/opportunities/message.ts`
- Test: `test/remy-opportunity-policy.test.ts`
- Test: `test/remy-opportunity-message.test.ts`

**Interfaces:**
- Produces `evaluateOpportunityPolicy(input): { recommend:boolean; automaticSend:boolean; reason:string; nextFollowupAt:string|null }`.
- Produces `buildOpportunityMessage(input): string`.

- [ ] **Step 1: Write RED tests for gates**

Must prove:

```ts
aiEnabled=false => automaticSend=false, recommend=true
whatsapp + read_only => automaticSend=false
humanTakeover=true => automaticSend=false, recommend=false
personal=true => automaticSend=false, recommend=false
followupCount=2 => automaticSend=false
paidOrder=true => automaticSend=false, recommend=false
```

Timing: first recommendation at +2h, second at next day after first successful follow-up.

- [ ] **Step 2: Write RED tests for deterministic copy**

Examples:

```ts
buildOpportunityMessage({ firstName:'Ana', productName:'Pack Parrillero', stage:'product_interest' })
// contains Ana + Pack Parrillero; must not contain invented '$', 'stock', 'descuento', or delivery promise.
```

- [ ] **Step 3: Run RED**

- [ ] **Step 4: Implement policy and templates**

Templates only interpolate known `firstName`, `productName`, and known order/cart context. No model call in v1 automated recovery copy.

- [ ] **Step 5: Run GREEN and commit**

```bash
git add src/lib/opportunities/policy.ts src/lib/opportunities/message.ts test/remy-opportunity-policy.test.ts test/remy-opportunity-message.test.ts
git commit -m "feat: add safe opportunity follow-up policy"
```

---

### Task 4: Opportunity persistence service and conversation evaluation

**Files:**
- Create: `src/lib/opportunities/service.ts`
- Modify: `src/lib/messaging/messages.ts`
- Test: `test/remy-opportunity-service-contract.test.ts`

**Interfaces:**
- Produces `evaluateConversationOpportunity(db, conversationId): Promise<OpportunityRow | null>`.
- Produces `closeConversationOpportunities(db, conversationId, reason, convertedOrder?)`.

- [ ] **Step 1: Write failing contract tests**

Assert service queries `conversations`, latest visible inbound/outbound messages, `carritos_abandonados`, related orders, and upserts instead of duplicate inserts.

- [ ] **Step 2: Run RED**

- [ ] **Step 3: Implement service**

Load a bounded recent message window per conversation; derive commercial booleans with explicit regex/structured cart/order facts. On every successfully persisted non-status message, schedule reevaluation in a `void ...catch(...)` branch so webhook persistence success is never blocked.

- [ ] **Step 4: Prove webhook isolation**

Test that evaluator exceptions are caught/logged and do not alter `persistMessage` return path.

- [ ] **Step 5: Run GREEN and commit**

---

### Task 5: Meta referral/ad context normalization

**Files:**
- Modify: `src/lib/messaging/normalize.ts`
- Modify: `src/app/api/instagram/route.ts`
- Test: `test/remy-opportunity-detector.test.ts`

**Interfaces:**
- Produces normalized optional metadata under `raw_payload.referral` / existing Meta event payload; detector reads only fields actually present.

- [ ] **Step 1: Add RED fixture with an Instagram `referral`/ad payload**

Assert ad IDs/source are preserved when Meta sends them and `source_type='unknown'` when absent.

- [ ] **Step 2: Run RED**

- [ ] **Step 3: Implement minimal normalization**

Do not manufacture campaign names via external lookups in v1. Persist raw IDs/referral source and expose a compact normalized summary to the detector.

- [ ] **Step 4: Run GREEN and commit**

---

### Task 6: Observation-mode runner and abandoned-cart bridge

**Files:**
- Create: `src/lib/opportunities/runner.ts`
- Create: `src/app/api/cron/sales-opportunities/route.ts`
- Modify: `src/app/api/cron/carritos-abandonados/route.ts`
- Modify: `vercel.json`
- Test: `test/remy-opportunity-runner-contract.test.ts`

**Interfaces:**
- Produces `runOpportunityCycle(db, now): Promise<{evaluated:number;recommended:number;sent:number;blocked:number}>`.

- [ ] **Step 1: Write RED runner tests**

Cases:
- Remy off => opportunity updated/recommended, `sendMessage` never called.
- Remy on + WhatsApp read_only => blocked, no send.
- Remy on + allowed => exactly one send and `followup_count += 1` only after provider success.
- duplicate concurrent invocation => no second send.

- [ ] **Step 2: Run RED**

- [ ] **Step 3: Implement idempotent claim**

Use a DB atomic claim/update token/timestamp before sending; re-check policy immediately before send; reconcile provider message IDs before retrying ambiguous failures.

- [ ] **Step 4: Keep existing cart sender active but prevent duplicate ownership**

In observation mode, cart cron creates/updates an opportunity but keeps legacy send behavior. Add a clear feature/config switch for later cutover; never let both paths send for the same cart in one run.

- [ ] **Step 5: Add cron**

Use a cadence supported by Vercel plan/environment; runner relies on `next_followup_at`, not exact-minute execution.

- [ ] **Step 6: Run GREEN and commit**

---

### Task 7: Admin opportunity inbox and manual actions

**Files:**
- Create: `src/app/api/admin/sales-opportunities/route.ts`
- Create: `src/app/api/admin/sales-opportunities/[id]/route.ts`
- Create: `src/app/api/admin/sales-opportunities/[id]/send/route.ts`
- Create: `src/app/admin/oportunidades/page.tsx`
- Create: `src/app/admin/oportunidades/OpportunityActions.tsx`
- Modify: `src/app/admin/AdminSidebar.tsx`
- Modify: `src/app/admin/MobileAdminNav.tsx`
- Test: `test/admin-sales-opportunities.test.ts`

**Interfaces:**
- GET list filters: `status`, `priority`, `channel`.
- PATCH action body: `{ action:'snooze'|'dismiss'|'update_message', until?:string, message?:string }`.
- POST send body: `{ message:string }`.

- [ ] **Step 1: Write RED admin contract test**

Assert admin role guard, visible labels `Oportunidades de venta`, `Enviar ahora`, `Editar mensaje`, `Recordarme después`, `Descartar`, and `Abrir conversación`.

- [ ] **Step 2: Run RED**

- [ ] **Step 3: Implement APIs**

Manual send must call canonical `sendMessage(... mode:'manual')`, then persist outbound with opportunity ID/reason metadata and update follow-up audit fields without pretending it was automatic.

- [ ] **Step 4: Implement inbox**

Show priority, channel, reason, product context, age, origin/ad when known, recommended timing, draft, and links to conversation/order.

- [ ] **Step 5: Run GREEN and commit**

---

### Task 8: Conversion attribution and recovery metrics

**Files:**
- Create: `src/lib/opportunities/attribution.ts`
- Modify: canonical order creation integration point (`src/lib/repositories/orders-repository.ts` preferred if all channels pass there)
- Test: `test/remy-opportunity-attribution.test.ts`

**Interfaces:**
- Produces `attributeOrderToOpportunity(db, { orderId, conversationId?, customerId?, total, createdAt }): Promise<void>`.

- [ ] **Step 1: Write RED tests**

Prove:
- order after an opportunity closes it as `converted`;
- `converted_revenue` equals real persisted order total;
- “recovered sale” attribution requires at least one successful follow-up;
- order created without follow-up may close the opportunity but is not counted as recovered revenue.

- [ ] **Step 2: Run RED**

- [ ] **Step 3: Implement attribution after successful order persistence**

Never change order total/status. Attribution failure is logged and must not roll back an already-valid customer order unless it is inside the same explicitly designed transaction and cannot affect order semantics.

- [ ] **Step 4: Run GREEN and commit**

---

### Task 9: Production observation deployment and verification

**Files:**
- No new business logic; deployment/migration plus verification.

- [ ] **Step 1: Run full branch verification**

Run repository CI equivalents:

```bash
npm test
npx tsc --noEmit
npm run lint
npm run build
```

Expected: all PASS.

- [ ] **Step 2: Apply production migration**

Verify schema objects/indexes and no destructive changes to existing conversation/order/cart data.

- [ ] **Step 3: Deploy with Remy still globally OFF**

Confirm `ai_enabled` remains false and WhatsApp send mode remains unchanged. This release is observation/copilot first.

- [ ] **Step 4: Production smoke tests**

- `/admin/oportunidades` renders for admin.
- Detector can create/update recommendations from historical commercial conversations without sending.
- Paid-order and human-takeover conversations are excluded/closed.
- Existing Instagram/WhatsApp inbound webhooks still persist successfully.
- Current abandoned-cart recovery does not double-send.
- Production logs contain no new unhandled errors.

- [ ] **Step 5: Review detected opportunities before automatic activation**

Check a sample of high/medium/low recommendations for false positives. Automatic sending remains disabled until explicit operational activation after this review.

- [ ] **Step 6: Commit/PR/merge and verify production deployment is READY**

---

## Self-Review

- Spec coverage: detector, scoring, two modes, channel/timing rules, ad context, abandoned-cart migration, anti-spam, auditability, conversion attribution, metrics data, admin actions, idempotency, testing, and gradual rollout are all mapped to tasks.
- Placeholder scan: no TBD/TODO/“implement later” placeholders remain.
- Type consistency: detector -> service -> policy/message -> runner -> admin/attribution interfaces are named explicitly above.
- Scope control: this plan covers only the Remy opportunity engine. Product editor/deletion and shipping-zone/free-shipping work remain separate bounded changes already approved by the user.
