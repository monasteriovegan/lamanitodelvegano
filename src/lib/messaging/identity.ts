import type {SupabaseClient} from '@supabase/supabase-js';
import {normalizePhone} from './normalize';

export async function resolveCustomer(db:SupabaseClient,businessId:string,input:{channel:string;externalId:string;phone?:string;email?:string;name?:string|null}){
 const phone=input.phone?normalizePhone(input.phone):null,email=input.email?.trim().toLowerCase()||null;
 const candidates=[input.externalId&&{channel:input.channel,type:'platform_user_id',value:input.externalId},phone&&{channel:'manual',type:'phone',value:phone},email&&{channel:'manual',type:'email',value:email}].filter(Boolean) as {channel:string;type:string;value:string}[];
 for(const candidate of candidates){const{data}=await db.from('customer_identities').select('customer_id').eq('business_id',businessId).eq('channel',candidate.channel).eq('identity_type',candidate.type).eq('normalized_value',candidate.value).maybeSingle();if(data?.customer_id)return data.customer_id}
 let customer:any=null;
 if(phone){const{data}=await db.from('customers').select('id').eq('business_id',businessId).eq('phone',phone).maybeSingle();customer=data}
 if(!customer&&email){const{data}=await db.from('customers').select('id').eq('business_id',businessId).eq('email',email).maybeSingle();customer=data}
 if(!customer){const{data,error}=await db.from('customers').insert({business_id:businessId,phone,email,nombre:input.name||(`Cliente ${phone||email||input.externalId}`),crm_status:'new'}).select('id').single();if(error)throw error;customer=data}
 for(const candidate of candidates)await db.from('customer_identities').upsert({business_id:businessId,customer_id:customer.id,channel:candidate.channel,identity_type:candidate.type,external_id:input.externalId,normalized_value:candidate.value,verified:candidate.type==='platform_user_id'},{onConflict:'business_id,channel,identity_type,normalized_value'});
 return customer.id as string
}
