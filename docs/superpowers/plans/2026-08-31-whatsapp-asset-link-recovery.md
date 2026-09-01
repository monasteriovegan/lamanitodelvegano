# WhatsApp Asset Link Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore WhatsApp inbound persistence by linking the verified Phone Number ID to La Manito's existing active Meta connection without weakening tenant isolation or enabling outbound messaging.

**Architecture:** Keep `meta_connection_assets` as the only canonical inbound router. Add a small pure guard that accepts a resolved asset only when its active connection belongs to the same `business_unit_id`, then repair exactly one production asset row under the existing connection. No global fallback or parallel configuration is introduced.

**Tech Stack:** Next.js 16, TypeScript, Node test runner, Supabase Postgres, Vercel.

**Spec:** `docs/superpowers/specs/2026-08-31-whatsapp-inbound-production-recovery-design.md`

## Global Constraints

- Do not mutate `/{WABA_ID}/subscribed_apps`.
- Keep `META_WHATSAPP_SEND_MODE=read_only`; no automatic or manual outbound test.
- Route only `Phone Number ID 1022209807648757` through its specific asset, connection and business unit.
- Preserve all pre-existing uncommitted work and stage only files created or changed by this task.
- Do not delete duplicate or historical records without proving references.

---

### Task 1: Lock tenant-safe asset routing with regression tests

**Files:**
- Modify: `src/lib/meta/asset-routing.ts`
- Modify: `src/lib/repositories/meta-connections-repository.ts`
- Create: `test/meta-whatsapp-asset-routing.test.ts`

**Interfaces:**
- Consumes: the Supabase `meta_connection_assets` row returned with its inner `meta_connections` relationship.
- Produces: `activeMetaAssetBusinessUnit(row): string | null` and the existing `MetaConnectionsRepository.resolveBusinessUnitForMessage()` behavior.

- [ ] **Step 1: Write the failing tests**

```ts
test('connected phone resolves only its own business unit', () => {
  assert.equal(activeMetaAssetBusinessUnit({
    business_unit_id: 'tenant-a',
    meta_connections: { business_unit_id: 'tenant-a', status: 'active' },
  }), 'tenant-a');
});

test('cross-tenant or inactive connection cannot resolve', () => {
  assert.equal(activeMetaAssetBusinessUnit({
    business_unit_id: 'tenant-a',
    meta_connections: { business_unit_id: 'tenant-b', status: 'active' },
  }), null);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test test/meta-whatsapp-asset-routing.test.ts`
Expected: FAIL because `activeMetaAssetBusinessUnit` is not exported.

- [ ] **Step 3: Implement the minimal guard and use it in the repository**

```ts
export function activeMetaAssetBusinessUnit(row: MetaAssetResolutionRow | null): string | null {
  if (!row?.business_unit_id) return null;
  const connection = Array.isArray(row.meta_connections) ? row.meta_connections[0] : row.meta_connections;
  if (connection?.status !== 'active') return null;
  if (String(connection.business_unit_id || '') !== String(row.business_unit_id)) return null;
  return String(row.business_unit_id);
}
```

Select `business_unit_id,meta_connections!inner(business_unit_id,status)` and return the guard result.

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run: `node --test test/meta-whatsapp-asset-routing.test.ts test/meta-multitenancy.test.ts test/whatsapp-webhook-route.test.ts`
Expected: all pass.

- [ ] **Step 5: Commit only the routing guard and its tests**

```bash
git add src/lib/meta/asset-routing.ts src/lib/repositories/meta-connections-repository.ts test/meta-whatsapp-asset-routing.test.ts
git commit -m "fix: enforce tenant-safe Meta asset routing"
```

### Task 2: Repair the canonical production asset link

**Files:**
- No schema or migration file. Execute one narrowly scoped DML statement against the existing production tables.

**Interfaces:**
- Consumes: business slug `la-manito-del-vegano`, active connection `f7d22cdb-a16f-4aa5-ae9d-672c1246d30b`, WABA `1129249369256097`, Phone Number ID `1022209807648757`.
- Produces: one selected and subscribed `whatsapp_phone_number` asset owned by the same business unit and connection.

- [ ] **Step 1: Re-read the exact production rows**

Run a read-only query over `business_units`, `meta_connections`, `meta_connection_assets` and the legacy `wa_phone_number_id`.
Expected: one La Manito unit, one active connection, no canonical WhatsApp phone asset, matching legacy Phone Number ID.

- [ ] **Step 2: Insert only the missing canonical link**

```sql
insert into public.meta_connection_assets (
  connection_id, business_unit_id, asset_type, external_id,
  display_name, metadata, selected, subscribed, last_health_at
)
select c.id, b.id, 'whatsapp_phone_number', '1022209807648757',
       '+56 9 9081 6124', jsonb_build_object('waba_id', '1129249369256097'),
       true, true, now()
from public.business_units b
join public.meta_connections c on c.business_unit_id = b.id
where b.slug = 'la-manito-del-vegano'
  and c.id = 'f7d22cdb-a16f-4aa5-ae9d-672c1246d30b'
  and c.status = 'active'
  and not exists (
    select 1 from public.meta_connection_assets a
    where a.asset_type = 'whatsapp_phone_number'
      and a.external_id = '1022209807648757'
  )
returning id, connection_id, business_unit_id, asset_type, external_id,
          selected, subscribed, metadata;
```

Expected: exactly one row returned; no token or unrelated asset is touched.

- [ ] **Step 3: Verify the canonical mapping**

Run a read-only joined query that resolves the phone asset through an active connection and confirms the La Manito slug.
Expected: exactly one mapping to `f3b57ce7-0796-40e5-94f1-07cb2b48ba85`.

### Task 3: Deploy and validate a real inbound message

**Files:**
- Deployment contains Task 1 code plus all preserved workspace state; the temporary mutation surface is not reintroduced.

**Interfaces:**
- Consumes: deployed webhook `/api/whatsapp`, repaired canonical asset row and a real customer WhatsApp message.
- Produces: persisted contact, conversation and message under La Manito with zero outbound activity.

- [ ] **Step 1: Run the full suite and production build**

Run: `npm test`
Expected: zero failed tests.

Run: `npm run build`
Expected: exit code 0.

- [ ] **Step 2: Deploy to Vercel production**

Run: `npx vercel deploy --prod --yes`
Expected: `READY` and official domain alias updated.

- [ ] **Step 3: Confirm safety state before the live message**

Read `/api/admin/whatsapp/status` in the authenticated admin session.
Expected: `real_sends=READ_ONLY`, `automatic_ai=OFF`.

- [ ] **Step 4: Observe one real inbound webhook**

Use the next real message sent from another phone to the verified WhatsApp number. Do not synthesize a webhook and do not send an outbound response.

- [ ] **Step 5: Verify every persistence boundary**

Query `messaging_transport_status`, `omnichannel_messages`, `conversations`, `omnichannel_contacts` and `business_units` using the new provider message timestamp/id. Verify `last_outbound_at` did not change.

Expected: current `last_inbound_at`, `last_outcome=persisted`, one message, one conversation/contact under La Manito and no outbound.

- [ ] **Step 6: Verify the admin UI**

Open `/admin/conversaciones` and confirm the new WhatsApp conversation is visible.

- [ ] **Step 7: Commit any task-specific test evidence only**

Do not commit secrets, message contents, personal phone numbers or temporary diagnostic routes.
