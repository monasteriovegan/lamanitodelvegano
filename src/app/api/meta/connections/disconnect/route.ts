import { getCurrentAdminUser } from '@/lib/supabase/server-auth';
import { createSupabaseServiceClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const user = await getCurrentAdminUser();
  const origin = new URL(request.url).origin;
  if (!user) return Response.redirect(new URL('/admin/login', origin), 303);
  const form = await request.formData();
  const connectionId = String(form.get('connection_id') || '');
  const db = createSupabaseServiceClient();
  const { data: connection } = await db.from('meta_connections').select('business_unit_id')
    .eq('id', connectionId).maybeSingle();
  if (!connection) return Response.redirect(new URL('/admin/integraciones?meta_error=not_found', origin), 303);
  const { data: membership } = await db.from('business_members').select('id')
    .eq('business_unit_id', connection.business_unit_id).eq('user_id', user.id).maybeSingle();
  if (!membership) return Response.redirect(new URL('/admin/integraciones?meta_error=forbidden', origin), 303);
  await db.from('meta_connections').update({ status: 'disconnected', last_error_code: null, updated_at: new Date().toISOString() })
    .eq('id', connectionId).eq('business_unit_id', connection.business_unit_id);
  await db.from('meta_connection_assets').update({ selected: false, subscribed: false, updated_at: new Date().toISOString() })
    .eq('connection_id', connectionId).eq('business_unit_id', connection.business_unit_id);
  return Response.redirect(new URL('/admin/integraciones?meta_disconnected=1', origin), 303);
}
