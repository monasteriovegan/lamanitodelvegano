# Remy Order Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corregir la confirmación de ventas conversacionales para no marcar transferencias sin evidencia como pagadas, evitar incoherencias entre estado operativo y estado de pago, y verificar el flujo con CI antes de integrar.

**Architecture:** Mantener `pedidos` como orden canónica y conservar los repositorios actuales. La lógica de pago se endurece en los puntos de escritura existentes, sin crear modelos paralelos ni cambiar el flujo omnicanal.

**Tech Stack:** Next.js 16, TypeScript, Node test runner, Supabase/Postgres, GitHub Actions.

**Spec:** Auditoría de producción del 2026-08-20 y flujo actual en `src/lib/orders/conversation-sale.ts`.

## Global Constraints

- No activar Remy globalmente hasta terminar la verificación.
- No crear tablas paralelas de pedidos/clientes/conversaciones.
- Mantener idempotencia de checkout y `pedidos` integer como orden canónica.
- No marcar `payment_status='paid'` por transferencia sin `paymentEvidence=true`.
- No degradar un pago ya confirmado por webhooks pendientes o fallidos.

---

### Task 1: Transferencias en ventas desde conversación

**Files:**
- Modify: `src/lib/orders/conversation-sale.ts`
- Test: `test/conversation-sale-hardening.test.ts`

**Interfaces:**
- Consumes: `ConversationSaleDraft.paymentMethod`, `ConversationSaleDraft.paymentEvidence`.
- Produces: estado/pago consistente y etiqueta `pagado` solo con evidencia.

- [ ] **Step 1: Write the failing test** que exige que una transferencia solo sea pagada si `paymentEvidence` es verdadera.
- [ ] **Step 2: Run test to verify it fails** con `npm test` en CI.
- [ ] **Step 3: Write minimal implementation** cambiando la condición `transferPaid`.
- [ ] **Step 4: Run test to verify it passes** y confirmar que el resto del suite sigue verde.
- [ ] **Step 5: Commit** el cambio aislado.

### Task 2: Reconciliación estado/pago de Mercado Pago

**Files:**
- Modify: `src/app/api/pagos/mercadopago-webhook/route.ts`
- Test: `test/payment-state-hardening.test.ts`

**Interfaces:**
- Consumes: `pedido.estado`, `pedido.payment_status`, estado verificado desde API Mercado Pago.
- Produces: no deja `estado='Pagado'` cuando el pago verificado no está pagado, sin degradar pedidos cuyo `payment_status` ya sea `paid`.

- [ ] **Step 1: Write the failing test** para la incoherencia histórica `Pagado + pending`.
- [ ] **Step 2: Run test to verify it fails** en CI.
- [ ] **Step 3: Write minimal implementation** de reconciliación conservadora.
- [ ] **Step 4: Run test to verify it passes** junto al suite completo.
- [ ] **Step 5: Commit** el cambio aislado.

### Task 3: CI obligatorio para este flujo

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: scripts `npm test`, `npm run lint`, `npm run build`.
- Produces: señal automática para PR/push antes de integrar.

- [ ] **Step 1: Add workflow** con Node 20, `npm ci`, tests, lint y build.
- [ ] **Step 2: Observe RED** con los tests de regresión antes de la implementación.
- [ ] **Step 3: Observe GREEN** tras las correcciones.
- [ ] **Step 4: Open PR** contra `main` y verificar Vercel + CI.
- [ ] **Step 5: Merge only after verification**.

### Task 4: Datos históricos

**Files:**
- No source file required unless a migration is necessary.

**Interfaces:**
- Consumes: historial de `order_status_history` y pedido afectado.
- Produces: decisión explícita y auditable, sin adivinar si un pago histórico fue realmente pagado.

- [ ] **Step 1: Inspect history** del pedido incoherente.
- [ ] **Step 2: Do not overwrite payment truth blindly**; si no hay evidencia de proveedor, conservar el dato y reportarlo para conciliación manual o mediante webhook.
- [ ] **Step 3: Verify no other rows share the same inconsistency**.
