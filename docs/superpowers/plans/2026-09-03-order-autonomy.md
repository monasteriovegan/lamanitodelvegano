# Autonomous Omnichannel Orders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every Instagram, WhatsApp, Web and Manual sale converge automatically on `public.pedidos`, with safe retry, full admin editing, audit history, manual creation and reconciliation of the current nine-sale ledger.

**Architecture:** Keep webhook-time auto-registration as the fast path and add a protected batch reconciler as a safety net. Add transactional admin RPCs for manual creation and complete editing so stock, CRM and audit history stay consistent. Keep `public.pedidos` as the only operational order source of truth.

**Tech Stack:** Next.js 16.2.9 App Router, React 19, TypeScript, Supabase/Postgres PL/pgSQL, `node:test`, existing `OrderRepository` and omnichannel order extractors.

**Spec:** `docs/superpowers/specs/2026-09-03-order-autonomy-design.md`

## Global Constraints

- `public.pedidos` remains the canonical order table.
- Remy response automation must not gate order synchronization.
- Never infer an unidentified payment onto a customer.
- All create/update operations must be idempotent or transactional.
- Catalog stock changes only for catalog-backed items with stock management enabled.
- Custom items never mutate catalog stock.
- Full test suite, TypeScript, worker syntax, lint and Next build must pass before merge.
- The $22.900 payment remains unresolved until explicit identity evidence exists.

---

### Task 1: Batch conversation reconciliation safety net

**Files:**
- Create: `src/lib/orders/reconcile-pending-sales.ts`
- Create: `src/app/api/internal/reconcile-pending-sales/route.ts`
- Create: `test/order-reconcile-batch.test.ts`
- Create: `supabase/migrations/20260903215000_order_reconciliation_state.sql`

**Interfaces:**
- Consumes: `autoRegisterInstagramConversationSale(db, conversationId)` and `autoRegisterWhatsappConversationSale(db, conversationId)`.
- Produces: `reconcilePendingSales(db, options)` returning `{ scanned, synced, pending, failed, results }` and a protected `POST/GET /api/internal/reconcile-pending-sales` endpoint.

- [ ] **Step 1: Write the failing batch-reconciler test**

Create a source-contract test that requires the reconciler to select recent `instagram`/`whatsapp` conversations, skip clearly personal conversations, dispatch to the correct channel auto-register function, bound the batch size, and persist attempt status.

```ts
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync('src/lib/orders/reconcile-pending-sales.ts', 'utf8');

test('batch reconciler retries pending Instagram and WhatsApp sales idempotently', () => {
  assert.match(source, /autoRegisterInstagramConversationSale/);
  assert.match(source, /autoRegisterWhatsappConversationSale/);
  assert.match(source, /conversation_reconciliation_state/);
  assert.match(source, /channel.*instagram.*whatsapp|instagram.*whatsapp/s);
  assert.match(source, /order_id/);
});
```

- [ ] **Step 2: Run test and confirm RED**

Run: `npm test -- --test-name-pattern="batch reconciler"`
Expected: FAIL because `src/lib/orders/reconcile-pending-sales.ts` does not exist.

- [ ] **Step 3: Add reconciliation state schema**

Create `public.conversation_reconciliation_state` with `conversation_id uuid primary key`, `last_attempt_at timestamptz`, `last_status text`, `missing jsonb`, `attempts integer`, `last_error text`, and `updated_at timestamptz`. Add FK to `conversations(id)` and indexes on `last_status,last_attempt_at`.

- [ ] **Step 4: Implement `reconcilePendingSales`**

Use service-role Supabase client supplied by caller. Query recent conversations for La Manito channels `instagram`/`whatsapp` where either `order_id is null` or there are unlinked messages after the existing order. Exclude `labels @> ['personal']` unless `pedido`/`pagado` is also present. Limit 50 by default. Dispatch per channel, capture `synced/pending/already_linked/ignored/error`, and upsert `conversation_reconciliation_state` after every attempt.

- [ ] **Step 5: Add protected batch route**

Follow the existing `reconcile-conversation-sale` authentication pattern using SHA-256 of `wa_verify_token`, but call `reconcilePendingSales`. Accept bounded `limit` (1-100) and `hours` (1-168).

- [ ] **Step 6: Run targeted and full tests**

Run: `npm test -- --test-name-pattern="reconciler"`
Expected: PASS.

Run: `npm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/orders/reconcile-pending-sales.ts src/app/api/internal/reconcile-pending-sales/route.ts test/order-reconcile-batch.test.ts supabase/migrations/20260903215000_order_reconciliation_state.sql
git commit -m "feat: add automatic omnichannel order reconciliation"
```

### Task 2: Transactional manual order creation and unidentified-payment queue

**Files:**
- Create: `supabase/migrations/20260903220000_admin_order_transactions.sql`
- Modify: `src/lib/repositories/orders-repository.ts`
- Create: `test/admin-order-transaction-contract.test.ts`

**Interfaces:**
- Produces RPC `public.admin_create_order_v1(...) returns jsonb`.
- Produces repository method `createManualOrder(input: ManualOrderInput): Promise<AdminOrder>`.
- Produces table `public.payment_reconciliation_queue`.

- [ ] **Step 1: Write failing repository/RPC contract test**

Require `ManualOrderInput`, `createManualOrder`, RPC name `admin_create_order_v1`, `sourceChannel`, `paymentStatus`, and `payment_reconciliation_queue` migration text.

- [ ] **Step 2: Run test and confirm RED**

Run: `npm test -- --test-name-pattern="manual order transaction"`
Expected: FAIL.

- [ ] **Step 3: Implement `admin_create_order_v1`**

Validate idempotency key, business unit, non-empty items, positive quantities/prices and total = item subtotal + shipping. Validate every catalog item belongs to the business unit and is active. Lock stock-managed catalog products and call the existing stock decrement function once per quantity. Insert into `pedidos` with the supplied `source_channel` (default `manual`). When `customer_id` exists, recompute/update CRM order totals and write `crm_activities`. Insert `conversion_events` with a deterministic idempotency event key. Return `{pedido_id,idempotent_replay}`.

- [ ] **Step 4: Create unidentified-payment queue**

Create `payment_reconciliation_queue(id uuid, business_unit_id uuid, amount integer, observed_at timestamptz, bank text, payer_name text, evidence jsonb, status text check in ('unmatched','linked','dismissed'), linked_order_id integer, linked_conversation_id uuid, notes text, created_at timestamptz, updated_at timestamptz)`. Add indexes on `status,observed_at`.

- [ ] **Step 5: Add repository method**

Define `ManualOrderInput` mirroring the RPC and implement `createManualOrder()` using `db.rpc('admin_create_order_v1', ...)`, then load the created order via `getById`.

- [ ] **Step 6: Run tests**

Run: `npm test -- --test-name-pattern="manual order transaction"`
Expected: PASS.

Run: `npm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260903220000_admin_order_transactions.sql src/lib/repositories/orders-repository.ts test/admin-order-transaction-contract.test.ts
git commit -m "feat: add canonical manual order transactions"
```

### Task 3: Full transactional order editing with stock delta and audit

**Files:**
- Modify: `supabase/migrations/20260903220000_admin_order_transactions.sql`
- Modify: `src/lib/repositories/orders-repository.ts`
- Create: `test/admin-order-edit-contract.test.ts`

**Interfaces:**
- Produces RPC `public.admin_update_order_v1(p_pedido_id integer, p_actor text, p_patch jsonb, p_order_items jsonb, p_stock_items jsonb) returns jsonb`.
- Produces repository method `updateFull(id, input, changedBy): Promise<AdminOrder>`.
- Produces immutable table `public.order_change_log`.

- [ ] **Step 1: Write failing edit contract test**

Require `admin_update_order_v1`, `order_change_log`, stock-delta semantics, and `updateFull` source references.

- [ ] **Step 2: Run test and confirm RED**

Run: `npm test -- --test-name-pattern="full order edit"`
Expected: FAIL.

- [ ] **Step 3: Add immutable audit table**

Create `order_change_log(id uuid default gen_random_uuid(), pedido_id integer not null references pedidos(id), actor text, summary text not null, before_snapshot jsonb not null, after_snapshot jsonb not null, created_at timestamptz default now())`. Do not expose update/delete application paths.

- [ ] **Step 4: Implement transactional edit RPC**

Lock target order and all affected stock-managed products. Parse old `pedidos.items` and new items into per-product quantities. For each product compute `delta = new_qty - old_qty`: decrement only positive delta, increment stock for negative delta. Validate availability before decrement. Recalculate subtotal from new items and total from subtotal + shipping - discount. Apply customer/payment/delivery/channel/status patch atomically. If the customer identity changes and `customer_id` exists, update CRM contact fields. Recompute CRM totals from canonical paid/non-cancelled orders for affected customer rather than incrementing blindly. Insert one `order_change_log` row with before/after snapshots.

- [ ] **Step 5: Add repository `updateFull`**

Create typed `FullOrderUpdateInput` and invoke `admin_update_order_v1`. Preserve existing `update()` for light operational actions.

- [ ] **Step 6: Run targeted/full tests**

Run: `npm test -- --test-name-pattern="full order edit"`
Expected: PASS.

Run: `npm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260903220000_admin_order_transactions.sql src/lib/repositories/orders-repository.ts test/admin-order-edit-contract.test.ts
git commit -m "feat: add audited full order editing"
```

### Task 4: Admin UI for full edit and manual creation

**Files:**
- Modify: `src/app/admin/pedidos/page.tsx`
- Modify: `src/app/admin/pedidos/actions.ts`
- Modify: `src/app/admin/pedidos/[id]/page.tsx`
- Create: `src/app/admin/pedidos/[id]/OrderEditForm.tsx`
- Create: `src/app/admin/pedidos/nuevo/page.tsx`
- Create: `src/app/admin/pedidos/nuevo/ManualOrderForm.tsx`
- Create: `test/admin-order-ui-contract.test.ts`

**Interfaces:**
- Server action `guardarPedidoCompleto(id, payload)` calls `OrderRepository.updateFull`.
- Server action `crearPedidoManual(payload)` calls `OrderRepository.createManualOrder`.

- [ ] **Step 1: Write failing UI contract test**

Require `+ Nuevo pedido`, `/admin/pedidos/nuevo`, `Editar pedido`, `guardarPedidoCompleto`, `crearPedidoManual`, channel selector, payment status, shipping cost and custom-item support.

- [ ] **Step 2: Run test and confirm RED**

Run: `npm test -- --test-name-pattern="admin order UI"`
Expected: FAIL.

- [ ] **Step 3: Implement server actions**

Require admin/soporte roles for full edit and manual create; reserve destructive item/stock changes to admin if current role tooling supports actor identity. Validate numeric fields server-side and pass actor identity to repository audit.

- [ ] **Step 4: Implement full edit form**

Load active business-unit catalog products on detail page. Render customer, delivery, payment, channel, item rows, shipping, notes and status. Support catalog rows and explicit custom rows. Recompute visual subtotal client-side but trust only server recalculation. Add confirmation before saving item/total/payment changes.

- [ ] **Step 5: Implement manual order page**

Load active catalog and recent CRM customers. Form supports existing/new customer, catalog/custom items, delivery, channel, payment/payment status, shipping and notes. Default source channel `manual`. On success redirect to the new order detail page.

- [ ] **Step 6: Add `+ Nuevo pedido` to list**

Keep Channel as the second column and add the creation button in the page header.

- [ ] **Step 7: Run tests and build checks**

Run: `npm test`
Expected: PASS.

Run: `npx tsc --noEmit`
Expected: PASS.

Run: `npm run check:worker`
Expected: PASS.

Run: `npm run lint`
Expected: PASS or only pre-existing advisory output accepted by CI policy.

Run: `npm run build`
Expected: PASS with required build env or the repository's CI no-secret build convention.

- [ ] **Step 8: Commit**

```bash
git add src/app/admin/pedidos src/lib/repositories/orders-repository.ts test/admin-order-ui-contract.test.ts
git commit -m "feat: add manual and editable admin orders"
```

### Task 5: Production scheduling and nine-sale reconciliation

**Files:**
- Create: `supabase/migrations/20260903223000_schedule_order_reconciliation.sql`
- Update: `docs/superpowers/specs/2026-09-03-order-autonomy-design.md` only if production deployment constraints require an explicit operational note.

**Interfaces:**
- Supabase `pg_cron` invokes protected `/api/internal/reconcile-pending-sales` every 5 minutes using the existing verify-token-derived key.
- Current ledger is reconciled only through canonical order paths or explicit queue insertion.

- [ ] **Step 1: Add safe scheduling migration**

Enable `pg_cron` if available. Define a SECURITY DEFINER helper that reads `integraciones_secretas.wa_verify_token`, derives the route key with `pgcrypto.digest`, invokes the stable production reconciliation endpoint through the installed HTTP extension, and never exposes the raw token. Schedule every 5 minutes with a stable named job; unschedule the old job name before replacing it to keep migration idempotent.

- [ ] **Step 2: Apply migrations to production**

Apply reconciliation-state, admin-order-transactions, then scheduler migrations with Supabase migration tooling. Verify tables/functions/jobs exist.

- [ ] **Step 3: Deploy application branch and verify CI**

Merge only after fresh green `npm test`, TypeScript, worker, lint and build. Confirm production deployment is READY. If Vercel build-rate limiting persists, do not claim the new UI/routes are live; retry deployment after the limit clears while DB migrations remain backward-compatible.

- [ ] **Step 4: Reconcile identified missing sales**

Run the protected per-conversation/batch reconciler for Samuel/Mauricio, Nicolás and Antonia. For Antonia use the actual WhatsApp receipt evidence `$47.600` and preserve cross-channel identity context without double-counting Instagram as a separate sale. Do not fabricate missing amounts for Samuel/Nicolás; read receipt OCR first.

- [ ] **Step 5: Queue the unidentified $22.900 payment**

Insert one `payment_reconciliation_queue` row with `status='unmatched'`, amount 22900 and only verified evidence fields. Do not attach `customer_id`, order or conversation unless explicit evidence is found.

- [ ] **Step 6: Final audit**

Run SQL proving:

```sql
select source_channel, count(*), sum(total)
from pedidos
where payment_status = 'paid'
group by source_channel;
```

Also verify every identified sale has exactly one canonical order link, relevant conversation messages are linked, CRM totals match canonical orders, and stock-managed product deltas reconcile.

- [ ] **Step 7: Production smoke test**

Invoke batch reconciliation twice against the same historical eligible conversations. Expected: first pass syncs/pends safely; second pass creates no duplicates and reports already-linked/pending states.

- [ ] **Step 8: Commit operational migration/doc**

```bash
git add supabase/migrations/20260903223000_schedule_order_reconciliation.sql docs/superpowers/specs/2026-09-03-order-autonomy-design.md
git commit -m "ops: schedule autonomous order reconciliation"
```
