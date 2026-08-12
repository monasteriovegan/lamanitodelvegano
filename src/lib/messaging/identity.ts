import type { SupabaseClient } from '@supabase/supabase-js';
import { CustomerRepository } from '@/lib/repositories/customers-repository';

type IdentityInput = {
  channel: string;
  externalId: string;
  phone?: string;
  email?: string;
  name?: string | null;
};

export async function resolveCustomer(
  db: SupabaseClient,
  businessUnitId: string,
  input: IdentityInput,
) {
  return new CustomerRepository(db).resolveIdentity(businessUnitId, input);
}
