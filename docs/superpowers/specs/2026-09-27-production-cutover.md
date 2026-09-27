# Production cutover specification

## Objective

Move `https://lamanitodelvegano.cl` from the managed Supabase project to
`https://supabase.lamanitodelvegano.cl` using the already validated staging
revision, without losing orders, payments, stock, Auth state, or operational
messaging state.

## Safety contract

- The managed Supabase project remains intact and available for rollback.
- Freeze is fail-closed for HTTP mutations, cron invocations, provider
  webhooks, OAuth/finalizer routes, payments, email, outbound social messages,
  and CAPI.
- Provider webhooks receive a retryable failure while frozen; no unpersisted
  event is acknowledged.
- Production remains frozen while the final source delta, destination backup,
  Production environment switch, deployment, and smoke checks execute.
- Only the exact staging commit that passed tests and Preview E2E may be used.
- Secrets are moved through protected inputs and never printed or committed.
- No real charge and no outbound message to a customer is authorized.
- The USB escrow and 100 noncritical historical Storage objects are explicitly
  nonblocking; both DPAPI escrows remain untouched.
- Roll back immediately for unusable Auth/catalog/checkout, inconsistent
  orders/stock, DB/RLS failure, or unprocessable Mercado Pago events.

## Critical gates

DB, Auth/login, SMTP password reset, critical Storage, Mercado Pago signature,
HTTPS, Preview E2E, backups/restore, rollback readiness, and operational
Meta/Instagram/WhatsApp must all pass before freeze.

## Completion

Production serves the tested application against the self-hosted backend,
critical smoke tests and provider handshakes pass, maintenance is removed only
after all essential services are healthy, monitoring is enabled, and the exact
rollback artifacts and deployment identifiers are recorded.

