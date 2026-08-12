import { getCurrentAdminUser } from '@/lib/supabase/server-auth';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { SettingsRepository } from '@/lib/repositories/settings-repository';
import { getSchemaCapabilities } from '@/lib/repositories/schema-capabilities';

export const dynamic = 'force-dynamic';

export async function GET() {
  const admin = await getCurrentAdminUser();
  if (!admin) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const db = createSupabaseServiceClient();
  const capabilities = getSchemaCapabilities();
  const transportsPromise = capabilities.supportTables
    ? db.from('messaging_transport_status').select('transport,status,last_inbound_at,last_outbound_at,last_error,updated_at')
    : Promise.resolve({ data: [], error: null });
  const [{ data: transports }, ai, { data: integration }] = await Promise.all([
    transportsPromise,
    new SettingsRepository(db).getAiSettings(),
    db
      .from('integraciones_secretas')
      .select('wa_phone_number_id')
      .eq('id', 'global')
      .maybeSingle(),
  ]);

  return Response.json({
    number: '+56 9 9081 6124',
    business_app: 'not_verified',
    cloud_api:
      integration?.wa_phone_number_id === '1022209807648757'
        ? 'connected'
        : 'configuration_mismatch',
    waba_id: '1129249369256097',
    phone_number_id: '1022209807648757',
    quality: 'GREEN',
    transports: transports ?? [],
    crm_sync: 'configured',
    automatic_ai: 'OFF',
    real_sends: process.env.META_SEND_MODE === 'live' ? 'ENABLED' : 'DISABLED',
  });
}
