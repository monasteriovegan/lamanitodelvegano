# WhatsApp Inbound Production Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore and prove WhatsApp inbound persistence in production while making `read_only` an unbypassable server-side barrier to every outbound or automatic commercial action.

**Architecture:** Preserve the existing Meta webhook, omnichannel repositories, Remy, CRM, and checkout. Add three focused server-only boundaries: a pure capability-policy evaluator, a read-after-write WABA subscription verifier, and secret-free webhook observation stored in the existing `messaging_transport_status.metadata`. Apply those boundaries at the existing webhook and transport call sites, then expose only measured state through the existing admin status endpoint.

**Tech Stack:** Next.js 16 App Router, TypeScript, Node test runner, Supabase/Postgres, Meta Graph API v26, Vercel.

**Spec:** `docs/superpowers/specs/2026-08-31-whatsapp-inbound-production-recovery-design.md`

## Global Constraints

- Preserve the current HEAD, the eight local commits not yet published, and every pre-existing uncommitted file.
- Never reset, clean, rebase, destructively checkout, delete production data, or recreate populated tables.
- Keep `pedidos` as the only order source of truth and preserve the checkout path that produced the real purchase.
- Do not rebuild Remy, Wonka, CRM, checkout, payments, or the omnichannel model.
- Keep WhatsApp and Instagram automatic outbound disabled.
- Do not advance to Delivery 2 until Delivery 1 evidence is complete.
- Commit only files intentionally changed for this delivery, in small independently verifiable commits.
- Never log tokens, secrets, raw webhook payloads, message bodies, phone numbers, names, emails, addresses, or payment data.
- When a touched file was dirty before Delivery 1, stage only the Delivery 1 hunk with an index-only patch and verify `git diff --cached` before committing.

## File map

- Create `docs/operations/2026-08-31-whatsapp-inbound-baseline.md`: immutable, secret-free baseline and root-cause evidence.
- Create `src/lib/messaging/capability-policy.ts`: pure `receive/analyze/prepare/send` policy and send-mode normalization.
- Create `test/messaging-capability-policy.test.ts`: policy precedence and read-only regression tests.
- Create `src/lib/meta/waba-subscription.ts`: Graph GET/POST/GET subscription verification and response parser.
- Create `test/meta-waba-subscription.test.ts`: mandatory read-back and safe error-state tests.
- Modify `src/lib/meta/setup-messaging.ts`: delegate WABA work to the verifier without changing Instagram/Page setup.
- Create `src/lib/messaging/webhook-observability.ts`: safe outcome classification and durable metadata merge.
- Create `test/whatsapp-webhook-observability.test.ts`: redaction, payload classification, and observation-merge tests.
- Modify `src/app/api/whatsapp/route.ts`: record each processing boundary and apply policy before Remy.
- Modify `src/lib/messaging/transports/whatsapp-cloud.ts`: enforce the capability policy immediately before Graph fetch.
- Modify `src/lib/ai/remy.ts`: defense-in-depth policy check before provider/tool execution.
- Create `test/whatsapp-webhook-route.test.ts`: route-level GET/POST/signature/ignored/duplicate/persist/read-only tests with injected collaborators.
- Modify `src/app/api/admin/whatsapp/status/route.ts`: replace hardcoded values with measured state or `unknown`.
- Create `test/whatsapp-status.test.ts`: fail-closed auth and real/unknown serialization.

---

### Task 1: Preserve the baseline and identify the failing production boundary

**Files:**
- Create: `docs/operations/2026-08-31-whatsapp-inbound-baseline.md`

**Interfaces:**
- Consumes: Git state, Vercel request logs, Meta read-only Graph results, Supabase timestamps.
- Produces: a secret-free evidence table identifying the last successful boundary and the first failed boundary.

- [ ] **Step 1: Record the immutable Git baseline**

Run and save only hashes, counts, and paths:

```powershell
git rev-parse HEAD
git status --short --branch
git log origin/codex/tracking-meta-ga4-barra-dubai..HEAD --oneline --reverse
git diff --name-status
git ls-files --others --exclude-standard
Get-FileHash src/app/api/whatsapp/route.ts,src/lib/messaging/messages.ts,src/lib/ai/remy.ts,src/lib/meta/setup-messaging.ts
```

Expected: no working-tree mutation; the baseline lists every pre-existing modified/untracked path.

- [ ] **Step 2: Run the pre-change focused and full tests**

Run:

```powershell
npm test -- --test-name-pattern="WhatsApp|whatsapp|Cloud API|envío real"
npm test
```

Expected: capture exact pass/fail counts without correcting failures.

- [ ] **Step 3: Trace production runtime evidence**

Inspect Vercel production logs for `/api/whatsapp` from 2026-08-23 through the current time. Record only timestamp, method, status, deployment SHA, and safe log event names. Query Supabase for:

```sql
select transport,status,last_inbound_at,last_outbound_at,last_error,metadata,updated_at
from public.messaging_transport_status where transport='cloud_api';

select max(m.created_at) as latest_message, count(*) as total
from public.omnichannel_messages m
join public.conversations c on c.id=m.conversation_id
where c.channel='whatsapp' and m.direction='inbound';
```

Expected: determine whether production received any POST after the recorded `last_inbound_at`.

- [ ] **Step 4: Perform read-only Meta checks**

Using the existing encrypted server-side credential, call `GET /me/permissions`, `GET /1129249369256097`, `GET /1022209807648757`, and `GET /1129249369256097/subscribed_apps`. Record permission names, IDs, app ID, and subscribed fields only.

Expected: a single evidence row for each of token, permissions, WABA, phone asset, app subscription, and fields.

- [ ] **Step 5: Verify callback HTTP behavior and visible Meta configuration**

Run direct requests without redirect following against both hostnames and inspect Meta App Dashboard's WhatsApp webhook callback. Record the configured callback exactly as displayed and whether its initial response is direct or redirecting.

Expected: identify one callback that reaches `/api/whatsapp` directly.

- [ ] **Step 6: Write and commit the evidence report**

The report must use a table with columns `Boundary`, `Observed`, `Evidence`, and `Conclusion`, followed by one explicit root-cause statement. It must contain no credential or customer data.

```powershell
git add -- docs/operations/2026-08-31-whatsapp-inbound-baseline.md
git diff --cached
git commit -m "docs: record WhatsApp inbound production baseline"
```

Expected: one documentation-only commit.

---

### Task 2: Centralize capability and send-mode policy

**Files:**
- Create: `src/lib/messaging/capability-policy.ts`
- Create: `test/messaging-capability-policy.test.ts`

**Interfaces:**
- Produces:

```ts
export type MessagingCapability = 'receive' | 'analyze' | 'prepare' | 'send';
export type MetaSendMode = 'disabled' | 'read_only' | 'live';
export type MessagingActionOrigin = 'automatic' | 'manual';
export function resolveWhatsAppSendMode(env?: Record<string, string | undefined>): MetaSendMode;
export function evaluateMessagingCapability(input: {
  capability: MessagingCapability;
  channel: 'whatsapp' | 'instagram' | 'web';
  origin: MessagingActionOrigin;
  sendMode: MetaSendMode;
  masterEnabled: boolean;
  channelEnabled: boolean;
  conversationEnabled: boolean;
  humanTakeover: boolean;
  personal: boolean;
}): { allowed: boolean; reason: string };
```

- [ ] **Step 1: Write failing policy tests**

Cover these exact expectations:

```ts
assert.deepEqual(resolveWhatsAppSendMode({ META_WHATSAPP_SEND_MODE: 'read_only', META_SEND_MODE: 'live' }), 'read_only');
assert.equal(evaluateMessagingCapability(base({ capability: 'receive', sendMode: 'read_only' })).allowed, true);
assert.equal(evaluateMessagingCapability(base({ capability: 'send', origin: 'manual', sendMode: 'read_only' })).allowed, false);
assert.equal(evaluateMessagingCapability(base({ capability: 'send', origin: 'automatic', sendMode: 'read_only' })).allowed, false);
assert.equal(evaluateMessagingCapability(base({ capability: 'prepare', origin: 'automatic', sendMode: 'read_only' })).allowed, false);
assert.equal(evaluateMessagingCapability(base({ capability: 'prepare', origin: 'manual', sendMode: 'read_only' })).allowed, true);
```

Also test master OFF, channel OFF, conversation OFF, human takeover, personal contact, unknown mode, and Instagram default-disabled behavior.

- [ ] **Step 2: Run the test and verify red**

Run: `node --test test/messaging-capability-policy.test.ts`

Expected: FAIL because `capability-policy.ts` does not exist.

- [ ] **Step 3: Implement the pure policy**

Implementation rules:

```ts
const normalized = String(env.META_WHATSAPP_SEND_MODE || env.META_SEND_MODE || 'disabled').toLowerCase();
const sendMode = normalized === 'live' ? 'live' : normalized === 'read_only' ? 'read_only' : 'disabled';
```

`receive` is always allowed. `send` requires `live` plus all master/channel/conversation gates and no takeover/personal state. `analyze` requires all gates but not live send mode. `prepare` additionally requires `origin === 'manual'` so inbound automation cannot mutate commerce.

- [ ] **Step 4: Run focused and full tests**

Run:

```powershell
node --test test/messaging-capability-policy.test.ts
npm test
```

Expected: both PASS.

- [ ] **Step 5: Commit**

```powershell
git add -- src/lib/messaging/capability-policy.ts test/messaging-capability-policy.test.ts
git diff --cached
git commit -m "feat: centralize messaging capability policy"
```

---

### Task 3: Verify WABA subscription through mandatory read-back

**Files:**
- Create: `src/lib/meta/waba-subscription.ts`
- Create: `test/meta-waba-subscription.test.ts`
- Modify: `src/lib/meta/setup-messaging.ts`

**Interfaces:**
- Produces:

```ts
export type WabaSubscriptionState = {
  status: 'subscribed' | 'not_subscribed' | 'unknown';
  appId: string;
  fields: string[];
  httpStatus: number | null;
  error: string | null;
};
export function parseWabaSubscription(body: unknown, appId: string): WabaSubscriptionState;
export async function ensureWabaMessagesSubscription(input: {
  graphVersion: string;
  wabaId: string;
  appId: string;
  token: string;
  fetchImpl?: typeof fetch;
}): Promise<{ before: WabaSubscriptionState; mutationStatus: number | null; after: WabaSubscriptionState }>;
```

- [ ] **Step 1: Write failing parser and fetch-sequence tests**

Test subscribed, absent app, missing `messages`, Graph error, and malformed response. Mock fetch and assert the sequence is GET only when already valid and GET → POST → GET when absent. Assert a POST 200 followed by an absent read-back returns `after.status === 'not_subscribed'`.

- [ ] **Step 2: Run the test and verify red**

Run: `node --test test/meta-waba-subscription.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement parser and verifier**

Use bearer authorization, `cache: 'no-store'`, and `URLSearchParams({ subscribed_fields: 'messages' })`. Never include the token or raw Graph body in returned errors; return only Graph error code/type and sanitized message.

- [ ] **Step 4: Replace the optimistic WABA block in setup**

In `setupMetaMessaging`, call `ensureWabaMessagesSubscription`. Set `wabaSubscription.ok` only when `after.status === 'subscribed'` and `after.fields.includes('messages')`. Add `fields?: string[]` and `verifiedAfterWrite?: boolean` to the existing result type.

- [ ] **Step 5: Run focused and full tests**

```powershell
node --test test/meta-waba-subscription.test.ts
npm test
```

Expected: PASS; no Instagram/Page behavior changes.

- [ ] **Step 6: Stage only Delivery 1 hunks and commit**

Because `src/lib/meta/setup-messaging.ts` was dirty before Delivery 1, generate an index-only patch containing only the import, type extension, and WABA replacement. Then verify:

```powershell
git diff --cached -- src/lib/meta/setup-messaging.ts
git diff --cached --stat
```

Expected: no pre-existing Instagram callback hunks are staged.

Commit: `git commit -m "fix: verify WABA subscription after mutation"`

---

### Task 4: Add secret-free webhook observations

**Files:**
- Create: `src/lib/messaging/webhook-observability.ts`
- Create: `test/whatsapp-webhook-observability.test.ts`

**Interfaces:**
- Produces:

```ts
export type WhatsAppWebhookOutcome =
  | 'received' | 'signature_invalid' | 'invalid_json' | 'payload_ignored'
  | 'phone_number_mismatch' | 'asset_not_connected' | 'duplicate'
  | 'persistence_failed' | 'persisted';
export function inspectWhatsAppEnvelope(payload: unknown): {
  objectType: string | null;
  fields: string[];
  messageCount: number;
  statusCount: number;
  echoCount: number;
  observedPhoneNumberId: string | null;
};
export async function recordWhatsAppWebhookObservation(db: SupabaseClient, input: {
  outcome: WhatsAppWebhookOutcome;
  requestId: string;
  observedPhoneNumberId?: string | null;
  configuredPhoneNumberId?: string | null;
  counts?: { messages: number; statuses: number; echoes: number };
  errorCode?: string | null;
}): Promise<void>;
```

- [ ] **Step 1: Write failing safety and merge tests**

Assert the inspector returns counts/IDs without message bodies or sender IDs. Assert the durable write merges existing `metadata` and writes `webhook_last_received_at`, `last_outcome`, safe counts, and IDs without deleting unrelated metadata.

- [ ] **Step 2: Run red test**

Run: `node --test test/whatsapp-webhook-observability.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the smallest safe observer**

Use a select-then-upsert on the single `cloud_api` row. Store only enumerated fields. Logging must be one structured event:

```ts
console.info('whatsapp_webhook_event', { requestId, outcome, messageCount, statusCount, echoCount, phoneNumberMatch });
```

- [ ] **Step 4: Run focused and full tests, then commit**

```powershell
node --test test/whatsapp-webhook-observability.test.ts
npm test
git add -- src/lib/messaging/webhook-observability.ts test/whatsapp-webhook-observability.test.ts
git commit -m "feat: observe WhatsApp webhook boundaries safely"
```

---

### Task 5: Make the WhatsApp route observable and read-only

**Files:**
- Create: `test/whatsapp-webhook-route.test.ts`
- Modify: `src/app/api/whatsapp/route.ts`

**Interfaces:**
- Consumes: `resolveWhatsAppSendMode`, `evaluateMessagingCapability`, `inspectWhatsAppEnvelope`, and `recordWhatsAppWebhookObservation`.
- Produces: unchanged public GET/POST HTTP contract plus safe outcome data.

- [ ] **Step 1: Extract an injectable route factory in the test contract**

The test imports:

```ts
export function createWhatsAppWebhookHandlers(deps: {
  createDb: typeof createSupabaseServiceClient;
  persist: typeof persistMessage;
  autoReply: typeof maybeAutoReply;
  appSecret?: string;
  configuredPhoneNumberId?: string;
}): { GET: typeof GET; POST: typeof POST };
```

Production exports instantiate it with existing dependencies.

- [ ] **Step 2: Write failing route tests**

Cover GET verification, GET rejection, valid signed inbound, invalid signature, invalid JSON, irrelevant payload, Phone Number ID mismatch, duplicate, persistence error, and successful persistence. For `read_only`, assert `persist` runs once while `autoReply` runs zero times and the response reports `stored: 1`, `ai_called: false`, `ai_replied: false`.

- [ ] **Step 3: Run red test**

Run: `node --test test/whatsapp-webhook-route.test.ts`

Expected: FAIL because the route factory and observations are absent.

- [ ] **Step 4: Implement boundary recording and policy gate**

Generate `requestId = crypto.randomUUID()`. Record `received` before signature validation. Validate the observed Phone Number ID before persistence when a configured ID exists. Record the final outcome for every return path. Before `maybeAutoReply`, evaluate `analyze` with `origin: 'automatic'`; in `read_only`, do not call it from inbound processing.

- [ ] **Step 5: Run focused and full tests**

```powershell
node --test test/whatsapp-webhook-route.test.ts test/messaging.test.ts
npm test
```

Expected: PASS.

- [ ] **Step 6: Commit**

`src/app/api/whatsapp/route.ts` was clean at baseline, so stage it with the new test and verify the cached diff.

```powershell
git add -- src/app/api/whatsapp/route.ts test/whatsapp-webhook-route.test.ts
git diff --cached
git commit -m "fix: persist WhatsApp inbound in read-only mode"
```

---

### Task 6: Close every outbound bypass

**Files:**
- Modify: `src/lib/messaging/transports/whatsapp-cloud.ts`
- Modify: `src/lib/ai/remy.ts`
- Modify: `test/messaging-capability-policy.test.ts`
- Modify: `test/messaging.test.ts`

**Interfaces:**
- Consumes: centralized capability policy.
- Produces: no Graph send and no automatic commercial tool execution unless policy explicitly permits them.

- [ ] **Step 1: Add failing transport tests**

Inject a fetch spy into `sendWhatsAppCloud` and assert zero fetch calls for all of:

```ts
{ mode: 'read_only', manual: true }
{ mode: 'read_only', automatic: true }
{ mode: 'disabled', manual: true }
{ mode: 'disabled', automatic: true }
```

Assert only `live` with all policy gates permits fetch.

- [ ] **Step 2: Add failing Remy defense tests**

Assert `maybeAutoReply` returns `{ called: false, replied: false, reason: 'send_mode_read_only' }` before `generateRemyReply` or any commerce tool can run.

- [ ] **Step 3: Run red tests**

Run:

```powershell
node --test test/messaging-capability-policy.test.ts test/messaging.test.ts
```

Expected: FAIL because current `manual` and `automatic` flags bypass `META_SEND_MODE`.

- [ ] **Step 4: Enforce policy immediately before external send**

Replace the current condition in `sendWhatsAppCloud` with a centralized `send` evaluation. Remove boolean authorization as a bypass; flags describe origin only.

- [ ] **Step 5: Enforce policy before automatic generation/tools**

At the beginning of `maybeAutoReply`, load only the existing settings required for the policy, evaluate automatic `analyze`/`prepare`, and return before `generateRemyReply` under `read_only`.

- [ ] **Step 6: Run focused and full tests**

```powershell
node --test test/messaging-capability-policy.test.ts test/messaging.test.ts
npm test
```

Expected: PASS and no checkout/order regression.

- [ ] **Step 7: Stage only Delivery 1 hunks and commit**

Both `remy.ts` and `messaging.test.ts` were dirty before Delivery 1. Apply only new policy hunks to the index and verify cached diff excludes previous Instagram/attribution work.

Commit: `git commit -m "fix: make WhatsApp read-only unbypassable"`

---

### Task 7: Replace fake WhatsApp status with measured state

**Files:**
- Create: `test/whatsapp-status.test.ts`
- Modify: `src/app/api/admin/whatsapp/status/route.ts`

**Interfaces:**
- Consumes: `messaging_transport_status`, `meta_connection_assets`, `meta_connections`, safe environment configuration, and WABA read-back state.
- Produces the admin-only status contract defined in the spec.

- [ ] **Step 1: Write failing status tests**

Assert unauthenticated access returns 401. Assert missing data serializes as the literal string `unknown`. Assert no source literal claims `not_verified`, `GREEN`, or fixed `OFF`. Assert real timestamps, configured/observed IDs, fields, send mode, AI global state, and transport status pass through unchanged.

- [ ] **Step 2: Run red test**

Run: `node --test test/whatsapp-status.test.ts`

Expected: FAIL on current hardcoded values.

- [ ] **Step 3: Implement measured serialization**

Read the configured phone asset from `meta_connection_assets`, the WABA asset when present, the existing transport row and metadata, `integraciones_secretas.ai_enabled`, and `resolveWhatsAppSendMode()`. Return `unknown` for every absent measurement. Do not call a mutating Graph endpoint from the status route.

- [ ] **Step 4: Run focused and full tests, then commit**

```powershell
node --test test/whatsapp-status.test.ts
npm test
git add -- src/app/api/admin/whatsapp/status/route.ts test/whatsapp-status.test.ts
git commit -m "fix: report measured WhatsApp integration status"
```

---

### Task 8: Revalidate Meta, deploy, and prove production inbound

**Files:**
- Modify: `docs/operations/2026-08-31-whatsapp-inbound-baseline.md`

**Interfaces:**
- Consumes: verified code commits and production credentials.
- Produces: final Delivery 1 evidence and deployment URL.

- [ ] **Step 1: Run mandatory local verification**

```powershell
npm ci
npm test
npm run lint
npm run build
npm run check:worker
```

Expected: all commands exit 0. If any fail, stop and correct or document the exact external blocker; do not deploy an unverified commit.

- [ ] **Step 2: Verify migration necessity**

Confirm `messaging_transport_status.metadata` exists in production. If it exists, apply no migration. If absent, create one additive migration containing only:

```sql
alter table public.messaging_transport_status
  add column if not exists metadata jsonb not null default '{}'::jsonb;
```

Run Supabase security advisors after any DDL and verify the column with `information_schema.columns`.

- [ ] **Step 3: Revalidate WABA with GET/POST/GET**

Run the internal admin action that uses `ensureWabaMessagesSubscription`. Record `before`, mutation HTTP status, and `after`. Success requires app `1691394752113175` plus `messages` in the read-back response.

- [ ] **Step 4: Verify callback directly**

Confirm the Meta Dashboard callback equals the direct non-redirecting production URL. Changing the callback is an external configuration mutation; if a correction is required, use the already approved canonical callback and immediately rerun GET verification.

- [ ] **Step 5: Deploy the exact verified commit**

Deploy without including unrelated uncommitted files. Verify the production deployment SHA equals the intended Delivery 1 commit and the status endpoint reports `read_only`.

- [ ] **Step 6: Run the controlled real WhatsApp test**

Ask the user only to send one message from another number when monitoring is ready. Record the production POST status and then query:

```sql
select id,conversation_id,direction,provider,transport,provider_message_id,created_at
from public.omnichannel_messages
where transport='cloud_api'
order by created_at desc limit 1;

select transport,status,last_inbound_at,last_outbound_at,last_error,metadata,updated_at
from public.messaging_transport_status where transport='cloud_api';
```

Do not select message body, raw payload, customer phone, or other PII for the evidence report.

- [ ] **Step 7: Verify UI and absence of side effects**

Open `/admin/conversaciones`, confirm the new WhatsApp conversation/message, and verify there is no new outbound message, no automatic order, and no AI usage event for that inbound.

- [ ] **Step 8: Finalize and commit the evidence**

Append command exit codes, WABA read-back, callback, deployment URL/SHA, webhook timestamp, database row IDs, UI confirmation, and `ai_called=false`, `ai_replied=false`.

```powershell
git add -- docs/operations/2026-08-31-whatsapp-inbound-baseline.md
git diff --cached
git commit -m "docs: prove WhatsApp inbound recovery"
```

Expected: Delivery 1 evidence is complete; Delivery 2 remains untouched.
