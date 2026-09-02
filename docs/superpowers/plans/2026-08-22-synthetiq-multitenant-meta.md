# Synthetiq multitenant Meta platform

## Objective

Replace the single-business Meta configuration with official, repeatable tenant onboarding. `business_units` remains the canonical tenant table; no parallel `businesses` model is introduced.

## Data model

- `business_members`: user membership and tenant role.
- `meta_connections`: one server-side Meta authorization per tenant, with encrypted token material, granted scopes, expiry, status and health timestamps.
- `meta_connection_assets`: selected Business, Page, Instagram, WABA, phone-number and ad-account identifiers. Provider identifiers are globally unique per asset type so a webhook can resolve exactly one tenant.
- `meta_oauth_states`: hashed, expiring, single-use OAuth state tied to both authenticated user and tenant.

All four tables use RLS. Membership is readable only by its user; connection metadata and asset selections are visible only to members; ciphertext and OAuth state rows remain service-role only. Server routes still perform explicit tenant filters because RLS is defense in depth, not a substitute for scoped queries.

## Runtime flow

1. An authenticated tenant member starts Meta Connect.
2. The server creates a random state, stores only its hash with user/tenant/expiry, and sends the browser to Meta.
3. The callback atomically consumes the state, exchanges the code server-side, encrypts token material, discovers eligible assets and presents selection.
4. Selection persists asset mappings and subscribes required webhooks progressively.
5. Incoming webhooks derive their recipient asset from the signed payload, resolve the owning tenant, and only then persist CRM/conversation data.
6. Outbound transports load the connection belonging to the conversation's tenant and selected asset.

## Delivery sequence

1. Add schema, constraints, RLS and pure asset-reference extraction with tests.
2. Remove default-business routing from Meta webhooks and require asset resolution.
3. Add tenant-aware OAuth start/callback, authenticated asset selection and encrypted token vault.
4. Replace the global Integrations screen with connection cards, health, reconnect and disconnect controls.
5. Scope remaining admin repositories and outbound transports by tenant.
6. Deploy, run La Manito and Makangru OAuth E2E, verify webhook isolation, then complete Meta review evidence and submission.

## Security invariants

- Never expose access tokens, app secret, encryption key or OAuth state plaintext to client bundles or logs.
- OAuth state is random, hashed at rest, expires, is tied to user plus tenant and is consumed once.
- Every provider asset maps to at most one active tenant connection.
- A webhook with an unknown or ambiguous asset is rejected/ignored safely; it is never assigned to the default tenant.
- The legacy secondary Meta app is not modified.
