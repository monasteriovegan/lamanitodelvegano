import {sendWhatsAppCloud} from './transports/whatsapp-cloud';
export async function sendMessage(input:{channel:'whatsapp';customerId?:string;conversationId:string;to:string;text:string}){if(input.channel!=='whatsapp')throw new Error('unsupported_channel');return sendWhatsAppCloud({to:input.to,text:input.text})}
