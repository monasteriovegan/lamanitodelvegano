# Final precutover blocker resolution

## Scope

Resolve and document the remaining blockers for the LMV Supabase self-hosted cutover while keeping the managed Supabase project, Vercel Production, production DNS, payment endpoints, and production webhooks unchanged.

## Safety boundaries

- Managed Supabase is read-only.
- Vercel Production configuration and deployments are read-only.
- Provider APIs are limited to read-only metadata and authentication checks; no email, message, CAPI event, payment, or webhook mutation is allowed.
- Secrets are processed only in protected files or memory. Reports contain presence, fingerprints, and pass/fail results, never values.
- The self-hosted Preview may be adjusted only when a recovered secret can be proven correct without exposing it.

## Evidence model

The audit records command timestamps, non-sensitive counts, hashes/fingerprints, HTTP status classes, container health, and configuration presence. A component is ready only when the relevant runtime behavior is demonstrated; configuration presence alone is insufficient.

## Deliverables

1. Secret-source inventory and safe validation of `META_TOKEN_ENCRYPTION_KEY` candidates.
2. SMTP/Auth email, Google OAuth, Meta, Mercado Pago, Flow, Gemini/Google, Wonka, and cron readiness matrix.
3. Preview dependency proof showing principal flows do not call `*.supabase.co`.
4. Storage-debt and offline escrow verification.
5. Read-only source-versus-snapshot delta inventory and an idempotent final-delta procedure.
6. Exact 16-step cutover runbook, rollback procedure, reconciliation rules, expected maintenance window, and final readiness verdict.
