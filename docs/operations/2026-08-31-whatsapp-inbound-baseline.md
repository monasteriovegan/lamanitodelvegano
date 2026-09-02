# WhatsApp inbound production baseline — 2026-08-31

This report records only secret-free operational evidence. It deliberately excludes webhook bodies, message text, customer identifiers, phone numbers, access tokens, application secrets, and database credentials.

## Immutable repository baseline

- Branch: `codex/tracking-meta-ga4-barra-dubai`
- Baseline HEAD for Delivery 1: `8447a2121c3c11ed6aa2f3736a3252e06a862c8a`
- Commits ahead of `origin/codex/tracking-meta-ga4-barra-dubai`: 10 (the pre-existing 8 plus the approved design and plan commits).
- Pre-existing tracked modifications preserved: 26 files.
- Pre-existing untracked paths preserved: 7 files/directories.

Tracked files modified before implementation:

```text
src/app/admin/AdminSidebar.tsx
src/app/admin/MobileAdminNav.tsx
src/app/admin/agentes/page.tsx
src/app/admin/clientes/page.tsx
src/app/admin/conversaciones/ConversationsClient.tsx
src/app/admin/conversaciones/page.tsx
src/app/admin/layout.tsx
src/app/admin/page.tsx
src/app/admin/productos/page.tsx
src/app/api/admin/ai/settings/route.ts
src/app/api/admin/conversations/[id]/messages/route.ts
src/app/api/admin/conversations/route.ts
src/app/api/admin/meta/tracking-audit/route.ts
src/app/api/instagram/route.ts
src/app/internal-meta-ig-diagnostic-a81c/page.tsx
src/components/layout/AnalyticsScripts.tsx
src/lib/ai/remy-commerce.ts
src/lib/ai/remy.ts
src/lib/analytics/client.ts
src/lib/messaging/messages.ts
src/lib/messaging/signature.ts
src/lib/messaging/transports/instagram-meta.ts
src/lib/repositories/conversations-repository.ts
src/lib/supabase/require-role.ts
src/lib/supabase/server-auth.ts
src/types/domain.ts
test/messaging.test.ts
```

Pre-existing untracked paths:

```text
src/lib/admin/access-policy.ts
src/lib/attribution/messaging.ts
supabase/.temp/cli-latest
supabase/migrations/20260824072808_add_meta_reviewer_role.sql
supabase/migrations/20260824143000_extend_conversion_attribution.sql
test/attribution.test.ts
test/reviewer-access.test.ts
```

Protected file hashes at the baseline:

```text
src/app/api/whatsapp/route.ts  28FF4BA6294A934433246E95F8D95B3962A46B97BBEE8455125729D12EAAC57C
src/lib/messaging/messages.ts  5C6F729E290D3547D74C548881691924C7E22086A39B162BE1E2D82BAA76B601
src/lib/ai/remy.ts              04E5D9ACEA98704987F24FC7D33A8CE6A33D5E5FDCE0149DD45593F798DE2B96
src/lib/meta/setup-messaging.ts 2F94F7CA90AA9B98280F31904D6D9246975B6EEC8CCDDA6EFC0DFCF6AC181D6B
```

## Pre-change verification

| Check | Result | Evidence |
| --- | --- | --- |
| Focused messaging test command | Pass | 74 passed, 0 failed. The repository test script places the name filter after the glob, so Node executed the complete suite. |
| Full test suite | Pass | 74 passed, 0 failed, exit code 0. |
| Test warnings | Known baseline warning | Node reparses TypeScript test files as ES modules because `package.json` has no `type`; no test failed. |

## Production evidence

| Boundary | Observed | Evidence | Conclusion |
| --- | --- | --- | --- |
| Production deployment | Ready, created 2026-08-24 | Vercel deployment `dpl_6ASPmCstwNPx4KWS3BrqogJS5maA`; source commit `d8687d4f4f7be91f4cf42cc58f1616aa13a8e1fb`; `gitDirty=1`. | Production contains the historical proxy bridge and local webhook handler from the captured working tree. |
| Meta webhook object configuration | `messages` enabled on Graph v26.0 | Meta App Dashboard for app `1691394752113175` visibly reports the `messages` field as `Suscritos`. | App-level field subscription is present; it does not prove the app remains attached to WABA `1129249369256097`. |
| Callback configured in Meta | `https://lamanitodelvegano.vercel.app/api/meta/webhooks/whatsapp` | Meta App Dashboard, WhatsApp production configuration. | Meta still targets the historical proxy callback, not the direct canonical handler. |
| Historical callback HTTP | Direct 403 without verification parameters | A no-redirect GET reaches the Vercel function directly. | The historical callback is reachable and does not redirect. |
| Canonical callback HTTP | Direct 403 without verification parameters | `https://lamanitodelvegano.cl/api/whatsapp` reaches the handler directly. | This is the preferred direct callback. |
| `www` callback HTTP | 308 redirect | `https://www.lamanitodelvegano.cl/api/whatsapp` redirects to the apex host. | The `www` URL must not be used as Meta's callback. |
| Vercel receipt after 2026-08-23 | Two diagnostic POST 200 requests on 2026-08-31 at 04:28:17Z and 04:28:38Z | Safe request metadata for `/api/meta/webhooks/whatsapp`; no associated runtime error. | The endpoint can receive Meta diagnostics/tests. These deliveries created no inbound database row and therefore were not real normalized inbound messages. |
| Real inbound persistence | Stopped at 2026-08-23 03:39:01Z | Supabase: 557 WhatsApp inbound rows; latest row `2026-08-23 03:39:01.748974+00`. | No real inbound reached `persistMessage` after that timestamp. |
| Transport health record | Stale healthy state | `cloud_api.last_inbound_at=2026-08-23 03:39:01.832+00`, `updated_at=2026-08-23 03:41:05.08+00`, empty metadata. | Existing status cannot distinguish no POST, ignored payload, invalid signature, or persistence failure. |
| Server-side legacy configuration | Present | Supabase boolean checks confirm a non-empty legacy Meta token, a non-empty verify token, Phone Number ID `1022209807648757`, and `ai_enabled=false`. | Credentials exist server-side; their real Graph permissions and WABA attachment require safe Graph read-back. |
| Tenant OAuth connection | Active but Instagram/Page-only | Granted scopes are the six Instagram/Page permissions; selected assets are Page and Instagram account only. | This OAuth connection cannot be treated as proof of WhatsApp permissions or assets. |
| Automatic AI | Off | `integraciones_secretas.ai_enabled=false`. | Baseline intends no Remy reply, but the transport still contains a mode bypass that must be closed. |
| Runtime errors | None for WhatsApp routes in the current seven-day deployment window | Vercel grouped runtime errors for `/api/meta/webhooks/whatsapp` and `/api/whatsapp`. | A 200 response alone masks ignored/test payloads and cannot prove persistence. |

## Root cause

The first failed production boundary is **WABA `1129249369256097` → app/callback delivery of real `messages` events**. The callback is reachable and the app-level `messages` field is enabled, but no real inbound POST has produced a normalized WhatsApp message since 2026-08-23. The current setup code can create exactly this silent failure: it treats a `POST /{WABA_ID}/subscribed_apps` HTTP success as proof without performing `GET /{WABA_ID}/subscribed_apps` afterwards, while the admin status route hardcodes the WABA, Phone Number ID, quality and verification claims. Consequently a missing/lost WABA-level app attachment is reported as healthy and cannot self-diagnose.

Delivery 1 will replace that optimistic assumption with mandatory Graph `GET → POST → GET` verification, then record the actual app ID and `subscribed_fields=messages`. Until that read-back is captured, the WABA attachment is considered `unknown`, never healthy.

## Safety state before implementation

- No production database rows were changed.
- No Meta permissions, subscriptions, callbacks, campaigns, billing, WhatsApp assets, or tokens were changed.
- No test message, outbound WhatsApp, automatic order, or artificial purchase was generated.
- No secret or customer content was printed or stored in this report.
