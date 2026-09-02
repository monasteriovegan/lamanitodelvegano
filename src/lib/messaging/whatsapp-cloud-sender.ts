import type {
  MessagingCapabilityInput,
  MessagingCapabilityDecision,
  MetaSendMode,
} from './capability-policy';

type Credential = { externalId: string; accessToken: string };
type HealthUpdate = {
  status: 'connected' | 'error';
  lastError: string | null;
  outboundSucceeded: boolean;
};

type SenderDependencies = {
  resolveSendMode: () => MetaSendMode;
  evaluateCapability: (input: MessagingCapabilityInput) => MessagingCapabilityDecision;
  getCredential: (businessUnitId: string) => Promise<Credential>;
  normalizePhone: (value: string) => string;
  fetchImpl: typeof fetch;
  writeHealth: (update: HealthUpdate) => Promise<void>;
  graphVersion: string;
};

export function createWhatsAppCloudSender(deps: SenderDependencies) {
  return async function send(
    input: { to: string; text: string },
    options: { manual?: boolean; automatic?: boolean; businessUnitId: string },
  ) {
    const decision = deps.evaluateCapability({
      capability: 'send',
      channel: 'whatsapp',
      origin: options.automatic ? 'automatic' : 'manual',
      sendMode: deps.resolveSendMode(),
      masterEnabled: true,
      channelEnabled: true,
      conversationEnabled: true,
      humanTakeover: false,
      personal: false,
    });
    if (!decision.allowed) throw new Error(decision.reason);

    const credential = await deps.getCredential(options.businessUnitId);
    const response = await deps.fetchImpl(
      `https://graph.facebook.com/${deps.graphVersion}/${encodeURIComponent(credential.externalId)}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${credential.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: deps.normalizePhone(input.to),
          type: 'text',
          text: { body: input.text, preview_url: false },
        }),
        cache: 'no-store',
      },
    );
    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      await deps.writeHealth({
        status: 'error',
        lastError: `Meta HTTP ${response.status}`,
        outboundSucceeded: false,
      });
      throw new Error(`meta_send_failed:${response.status}`);
    }

    await deps.writeHealth({ status: 'connected', lastError: null, outboundSucceeded: true });
    return {
      providerMessageId: String(body.messages?.[0]?.id ?? ''),
      raw: body,
    };
  };
}
