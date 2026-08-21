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

  // V2 is installed and verified in the canonical Supabase project. Deployments
  // without a version flag therefore use the reconciled schema. An explicitly
  // different version still fails closed.
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
    // The canonical V2 schema is production-ready. Keep an explicit false value
    // as an emergency kill switch without requiring a second positive flag.
    checkoutWrites: reconciled && source.SUPABASE_CHECKOUT_SCHEMA_READY !== 'false',
  };
}

export function requireSchemaCapability(
  capabilities: SchemaCapabilities,
  capability: keyof SchemaCapabilities,
) {
  if (capabilities[capability] !== true) throw new SchemaCapabilityError(capability);
}
