# Final precutover blockers implementation plan

**Goal:** Produce verified evidence and a safe, executable cutover/rollback package without changing production.

**Constraints:** All production systems and provider configurations remain read-only. No customer-facing side effect is permitted.

## Task 1: Establish immutable baseline

- [ ] Confirm clean staging branch, current commit, deployment URLs, VPS reachability, container health, ports, firewall, RAM, and disk.
- [ ] Capture Vercel environment-variable names/scopes without values.
- [ ] Record managed-source snapshot timestamp and existing migration evidence.

## Task 2: Recover and validate secrets safely

- [ ] Search Vercel Production/Preview/Development, protected local `.env` files, VPS protected environment files, Git history, and available secret stores without printing values.
- [ ] Fingerprint non-empty `META_TOKEN_ENCRYPTION_KEY` candidates in memory.
- [ ] Validate candidates against an encrypted Meta row without revealing ciphertext, key, or plaintext.
- [ ] Configure Preview/self-hosted only if the correct existing key is recovered and proven.

## Task 3: Audit integrations without side effects

- [ ] Determine actual SMTP/email provider and validate settings, Auth templates, redirects, and connection capability without sending mail.
- [ ] Determine whether Google Auth OAuth is actually used and validate callback requirements.
- [ ] Validate Meta/Instagram/WhatsApp read-only metadata only if decryption is available.
- [ ] Validate Mercado Pago credential presence, signature/idempotency/order mapping, and return URL logic without charging.
- [ ] Inventory Flow, Gemini/Google, Wonka, and the three Vercel cron routes.

## Task 4: Prove Preview independence

- [ ] Inspect runtime code and Preview traffic for homepage, catalog, product, checkout dry-run, login, admin, orders, stock, CRM, and Wonka.
- [ ] Classify every remaining managed-Supabase URL reference as historical/noncritical or blocking.
- [ ] Reconfirm the 100 pending Storage objects do not block sales/Auth/admin and retain CRM/Wonka fallbacks.

## Task 5: Verify backups and source delta

- [ ] Verify the second DPAPI escrow file without decrypting it.
- [ ] Detect removable/offline media honestly.
- [ ] Compare current managed-source counts/change timestamps/Auth/Storage with the migration snapshot using read-only access.
- [ ] Design an idempotent delta that preserves IDs, timestamps, FK, order/stock/Auth/conversation/integration state and protects self-host test records.

## Task 6: Prepare cutover and rollback

- [ ] Document the exact 16-step cutover sequence and expected maintenance window.
- [ ] Document rollback triggers, restoration of Vercel variables/deployment/webhooks, and order reconciliation.
- [ ] Produce the final component matrix and binary verdict.

## Task 7: Verification and handoff

- [ ] Re-run the repository test suite, type-check, lint for touched files, and production build if code changed.
- [ ] Re-run non-mutating VPS, Preview, and integration checks.
- [ ] Confirm Git contains no secrets or dump data and commit documentation in small reversible commits.
- [ ] Stop before any production change.

