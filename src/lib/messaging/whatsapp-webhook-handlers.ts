type SendMode = 'disabled' | 'read_only' | 'live';

type Inspection = {
  objectType: string | null;
  fields: string[];
  messageCount: number;
  statusCount: number;
  echoCount: number;
  observedPhoneNumberId: string | null;
};

type Observation = {
  outcome:
    | 'received'
    | 'signature_invalid'
    | 'invalid_json'
    | 'payload_ignored'
    | 'phone_number_mismatch'
    | 'asset_not_connected'
    | 'duplicate'
    | 'persistence_failed'
    | 'persisted';
  requestId: string;
  observedPhoneNumberId?: string | null;
  configuredPhoneNumberId?: string | null;
  counts?: { messages: number; statuses: number; echoes: number };
  errorCode?: string | null;
};

type NormalizedWebhookMessage = {
  direction: string;
  message_type: string;
  raw_payload?: unknown;
};

type PersistResult = {
  duplicate: boolean;
  conversationId: string;
  customerId: string | null;
  messageId: string | null;
};

type WhatsAppWebhookDependencies = {
  createDb: () => any;
  verify: (raw: string, signature: string | null, secret?: string) => boolean;
  normalize: (payload: unknown) => NormalizedWebhookMessage[];
  inspect: (payload: unknown) => Inspection;
  observe: (db: any, input: Observation) => Promise<void>;
  persist: (db: any, message: any) => Promise<PersistResult>;
  autoReply: (db: any, result: PersistResult, message: any) => Promise<{ called: boolean; replied: boolean }>;
  // Optional: cheap, no-AI-cost filter + batched AI extraction that turns a
  // conversation into a pedido when Remy itself did NOT handle this turn
  // (switched off, human takeover, outside the 24h window, etc). See
  // src/lib/orders/whatsapp-auto-sale.ts. Failures here are logged and
  // swallowed — this is a best-effort enhancement, never a reason to fail
  // the webhook response to Meta.
  autoSale?: (db: any, result: PersistResult, message: any) => Promise<void>;
  appSecret?: string;
  verifyToken?: string;
  configuredPhoneNumberId?: string;
  sendMode: () => SendMode;
  logError?: (event: string, details: Record<string, unknown>) => void;
};

function counts(inspection: Inspection) {
  return {
    messages: inspection.messageCount,
    statuses: inspection.statusCount,
    echoes: inspection.echoCount,
  };
}

export function createWhatsAppWebhookHandlers(deps: WhatsAppWebhookDependencies) {
  async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('hub.mode');
    const token = searchParams.get('hub.verify_token');
    const challenge = searchParams.get('hub.challenge');

    const db = deps.createDb();
    const { data: config } = await db
      .from('integraciones_secretas')
      .select('wa_verify_token')
      .eq('id', 'global')
      .maybeSingle();

    const expected = deps.verifyToken || process.env.META_WEBHOOK_VERIFY_TOKEN || config?.wa_verify_token;
    if (mode === 'subscribe' && token && expected && token === expected) {
      return new Response(challenge, { status: 200 });
    }
    return new Response('Verificación fallida', { status: 403 });
  }

  async function POST(request: Request) {
    const requestId = crypto.randomUUID();
    const db = deps.createDb();
    const emptyInspection: Inspection = {
      objectType: null,
      fields: [],
      messageCount: 0,
      statusCount: 0,
      echoCount: 0,
      observedPhoneNumberId: null,
    };
    let inspection = emptyInspection;

    const observe = async (input: Omit<Observation, 'requestId'>) => {
      try {
        await deps.observe(db, { requestId, ...input });
      } catch {
        (deps.logError ?? console.error)('whatsapp_webhook_observation_failed', { stage: input.outcome });
      }
    };

    const attemptAutoSale = async (result: PersistResult, message: any) => {
      if (!deps.autoSale) return;
      try {
        await deps.autoSale(db, result, message);
      } catch {
        (deps.logError ?? console.error)('whatsapp_webhook_autosale_failed', { requestId });
      }
    };

    await observe({ outcome: 'received', counts: counts(inspection) });
    const raw = await request.text();
    if (!deps.verify(raw, request.headers.get('x-hub-signature-256'), deps.appSecret)) {
      await observe({ outcome: 'signature_invalid', errorCode: 'signature_invalid', counts: counts(inspection) });
      return Response.json({ error: 'invalid_signature' }, { status: 401 });
    }

    let payload: unknown;
    try {
      payload = JSON.parse(raw);
    } catch {
      await observe({ outcome: 'invalid_json', errorCode: 'invalid_json', counts: counts(inspection) });
      return Response.json({ error: 'invalid_json' }, { status: 400 });
    }

    inspection = deps.inspect(payload);
    const observationBase = {
      observedPhoneNumberId: inspection.observedPhoneNumberId,
      configuredPhoneNumberId: deps.configuredPhoneNumberId ?? null,
      counts: counts(inspection),
    };
    if (
      deps.configuredPhoneNumberId
      && inspection.observedPhoneNumberId
      && deps.configuredPhoneNumberId !== inspection.observedPhoneNumberId
    ) {
      await observe({ ...observationBase, outcome: 'phone_number_mismatch', errorCode: 'phone_number_mismatch' });
      return Response.json({ ok: true, ignored: true, reason: 'phone_number_mismatch' });
    }

    const messages = deps.normalize(payload);
    if (messages.length === 0) {
      await observe({ ...observationBase, outcome: 'payload_ignored' });
      return Response.json({ ok: true, ignored: true, reason: 'payload_ignored' });
    }

    let stored = 0;
    let duplicates = 0;
    let statuses = 0;
    let appEchoes = 0;
    let aiCalled = 0;
    let aiReplied = 0;

    try {
      for (const message of messages) {
        const isStatus = message.message_type.startsWith('status:');
        const rawPayload = message.raw_payload && typeof message.raw_payload === 'object'
          ? message.raw_payload as Record<string, unknown>
          : {};
        const isAppEcho = rawPayload.source === 'whatsapp_business_app';
        const result = await deps.persist(db, message);

        if (isStatus) {
          statuses += 1;
        } else if (result.duplicate) {
          duplicates += 1;
        } else {
          stored += 1;
          if (isAppEcho) appEchoes += 1;
        }

        if (!result.duplicate && !isStatus) {
          // Messages sent by a human from the WhatsApp Business app must never
          // invoke Remy, but they do need to reach auto-sale reconciliation so
          // a human "pago/transferencia recibida" acknowledgement can mark the
          // already-created order paid immediately.
          if (isAppEcho && message.direction === 'outbound') {
            await attemptAutoSale(result, message);
          } else if (message.direction === 'inbound') {
            let repliedThisTurn = false;
            if (deps.sendMode() === 'live') {
              const ai = await deps.autoReply(db, result, message);
              if (ai.called) aiCalled += 1;
              if (ai.replied) {
                aiReplied += 1;
                repliedThisTurn = true;
              }
            }
            // Only attempt the batched auto-sale extraction when Remy did not
            // itself handle this turn, to avoid two independent order-creation
            // paths racing on the same conversation. Both ultimately go through
            // the same idempotent checkout RPC, but they use different
            // idempotency keys, so this keeps them from ever overlapping.
            if (!repliedThisTurn) await attemptAutoSale(result, message);
          }
        }
      }

      const outcome = stored > 0 || statuses > 0 || appEchoes > 0 ? 'persisted' : 'duplicate';
      await observe({ ...observationBase, outcome });
      return Response.json({
        ok: true,
        stored,
        duplicates,
        statuses,
        app_echoes: appEchoes,
        ai_called: aiCalled > 0,
        ai_replied: aiReplied > 0,
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'meta_asset_not_connected') {
        await observe({ ...observationBase, outcome: 'asset_not_connected', errorCode: 'asset_not_connected' });
        return Response.json({ ok: true, ignored: true, reason: 'asset_not_connected' });
      }
      await observe({ ...observationBase, outcome: 'persistence_failed', errorCode: 'persist_failed' });
      (deps.logError ?? console.error)('whatsapp_webhook_persist_failed', { requestId, code: 'persist_failed' });
      return Response.json({ error: 'persist_failed' }, { status: 500 });
    }
  }

  return { GET, POST };
}
