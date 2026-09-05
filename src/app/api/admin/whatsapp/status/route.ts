import { getCurrentAdminUser } from '@/lib/supabase/server-auth';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { getSchemaCapabilities } from '@/lib/repositories/schema-capabilities';
import { BusinessRepository } from '@/lib/repositories/business-repository';
import { resolveChannelSendMode } from '@/lib/messaging/capability-policy';
import { buildWhatsAppStatus } from '@/lib/messaging/whatsapp-status';

export const dynamic = 'force-dynamic';

export async function GET() {
  const admin = await getCurrentAdminUser();
  if (!admin) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const db = createSupabaseServiceClient();
  const capabilities = getSchemaCapabilities();
  const business = await new BusinessRepository(db).getDefault();
  const transportPromise = capabilities.supportTables
    ? db.from('messaging_transport_status')
      .select('transport,status,last_inbound_at,last_outbound_at,last_error,updated_at,metadata')
      .eq('transport', 'cloud_api')
      .maybeSingle()
    : Promise.resolve({ data: null, error: null });
  const assetPromise = business
    ? db.from('meta_connection_assets')
      .select('external_id,metadata')
      .eq('business_unit_id', business.id)
      .eq('asset_type', 'whatsapp_phone_number')
      .eq('selected', true)
      .limit(1)
      .maybeSingle()
    : Promise.resolve({ data: null, error: null });
  const channelSettingsPromise = business
    ? db.from('channel_settings')
      .select('enabled,auto_reply_enabled,read_only_mode')
      .eq('business_unit_id', business.id)
      .eq('channel', 'whatsapp')
      .maybeSingle()
    : Promise.resolve({ data: null, error: null });

  const [
    { data: transport },
    { data: asset },
    { data: integration },
    { data: channelSettings },
  ] = await Promise.all([
    transportPromise,
    assetPromise,
    db
      .from('integraciones_secretas')
      .select('wa_phone_number_id,ai_enabled')
      .eq('id', 'global')
      .maybeSingle(),
    channelSettingsPromise,
  ]);

  return Response.json(buildWhatsAppStatus({
    transport: transport ?? null,
    integration: integration ?? null,
    asset: asset ?? null,
    callbackUrl: process.env.META_WHATSAPP_CALLBACK_URL,
    sendMode: resolveChannelSendMode(channelSettings),
  }));
}
