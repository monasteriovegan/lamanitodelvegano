# Precutover external blockers specification

## Goal

Resolve the four approved precutover blockers without performing the Production cutover: reconnect Meta credentials under a new encryption key, configure real SMTP for self-hosted Auth, configure and validate Mercado Pago webhook signing, and obtain explicit confirmation that the second backup-key escrow is physically offline.

## Safety boundaries

- Do not change Vercel Production, Production backend variables, the main domain, production webhooks, production payments, managed Supabase, or public DNS.
- Keep WhatsApp outbound, Instagram outbound, Meta CAPI, and real cron side effects disabled.
- Never print, log, or commit secret values.
- Preserve old encrypted Meta connections as historical rows until a new connection is proven usable.
- Human OAuth/login/account actions must be performed by the user when required.
- Do not mark the escrow control complete without the user's explicit confirmation that the file exists on a physically disconnected medium.

## Functional requirements

1. Generate one cryptographically secure 32-byte Meta encryption key and store it only in secure, non-Production configuration used by the migration Preview/future cutover.
2. Reconnect Meta/Facebook and Instagram Login, select the Page, Instagram account, WABA and phone asset, and validate tokens/scopes/expiry with read-only provider calls.
3. Configure a legitimate SMTP provider in self-hosted Auth and prove a controlled admin password reset end-to-end while public signup remains disabled.
4. Obtain/configure a Mercado Pago webhook secret, make signature verification fail closed, and validate a signed controlled request without charging.
5. Keep Gemini available for future Production, keep Google Calendar optional, and require `CRON_SECRET` on all three cron handlers.
6. Re-run the complete verification matrix and report a binary cutover verdict.

## Stop conditions

Stop for user action at any provider login, OAuth consent, new persistent credential creation, domain verification, mailbox confirmation, or physical USB verification step.
