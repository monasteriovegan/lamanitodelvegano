import {createSupabaseServiceClient} from '@/lib/supabase/server';
import {normalizeMetaWhatsApp} from '@/lib/messaging/normalize';
import {persistMessage} from '@/lib/messaging/messages';
import {verifyHmac} from '@/lib/messaging/signature';

export const dynamic='force-dynamic';

export async function GET(request:Request){
 const url=new URL(request.url),mode=url.searchParams.get('hub.mode'),token=url.searchParams.get('hub.verify_token'),challenge=url.searchParams.get('hub.challenge');
 const db=createSupabaseServiceClient();const{data}=await db.from('integraciones_secretas').select('wa_verify_token').eq('id','global').maybeSingle();const expected=process.env.META_WEBHOOK_VERIFY_TOKEN||data?.wa_verify_token;
 return mode==='subscribe'&&token&&expected&&token===expected?new Response(challenge,{status:200}):new Response('Verificación fallida',{status:403});
}

export async function POST(request:Request){
 const raw=await request.text();
 if(!verifyHmac(raw,request.headers.get('x-hub-signature-256'),process.env.META_APP_SECRET))return Response.json({error:'invalid_signature'},{status:401});
 let payload:any;try{payload=JSON.parse(raw)}catch{return Response.json({error:'invalid_json'},{status:400})}
 const db=createSupabaseServiceClient();let stored=0,duplicates=0,statuses=0;
 try{for(const message of normalizeMetaWhatsApp(payload)){if(message.message_type.startsWith('status:')){statuses++;await db.from('messaging_transport_status').upsert({transport:'cloud_api',status:'connected',updated_at:new Date().toISOString()});continue}const result=await persistMessage(db,message);result.duplicate?duplicates++:stored++}return Response.json({ok:true,stored,duplicates,statuses,ai_called:false})}
 catch(error){console.error('whatsapp_webhook_persist_failed',{message:error instanceof Error?error.message:'unknown'});return Response.json({error:'persist_failed'},{status:500})}
}
