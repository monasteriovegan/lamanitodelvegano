# Production cutover implementation plan

**Spec:** `docs/superpowers/specs/2026-09-27-production-cutover.md`

## Global constraints

- Preserve the managed Supabase source and all backups.
- Never print secret values.
- Use commit `5ae6035` as the validated baseline; only cutover-safety changes
  verified in Preview may be added.
- Keep payments, outbound messaging, CAPI, and crons paused through smoke tests.
- Execute rollback rather than improvising if a critical gate fails.

## Task 1: Add and validate cutover freeze controls

**Produces:** a pure freeze policy, Proxy enforcement, external-effect blocking,
tests, a Preview deployment, and a fresh full verification run.

1. Add failing tests proving freeze blocks mutating methods, cron/internal
   routes, and external effects while preserving normal GET traffic.
2. Run the focused test and observe RED.
3. Implement the freeze policy and Proxy enforcement; include `Retry-After` and
   no-store semantics for retry-safe provider behavior.
4. Run focused tests, TypeScript, full tests, protected build, and Preview E2E.
5. Commit and push the isolated cutover-safety change.

**Task test:** `npm test -- test/cutover-freeze.test.ts test/preview-safe-mode.test.ts`

## Task 2: Execute and evidence the authorized production cutover

**Consumes:** Task 1 freeze policy and the complete pre-cutover gate evidence.

1. Record UTC/source markers and current Production deployment/environment
   inventory without exposing values.
2. Install Production freeze, deploy it against the current managed backend,
   wait for in-flight work, and verify mutations/crons/provider POSTs fail 503.
3. Capture final source roles/schema/data/Auth/Storage inventory and checksums;
   compare PK/count/fingerprint/timestamp deltas and apply only reviewed,
   idempotent changes if nonzero.
4. Create and checksum a fresh encrypted self-hosted backup and verify existing
   offsite/restore evidence.
5. Install the protected self-hosted Production environment, deploy the exact
   tested commit with freeze still enabled, and run Production smoke tests.
6. Update required provider callbacks one at a time, validate signatures and
   persistence, then enable messaging/CAPI/crons only in the specified order.
7. Remove freeze through a new Production deployment only after all essential
   gates pass; configure monitoring and record resource/health evidence.
8. Write the final operational report. Roll back on any critical failure.

**Task test:** `npm test && npx tsc --noEmit && npm run build`

## Review focus

- Any request path that can mutate state during freeze, including GET routes.
- Provider retry semantics and accidental acknowledgement of frozen webhooks.
- Environment-value leakage or use of managed Supabase fallbacks.
- Rollback completeness across deployment, environment, and callbacks.

