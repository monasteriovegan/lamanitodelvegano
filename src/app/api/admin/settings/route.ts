import { NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { getCurrentAdminUser } from '@/lib/supabase/server-auth';

export async function GET() {
  const admin = await getCurrentAdminUser();
  if (!admin || !['admin', 'soporte'].includes(admin.rol)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const db = createSupabaseServiceClient();
  const { data, error } = await db
    .from('site_settings')
    .select('id,site_name,site_tagline,site_description,logo_url,favicon_url,contact_email,contact_phone,contact_address,contact_city,instagram_url,facebook_url,tiktok_url,youtube_url,pinterest_url,whatsapp_number,whatsapp_message,mp_public_key,transfer_bank_name,transfer_account_type,transfer_account_holder,transfer_account_rut,transfer_account_number,transfer_email,transfer_instructions,banner_enabled,banner_text,banner_color,business_hours,meta_title,meta_description,og_image_url')
    .limit(1)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    return NextResponse.json({ data: null });
  }
  return NextResponse.json({ data });
}

export async function PUT(req: Request) {
  const admin = await getCurrentAdminUser();
  if (!admin || !['admin'].includes(admin.rol)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const db = createSupabaseServiceClient();
  const body = await req.json();
  delete body.mp_access_token; // Prevent token manipulation

  const { data, error } = await db
    .from('site_settings')
    .upsert({ id: 1, ...body, updated_at: new Date().toISOString() }, { onConflict: 'id' })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}
