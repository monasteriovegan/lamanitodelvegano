# Remy Conversational Commerce Implementation Plan

## Goal

Complete the existing Remy commerce stack without replacing it. The target flow is:

`discover -> cart -> delivery -> details -> review -> confirmed -> payment -> post_sale`

Every irreversible or externally visible statement must be backed by a successful tool result. No real payment is executed by this work; production smoke testing stops after creation of a payment URL.

## Existing foundations to preserve

- `src/lib/ai/remy-commerce.ts`: canonical catalog lookup, persistent cart, shipping quote, checkout data, idempotent order creation, payment link, order status.
- `src/lib/ai/remy.ts`: tool loop, catalog continuity, cart-add truth guard, human handoff.
- `src/app/api/chat/route.ts`: persistent anonymous web conversation, browser-cart sync, deterministic checkout questions.
- `src/lib/ai/remy-delivery.ts`: real product availability, blocked delivery dates and delivery settings.
- `src/lib/ai/remy-payment.ts`: configured Mercado Pago / Flow detection and fail-closed transfer handling.
- `src/lib/orders/whatsapp-auto-sale.ts`: existing WhatsApp/order reconciliation path.
- `carritos_abandonados.metadata`: existing JSON persistence surface for checkout and conversation-commerce state.

## Gaps confirmed by audit

1. There is no explicit persistent commerce stage; checkout data exists but the system does not persist the state machine.
2. Truth enforcement is deterministic for `cart_add`, but not generalized to `cart_remove`, `cart_clear`, `order_create`, and `payment_link`.
3. Web deterministic checkout hard-codes Mercado Pago instead of asking from the methods actually configured.
4. Web -> WhatsApp is currently a plain `wa.me` link and does not carry a safe continuation reference.
5. Transfer is correctly fail-closed because no verified bank-account configuration exists in the current Remy payment configuration. Do not add or invent bank details; retain human handoff until a verified source is added.

## Task 1 — Commerce state model (TDD)

**Files**
- Create `src/lib/ai/remy-commerce-state.ts`
- Create `test/remy-commerce-state.test.ts`
- Modify `src/lib/ai/remy-commerce.ts`

**Tests first**
- Empty cart resolves to `discover`.
- Cart with products but no delivery data resolves to `cart`/`delivery` as appropriate.
- Partial customer data resolves to `details`.
- Complete checkout without confirmation resolves to `review`.
- Successful order creation resolves to `confirmed` or `payment` depending on payment result.
- Paid/order-status context resolves to `post_sale` without regressing to an earlier stage.

**Implementation**
- Store `commerce_stage`, `commerce_stage_updated_at`, and relevant evidence (`order_id`, payment-link evidence where applicable) inside existing cart/conversation metadata rather than adding a new schema column.
- Stage derivation must be deterministic from persisted facts and may only move forward except when cart contents/checkout data are explicitly changed before order creation.

## Task 2 — General truth-contract guard (TDD)

**Files**
- Create `src/lib/ai/remy-tool-evidence.ts`
- Create `test/remy-tool-evidence.test.ts`
- Modify `src/lib/ai/remy.ts`

**Tests first**
- `cart_add`, `cart_remove`, and `cart_clear` require `ok=true` before a successful mutation can be claimed.
- `order_create` requires `ok=true` plus an `orderId`.
- `payment_link` requires `ok=true` plus a non-empty `paymentUrl`.
- Failed tool results produce safe deterministic guidance instead of success language.

**Implementation**
- Track side-effect evidence for all mutating/payment tools in the provider loop.
- Inject a final evidence summary into the last model turn.
- For an explicitly requested side effect that was never attempted or never succeeded, use a deterministic fail-closed reply.

## Task 3 — Configured payment choices in web checkout (TDD)

**Files**
- Modify `src/lib/ai/remy-payment.ts`
- Create/modify pure payment-choice tests.
- Modify `src/app/api/chat/route.ts`

**Tests first**
- Mercado Pago only -> ask for Mercado Pago.
- Flow only -> ask for Flow and require email at the correct step.
- Both -> offer both without inventing another method.
- None -> instruct coordination through WhatsApp/human, without fake banking data.

**Implementation**
- Expose a reusable configured-payment-method resolver from `remy-payment.ts`.
- Remove the hard-coded Mercado Pago checkout question.

## Task 4 — Web -> WhatsApp commerce continuation (TDD)

**Files**
- Create `src/lib/ai/remy-handoff-token.ts`
- Create `test/remy-handoff-token.test.ts`
- Modify `src/app/api/chat/route.ts`
- Modify `src/components/layout/Chatbot.tsx`
- Integrate on WhatsApp inbound persistence/reconciliation only after verifying the existing message persistence boundary.

**Design**
- Generate a short opaque handoff reference bound to the web conversation/cart; do not place cart contents, customer data, secrets, or order data in the URL.
- Persist the reference in server-side conversation/cart metadata with creation time and one-way continuation semantics.
- Return a WhatsApp URL from the web chat API only for that session.
- On WhatsApp inbound containing the continuation reference, resolve server-side and attach/copy the active cart and commerce metadata to the WhatsApp conversation without creating an order or payment.
- Make the transfer idempotent.

## Task 5 — Transfer policy

No verified bank-account source exists in the audited Remy payment configuration. Therefore this implementation must keep transfer fail-closed and human-assisted. A future bank-account integration can add a `transfer` method only when all display fields come from a verified server-side record. No hard-coded bank data will be introduced.

## Task 6 — Verification

Run/verify on the feature branch:

1. `npm test`
2. `npm run lint`
3. `npm run build`
4. Existing checkout/idempotency/order tests.
5. New Remy state/evidence/payment/handoff tests.
6. Production-safe smoke: catalog -> cart -> delivery -> review -> explicit confirm -> order created -> payment URL generated; stop before opening/completing payment.

Before merge, inspect diff and request code review. Do not merge or deploy unless verification evidence is green.
