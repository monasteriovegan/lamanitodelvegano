import { sendWhatsAppCloud } from './transports/whatsapp-cloud';

type WhatsAppSendInput = {
  channel: 'whatsapp';
  customerId?: string;
  conversationId: string;
  to: string;
  text: string;
};

export async function sendMessage(input: WhatsAppSendInput) {
  if (input.channel !== 'whatsapp') throw new Error('unsupported_channel');
  return sendWhatsAppCloud({ to: input.to, text: input.text });
}
