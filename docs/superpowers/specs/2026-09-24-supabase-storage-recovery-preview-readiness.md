# Supabase storage recovery and preview readiness specification

## Objective

Recover every verifiable Storage object that is available outside the quota-blocked Supabase Platform S3 endpoint, make missing media non-fatal, and prepare the self-hosted backend for a safe Preview without performing production cutover.

## Binding constraints

- Do not buy or enable a paid Supabase plan.
- Treat the managed Supabase application data as read-only.
- Do not change production DNS, Vercel Production variables, production endpoints, Meta webhooks, or the managed project.
- Do not execute real payments, CAPI, outbound WhatsApp, or outbound Instagram.
- Do not expose PostgreSQL, Supavisor, Studio, or internal services.
- Do not copy files directly into `volumes/storage/`.
- Never print or commit secrets or private object contents.
- Stop before cutover and require explicit approval.

## Required outcomes

1. Produce a sanitized 127-object manifest with bucket, opaque path identifier for private content, size, MIME type, visibility, references, functional context, impact, and recovery state.
2. Search the repository, Git history, branches, local LMV workspaces, Documents, Desktop, Downloads, Antigravity/Codex folders, builds, backups, and useful caches without modifying them.
3. Verify candidates by size and cryptographic hash or trusted Storage ETag; doubtful candidates remain unverified.
4. Test only a small official sample against Platform Storage; stop retries after a quota response.
5. Upload only verified objects through the self-hosted Storage API or S3 endpoint and verify count, size, public access, and signed access.
6. Add visual fallbacks for missing media without changing order, stock, or checkout logic.
7. Remove the hard-coded managed Supabase fallback and fail closed when required Preview variables are absent.
8. Prepare reversible URL rewriting, classify secrets, harden anonymous Storage uploads, prepare HTTPS without changing DNS, and create Vercel Preview only when a reachable HTTPS backend exists.
9. Configure and drill automatic encrypted backups before recommending cutover.

