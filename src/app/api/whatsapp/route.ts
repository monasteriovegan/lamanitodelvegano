import { maybeAutoReply } from '@/lib/ai/remy';
import { resolveWhatsAppSendMode } from '@/lib/messaging/capability-policy';
import { persistMessage } from '@/lib/messaging/messages';
import { normalizeMetaWhatsApp } from '@/lib/messaging/normalize';
import { verifyHmac } from '@/lib/messaging/signature';
import {
  inspectWhatsAppEnvelope,
  recordWhatsAppWebhookObservation,
} from '@/lib/messaging/webhook-observability';
import { createWhatsAppWebhookHandlers } from '@/lib/messaging/whatsapp-webhook-handlers';
import { createSupabaseServiceClient } from '@/lib/supabase/server';

export { createWhatsAppWebhookHandlers };

export const dynamic = 'force-dynamic';

const handlers = createWhatsAppWebhookHandlers({
  createDb: createSupabaseServiceClient,
  verify: verifyHmac,
  normalize: normalizeMetaWhatsApp,
  inspect: inspectWhatsAppEnvelope,
  observe: recordWhatsAppWebhookObservation,
  persist: persistMessage,
  autoReply: maybeAutoReply,
  appSecret: process.env.META_APP_SECRET,
  verifyToken: process.env.META_WEBHOOK_VERIFY_TOKEN,
  configuredPhoneNumberId: process.env.WA_PHONE_NUMBER_ID,
  sendMode: resolveWhatsAppSendMode,
});

export const GET = handlers.GET;
export const POST = handlers.POST;
