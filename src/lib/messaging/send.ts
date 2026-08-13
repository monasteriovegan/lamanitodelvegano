import { sendWhatsAppCloud } from './transports/whatsapp-cloud';
import { sendInstagramMeta } from './transports/instagram-meta';

type SendInput = {
  channel: 'whatsapp' | 'instagram';
  customerId?: string;
  conversationId: string;
  to: string;
  text: string;
  mode?: 'manual' | 'automatic';
};

export async function sendMessage(input: SendInput) {
  const options = { manual: input.mode === 'manual' };
  if (input.channel === 'whatsapp') {
    return sendWhatsAppCloud({ to: input.to, text: input.text }, options);
  }
  if (input.channel === 'instagram') {
    return sendInstagramMeta({ to: input.to, text: input.text }, options);
  }
  throw new Error('unsupported_channel');
}
