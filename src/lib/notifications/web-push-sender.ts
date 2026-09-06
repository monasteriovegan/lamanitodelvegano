import 'server-only';
import {
  buildWebPushRequest,
  type AdminPushPayload,
  type BrowserPushSubscription,
  type VapidConfig,
} from './web-push';

export type WebPushSendResult = {
  ok: boolean;
  status: number;
  error: string | null;
};

export function getWebPushVapidConfig(): VapidConfig | null {
  const publicKey = String(process.env.WEB_PUSH_VAPID_PUBLIC_KEY || '').trim();
  const privateKey = String(process.env.WEB_PUSH_VAPID_PRIVATE_KEY || '').trim();
  const subject = String(process.env.WEB_PUSH_VAPID_SUBJECT || 'https://lamanitodelvegano.cl').trim();
  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey, subject };
}

export async function sendAdminWebPush(
  subscription: BrowserPushSubscription,
  payload: AdminPushPayload,
): Promise<WebPushSendResult> {
  const vapid = getWebPushVapidConfig();
  if (!vapid) throw new Error('web_push_vapid_not_configured');
  const request = buildWebPushRequest(subscription, payload, vapid);
  const response = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: request.headers,
    body: new Uint8Array(request.body),
    cache: 'no-store',
  });
  let detail = '';
  if (!response.ok) {
    detail = (await response.text().catch(() => '')).slice(0, 500);
  }
  return {
    ok: response.ok,
    status: response.status,
    error: response.ok ? null : detail || `push_provider_http_${response.status}`,
  };
}
