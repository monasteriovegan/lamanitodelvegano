import { maybeAutoReply } from '@/lib/ai/remy';
import { persistMessage } from '@/lib/messaging/messages';
import { normalizeMetaWhatsApp } from '@/lib/messaging/normalize';
import { verifyHmac } from '@/lib/messaging/signature';
import {
  inspectWhatsAppEnvelope,
  recordWhatsAppWebhookObservation,
} from '@/lib/messaging/webhook-observability';
import { createWhatsAppWebhookHandlers } from '@/lib/messaging/whatsapp-webhook-handlers';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import {
  autoRegisterWhatsappConversationSale,
  shouldAttemptWhatsappAutoSale,
} from '@/lib/orders/whatsapp-auto-sale';

export { createWhatsAppWebhookHandlers };

export const dynamic = 'force-dynamic';

async function autoSale(db: any, result: { conversationId: string }, message: any) {
  if (!shouldAttemptWhatsappAutoSale(message)) return;
  const sale = await autoRegisterWhatsappConversationSale(db, result.conversationId);
  console.info('whatsapp_autosale_result', {
    conversationId: result.conversationId,
    status: sale.status,
    missing: sale.missing || [],
    orderId: sale.orderId || null,
    paymentStatus: sale.paymentStatus || null,
  });
}

const handlers = createWhatsAppWebhookHandlers({
  createDb: createSupabaseServiceClient,
  verify: verifyHmac,
  normalize: normalizeMetaWhatsApp,
  inspect: inspectWhatsAppEnvelope,
  observe: recordWhatsAppWebhookObservation,
  persist: persistMessage,
  autoReply: maybeAutoReply,
  autoSale,
  appSecret: process.env.META_APP_SECRET,
  verifyToken: process.env.META_WEBHOOK_VERIFY_TOKEN,
  configuredPhoneNumberId: process.env.WA_PHONE_NUMBER_ID,
  // The canonical channel gate now lives in maybeAutoReply/sendWhatsAppCloud
  // and is read from channel_settings. This keeps the generic webhook handler
  // testable without making Vercel META_* variables a second source of truth.
  sendMode: () => 'live',
});

export const GET = handlers.GET;
export const POST = handlers.POST;
