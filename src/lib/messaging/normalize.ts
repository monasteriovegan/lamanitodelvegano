import type {NormalizedMessage} from './types';

export function normalizePhone(value:string){const digits=value.replace(/\D/g,'');return digits.startsWith('56')?digits:digits.length===9&&digits.startsWith('9')?`56${digits}`:digits}

export function normalizeMetaWhatsApp(payload:any):NormalizedMessage[]{
 const out:NormalizedMessage[]=[];
 for(const entry of payload?.entry??[])for(const change of entry?.changes??[]){const value=change?.value??{};for(const message of value.messages??[]){const from=normalizePhone(String(message.from??''));if(!from||!message.id)continue;out.push({channel:'whatsapp',provider:'meta',transport:'cloud_api',provider_message_id:String(message.id),external_thread_id:from,external_user_id:from,direction:'inbound',sender_type:'customer',text:message.text?.body??message.button?.text??null,message_type:String(message.type??'unknown'),sent_at:new Date(Number(message.timestamp??Date.now()/1000)*1000).toISOString(),raw_payload:{metadata:value.metadata,contacts:value.contacts,message},display_name:value.contacts?.[0]?.profile?.name??null})}for(const status of value.statuses??[]){if(!status.id)continue;out.push({channel:'whatsapp',provider:'meta',transport:'cloud_api',provider_message_id:`status:${status.id}:${status.status}`,external_thread_id:normalizePhone(String(status.recipient_id??'')),external_user_id:normalizePhone(String(status.recipient_id??'')),direction:'outbound',sender_type:'system',text:null,message_type:`status:${status.status}`,sent_at:new Date(Number(status.timestamp??Date.now()/1000)*1000).toISOString(),raw_payload:{metadata:value.metadata,status}})}}return out
}

export function normalizeBaileys(payload:any):NormalizedMessage{
 const phone=normalizePhone(String(payload.phone??payload.remoteJid??''));return{channel:'whatsapp',provider:'whatsapp_web',transport:'baileys',provider_message_id:String(payload.messageId),external_thread_id:phone,external_user_id:phone,direction:payload.fromMe?'outbound':'inbound',sender_type:payload.fromMe?'human':'customer',text:payload.text??null,message_type:'text',sent_at:new Date(payload.timestamp).toISOString(),raw_payload:payload,display_name:payload.pushName??null}
}
