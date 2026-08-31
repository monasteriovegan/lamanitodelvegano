# WhatsApp Inbound Production Recovery Design

## Objective

Recover and prove the production WhatsApp inbound path without changing the existing omnichannel architecture or enabling automatic outbound behavior.

The completed delivery must demonstrate this path:

`WhatsApp → Meta → WABA subscription → /api/whatsapp → signature validation → normalization → persistMessage → conversations → omnichannel_messages → /admin/conversaciones`

## Non-negotiable constraints

- Preserve the current HEAD, the eight local commits not yet published, and every pre-existing uncommitted file.
- Never reset, clean, rebase, destructively checkout, delete production data, or recreate populated tables.
- Keep `pedidos` as the only order source of truth and preserve the checkout path that produced the real purchase.
- Do not rebuild Remy, Wonka, CRM, checkout, payments, or the omnichannel model.
- Keep WhatsApp and Instagram automatic outbound disabled.
- Do not advance to Delivery 2 until Delivery 1 evidence is complete.
- Commit only files intentionally changed for this delivery, in small independently verifiable commits.

## Baseline preservation

Before implementation, record:

- branch and HEAD SHA;
- local commits ahead of the tracked remote;
- modified and untracked paths;
- hashes of pre-existing modified files that Delivery 1 may need to touch;
- the current focused-test and full-suite results.

When a required file already contains uncommitted changes, the Delivery 1 patch must be reviewed against the recorded baseline and staged by exact path or hunk so unrelated work is not included.

## Root-cause investigation

No corrective change is allowed until evidence identifies the failing boundary.

The investigation will gather evidence at each boundary:

1. Meta token validity and granted permissions from `GET /me/permissions`.
2. Expected and observed WABA and Phone Number IDs.
3. WABA subscription state from a read-back Graph API call.
4. Direct callback URL and redirect behavior for `https://www.lamanitodelvegano.cl/api/whatsapp` and its canonical equivalent.
5. Vercel production webhook request logs around the last known inbound event.
6. Webhook verification behavior and signature validation.
7. Normalization outcomes, ignored-event reasons, asset routing, persistence, deduplication, and transport-health writes.
8. Database timestamps in `messaging_transport_status`, `conversations`, and `omnichannel_messages`.

The root-cause report must distinguish whether Meta never sent the POST, the callback rejected it, routing ignored it, or persistence failed.

## WABA subscription verification

The existing Meta setup flow will retain the current WABA and app architecture but will no longer treat a successful mutation response as proof.

The flow is:

1. Read token permissions.
2. Read the WABA subscription state.
3. If the expected app or `messages` field is absent, execute `POST /1129249369256097/subscribed_apps` with `subscribed_fields=messages`.
4. Read the WABA subscription state again.
5. Report success only if app `1691394752113175` appears with the `messages` subscribed field.

Any unknown Graph response is reported as `unknown` or an explicit safe error. Tokens and secrets are never returned or logged.

## Canonical callback

The preferred callback is `https://www.lamanitodelvegano.cl/api/whatsapp` only if it reaches the handler directly without a 301 or 308 response. Otherwise the canonical non-redirecting production hostname is used.

The diagnostic surface reports both the configured callback known to the application and the observed HTTP behavior. It must not claim to know Meta's configured callback unless that value was read from Meta or visibly verified in the App Dashboard.

## Safe observability

Webhook processing will emit structured, secret-free evidence with a request correlation ID. It will record categories rather than message contents or customer identifiers.

Required observable outcomes:

- `received`: POST reached the production handler;
- `signature_invalid`: HMAC validation failed;
- `invalid_json`: body could not be parsed;
- `payload_ignored`: object, field, or event was not relevant;
- `phone_number_mismatch`: observed Phone Number ID differs from the configured asset;
- `asset_not_connected`: tenant routing failed;
- `duplicate`: provider message was already persisted;
- `persistence_failed`: database processing failed with a sanitized stage/code;
- `persisted`: message and conversation were stored successfully.

No access token, app secret, verify token, full payload, message body, phone number, customer name, email, or address may appear in logs.

Durable status data will be extended only when necessary and through an additive, idempotent migration. Existing rows and timestamps are preserved.

## Real status endpoint

`/api/admin/whatsapp/status` remains admin-only and fail-closed. It returns only measured or configured-safe data:

- `webhook_last_received_at`;
- `last_inbound_at`;
- `last_outbound_at`;
- `last_error`;
- `configured_phone_number_id`;
- `observed_phone_number_id`;
- `waba_id`;
- `subscription_status`;
- `subscribed_fields`;
- `callback_url` and callback reachability result;
- `send_mode`;
- `ai_global`;
- `transport_status`.

Unknown values are returned as `unknown`, never inferred as `GREEN`, `not_verified`, `OFF`, or `connected` without evidence.

## Central capability policy

The existing system gains one server-only policy evaluator for these capabilities:

`receive → analyze → prepare → send`

Policy inputs include:

- master Remy state;
- channel state;
- conversation `ai_enabled`;
- `human_takeover` and personal/manual state;
- channel send mode;
- whether the action is automatic or explicitly manual.

For Delivery 1, WhatsApp production mode is `read_only`:

- `receive`: allowed;
- `analyze`: allowed only when existing agent/channel/conversation controls permit it;
- `prepare`: allowed only as a non-destructive draft operation;
- `send`: always denied;
- automatic commercial mutations: denied.

The send transport must check this policy immediately before any external Graph API call. An `automatic=true` flag, Remy authorization, or manual API route cannot bypass `read_only`. A later live-mode change is out of scope for this delivery.

## Test strategy

Every functional correction follows red-green-refactor:

1. Add a regression test that fails for the observed defect.
2. Run the focused test and capture the failure.
3. Implement the smallest correction.
4. Run the focused test and capture success.
5. Run the full suite before each commit.

Delivery 1 coverage includes:

- webhook GET success and rejection;
- signed inbound POST;
- invalid signature;
- invalid/ignored payload;
- Phone Number ID mismatch;
- successful persistence;
- legitimate duplicate;
- sanitized persistence failure;
- WABA subscription response parsing and mandatory read-back verification;
- real-status serialization with `unknown` fallbacks;
- `read_only` receive allowed;
- `read_only` analyze/prepare boundaries;
- `read_only` send denied for manual and automatic paths;
- global/channel/conversation/human-takeover policy precedence.

## Production verification

After focused tests, full tests, lint, build, and worker checks pass:

1. Deploy the exact verified commit.
2. Confirm production environment reports `read_only` without exposing secrets.
3. Confirm the callback reaches `/api/whatsapp` directly.
4. Confirm Meta token permissions and WABA subscription through read-back.
5. Send one real WhatsApp message from another number.
6. Confirm a production POST and HTTP 200.
7. Confirm one new `omnichannel_messages` row and its `conversation`.
8. Confirm `last_inbound_at` advances.
9. Confirm the message appears in `/admin/conversaciones`.
10. Confirm no outbound message, AI reply, order creation, or automatic commercial mutation occurred.

The expected webhook outcome is equivalent to `stored=1`, `ai_called=false`, and `ai_replied=false`.

If sending the real test message requires human control of WhatsApp, all automated preparation and observation will be completed first, and the user will only be asked to send that single message.

## Delivery evidence

Delivery 1 concludes with:

- root cause and supporting evidence;
- pre-existing-work preservation record;
- files changed and purpose;
- migrations applied;
- focused and full test output;
- commit SHA for each isolated commit;
- WABA read-back result;
- actual callback result;
- real webhook and database timestamps;
- explicit confirmation that outbound and automatic commercial actions remained blocked;
- production deployment URL and verified commit.
