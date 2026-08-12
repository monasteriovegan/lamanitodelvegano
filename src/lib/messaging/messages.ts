import type {SupabaseClient} from '@supabase/supabase-js';
import {resolveCustomer} from './identity';
import type {NormalizedMessage,PersistedMessage} from './types';

export async function persistMessage(db:SupabaseClient,message:NormalizedMessage):Promise<PersistedMessage>{
 const{data:existing}=await db.from('crm_messages').select('id,conversation_id').eq('provider',message.provider).eq('transport',message.transport).eq('provider_message_id',message.provider_message_id).maybeSingle();
 if(existing)return{duplicate:true,conversationId:existing.conversation_id,customerId:null,messageId:existing.id};
 const{data:business,error:businessError}=await db.from('businesses').select('id').eq('slug','la-manito-del-vegano').single();if(businessError)throw businessError;
 const isStatus=message.message_type.startsWith('status:');
 const customerId=isStatus?null:await resolveCustomer(db,business.id,{channel:message.channel,externalId:message.external_user_id,phone:message.channel==='whatsapp'?message.external_user_id:undefined,name:message.display_name});
 const{data:conversation,error:conversationError}=await db.from('crm_conversations').upsert({business_id:business.id,customer_id:customerId,channel:message.channel,external_thread_id:message.external_thread_id,external_username:message.display_name??null,status:'open',last_message_at:message.sent_at,updated_at:new Date().toISOString()},{onConflict:'business_id,channel,external_thread_id'}).select('id,customer_id').single();if(conversationError)throw conversationError;
 const{data:created,error}=await db.from('crm_messages').insert({conversation_id:conversation.id,channel:message.channel,provider:message.provider,transport:message.transport,provider_message_id:message.provider_message_id,external_message_id:message.provider_message_id,external_thread_id:message.external_thread_id,direction:message.direction,sender_type:message.sender_type,text:message.text,message_type:message.message_type,raw_payload:message.raw_payload,sent_at:message.sent_at}).select('id').single();
 if(error){if(error.code==='23505')return{duplicate:true,conversationId:conversation.id,customerId:conversation.customer_id,messageId:null};throw error}
 if(!isStatus)await db.from('messaging_transport_status').upsert({transport:message.transport,status:'connected',last_inbound_at:message.direction==='inbound'?new Date().toISOString():undefined,updated_at:new Date().toISOString()});
 return{duplicate:false,conversationId:conversation.id,customerId:conversation.customer_id,messageId:created.id}
}
