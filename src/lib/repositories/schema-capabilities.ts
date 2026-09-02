import 'server-only';

export const RECONCILED_SCHEMA_VERSION = 'omnichannel-reconciled-v2';

export type SchemaCapabilities = {
  version: 'current' | typeof RECONCILED_SCHEMA_VERSION;
  reconciled: boolean;
  customerCrm: boolean;
  orderExtensions: boolean;
  supportTables: boolean;
  persistentCart: boolean;
  conversionHub: boolean;
  messagingExtensions: boolean;
  checkoutWrites: boolean;
};

export class SchemaCapabilityError extends Error {
  readonly code = 'SCHEMA_MIGRATION_REQUIRED';
  readonly capability: keyof SchemaCapabilities;

  constructor(capability: keyof SchemaCapabilities) {
    super(`La capacidad "${capability}" requiere ${RECONCILED_SCHEMA_VERSION}.`);
    this.name = 'SchemaCapabilityError';
    this.capability = capability;
  }
}

export function getSchemaCapabilities(
  env?: { SUPABASE_SCHEMA_VERSION?: string; SUPABASE_CHECKOUT_SCHEMA_READY?: string },
): SchemaCapabilities {
  const source = env || process.env;
  const configuredVersion = source.SUPABASE_SCHEMA_VERSION?.trim();

  // V2 is already installed in the canonical Supabase project. Older deployments
  // that do not carry the version flag must therefore use the reconciled schema,
  // while an explicitly different version still fails closed.
  const reconciled = !configuredVersion || configuredVersion === RECONCILED_SCHEMA_VERSION;

  return {
    version: reconciled ? RECONCILED_SCHEMA_VERSION : 'current',
    reconciled,
    customerCrm: reconciled,
    orderExtensions: reconciled,
    supportTables: reconciled,
    persistentCart: reconciled,
    conversionHub: reconciled,
    messagingExtensions: reconciled,
    // Checkout writes remain independently gated. This does not enable Production checkout.
    checkoutWrites: reconciled && source.SUPABASE_CHECKOUT_SCHEMA_READY === 'true',
  };
}

export function requireSchemaCapability(
  capabilities: SchemaCapabilities,
  capability: keyof SchemaCapabilities,
) {
  if (capabilities[capability] !== true) throw new SchemaCapabilityError(capability);
}
