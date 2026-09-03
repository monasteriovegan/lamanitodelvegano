# Autonomous Omnichannel Orders Design

## Goal

Make `public.pedidos` the reliable operational source of truth for every La Manito sale regardless of channel, so Instagram, WhatsApp, Web and Manual orders appear automatically in Admin Pedidos, update CRM/stock consistently, expose their source channel, remain editable, and are ready for printing without requiring a person to ask for database reconciliation.

## Current problems

1. Instagram and WhatsApp messages persist successfully, but order extraction/creation can fail after the webhook has already stored the conversation.
2. There is a one-conversation reconciler, but no periodic safety-net that scans recent eligible conversations and retries them automatically.
3. Admin Pedidos only supports partial operational editing (status/tracking/admin notes). It does not provide complete correction of customer, delivery, payment, items, shipping or totals.
4. There is no first-class manual order form.
5. Historical identified sales are not all present in `public.pedidos`; one $22.900 payment remains unidentified and must never be guessed onto a customer.

## Architecture

### Canonical order boundary

All order creation paths must finish through a canonical repository/RPC path and write to `public.pedidos`. Channel-specific ingestion may extract different evidence, but it must not create side-channel order records.

- Web checkout: existing transactional checkout path.
- Instagram/WhatsApp: existing conversation order path.
- Manual admin: a dedicated canonical manual-order RPC/repository method using the same stock/CRM rules.
- Order editing: a dedicated transactional edit RPC that adjusts stock by delta and records an audit entry.

### Automatic reconciliation safety net

Webhook-time auto-registration remains the fast path. Add a batch reconciler that:

1. selects recent Instagram/WhatsApp conversations with no order, or repeat-order conversations with unlinked recent messages;
2. runs the existing channel auto-sale function for each candidate;
3. is idempotent and bounded;
4. records outcome/last attempt so repeatedly incomplete conversations do not cause duplicate orders;
5. can run from a protected HTTP endpoint and from Supabase scheduling independent of Remy.

Remy response automation is unrelated to administrative order synchronization. Instagram can remain `Remy OFF` while order reconciliation stays active.

### Full edit

The order detail page gains an Edit mode. Editable data:

- customer name, phone, email;
- address, comuna, delivery/pickup mode and delivery date;
- payment method and payment status;
- source channel only for manual correction by admin;
- products, quantities, format/variant, per-unit price and custom items;
- shipping cost;
- customer notes and internal notes;
- operational status.

Totals are recalculated server-side. Catalog stock is adjusted by the difference between old and new catalog quantities, never by re-running a full deduction. Custom items never mutate stock.

Every edit writes an immutable audit record containing actor, timestamp, before snapshot, after snapshot and a human-readable summary. Existing `order_status_history` remains usable for status history; a focused `order_change_log` stores full edit history.

### Manual order

`/admin/pedidos/nuevo` provides a `+ Nuevo pedido` workflow. Admin can choose an existing CRM customer or enter a new customer, add catalog products and/or explicit custom items, choose delivery/pickup, shipping, payment/payment status, date and notes. Source channel is `manual` unless the operator explicitly records a known origin.

Manual creation must use the canonical transactional path, update stock, create/update CRM totals when a customer can be resolved, and make the order immediately printable.

### Unidentified payments

Create a small `payment_reconciliation_queue` table for receipt/payment evidence that is known to exist but cannot yet be matched safely. The $22.900 payment belongs here until identity evidence is found. It must not increment CRM totals, stock or sales until linked to a real order/customer.

## Data integrity rules

- Never create a duplicate order for the same idempotency key/cycle.
- Never mark a transfer paid without receipt/payment evidence or explicit human confirmation satisfying current signal rules.
- Never invent customer, product, shipping or total data.
- Catalog stock changes only for catalog-backed items with `maneja_stock=true`.
- Editing a cancelled order or changing items must preserve a traceable audit trail.
- A manual order is a normal canonical order, not a separate table.
- CRM order counts/spend must be derived/updated from canonical orders, not conversation heuristics.

## UI

### Pedido list

Keep Channel visible immediately after order number. Add `+ Nuevo pedido` in the header and an optional warning badge for reconciliation items needing human review.

### Pedido detail

Keep the read-only summary and add `Editar pedido`. Editing happens in a dedicated form with explicit Save/Cancel. Destructive or financially material changes (paid total, items, cancellation) require a confirmation prompt.

### Manual order

Use a compact admin form optimized for desktop/mobile. Product rows support catalog lookup and a `Producto personalizado` fallback with explicit name/unit price/quantity.

## Reconciliation of the current nine sales

Expected commercial count supplied by the operator: 9 total sales = 3 Instagram + 5 WhatsApp + 1 unidentified $22.900 payment.

Known canonical orders already present: Instagram @_kamufla, @javivialfaro, @valecastizaga; WhatsApp Josefa and Andrea. Identified but missing orders to reconcile: Samuel/Mauricio, Nicolás, and Antonia (`@blackclover_._` cross-channel, WhatsApp receipt $47.600). The unidentified $22.900 payment must be queued, not assigned by inference.

After implementation, run a final database audit proving channel counts, totals, conversation/order links, message links, CRM totals and stock deltas for all identified sales.

## Verification

- TDD regression tests for batch reconciliation, edit stock delta/audit, and manual creation.
- Existing full test suite must pass.
- TypeScript, worker syntax, lint and Next.js build must pass.
- Apply DB migrations before enabling scheduled reconciliation.
- Production smoke test: create/reconcile a controlled non-customer fixture or use historical idempotent conversations; verify no duplicate order.
- Final SQL audit of the nine-sale ledger.