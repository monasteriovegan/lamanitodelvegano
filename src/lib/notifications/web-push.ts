import {
  createCipheriv,
  createECDH,
  createHmac,
  createPrivateKey,
  randomBytes,
  sign as cryptoSign,
} from 'node:crypto';

export type AdminPushPayload = {
  title: string;
  body: string;
  url: string;
  tag: string;
};

export type BrowserPushSubscription = {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
};

export type VapidConfig = {
  publicKey: string;
  privateKey: string;
  subject: string;
};

export type OrderPushFacts = {
  numeric_id: number;
  order_number?: string | null;
  total: number;
  delivery_date?: string | null;
};

const MONTHS_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

const ALLOWED_PUSH_HOSTS = new Set([
  'fcm.googleapis.com',
  'updates.push.services.mozilla.com',
  'push.services.mozilla.com',
  'web.push.apple.com',
]);

function base64UrlEncode(value: Buffer | Uint8Array | string): string {
  const buffer = typeof value === 'string' ? Buffer.from(value, 'utf8') : Buffer.from(value);
  return buffer.toString('base64url');
}

export function decodeBase64Url(value: string): Buffer {
  return Buffer.from(String(value || '').trim(), 'base64url');
}

function formatClp(value: number): string {
  const safe = Number.isFinite(value) ? Math.round(value) : 0;
  return `$${safe.toLocaleString('es-CL')}`;
}

function formatDeliveryDate(value: string | null | undefined): string | null {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(day) || day < 1 || day > 31) return null;
  return `${day} de ${MONTHS_ES[month - 1]}`;
}

export function isSafeAdminDeepLink(value: string): boolean {
  const raw = String(value || '').trim();
  if (!raw.startsWith('/') || raw.startsWith('//')) return false;
  try {
    const base = 'https://wonka.internal';
    const parsed = new URL(raw, base);
    return parsed.origin === base
      && (parsed.pathname === '/admin' || parsed.pathname.startsWith('/admin/'));
  } catch {
    return false;
  }
}

export function isAllowedPushEndpoint(value: string): boolean {
  try {
    const parsed = new URL(String(value || '').trim());
    return parsed.protocol === 'https:' && ALLOWED_PUSH_HOSTS.has(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}

export function isExpiredPushStatus(status: number): boolean {
  return status === 404 || status === 410;
}

export function buildOrderPaidPushPayload(order: OrderPushFacts): AdminPushPayload {
  const orderId = Number(order.numeric_id);
  if (!Number.isInteger(orderId) || orderId <= 0) throw new Error('invalid_order_id_for_push');
  const lines = [
    `Pedido #${orderId} · ${formatClp(Number(order.total || 0))}`,
    'Pago aprobado ✅',
  ];
  const delivery = formatDeliveryDate(order.delivery_date);
  if (delivery) lines.push(`Entrega: ${delivery}`);
  return {
    title: '🛍️ Nueva venta — La Manito',
    body: lines.join('\n'),
    url: `/admin/pedidos/${orderId}`,
    tag: `order-paid-${orderId}`,
  };
}

export function buildTestPushPayload(): AdminPushPayload {
  return {
    title: '✅ Wonka Hub',
    body: 'Las notificaciones están funcionando correctamente.',
    url: '/admin',
    tag: `wonka-test-${Date.now()}`,
  };
}

export function validateBrowserPushSubscription(value: unknown): BrowserPushSubscription | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, any>;
  const endpoint = String(raw.endpoint || '').trim();
  const p256dh = String(raw.keys?.p256dh || '').trim();
  const auth = String(raw.keys?.auth || '').trim();
  if (!isAllowedPushEndpoint(endpoint)) return null;
  const userPublicKey = decodeBase64Url(p256dh);
  const authSecret = decodeBase64Url(auth);
  if (userPublicKey.length !== 65 || userPublicKey[0] !== 4 || authSecret.length < 16) return null;
  return { endpoint, keys: { p256dh, auth } };
}

function hmacSha256(key: Buffer, value: Buffer): Buffer {
  return createHmac('sha256', key).update(value).digest();
}

function hkdfExpand(prk: Buffer, info: Buffer, length: number): Buffer {
  const chunks: Buffer<ArrayBufferLike>[] = [];
  let previous: Buffer<ArrayBufferLike> = Buffer.alloc(0);
  let produced = 0;
  let counter = 1;
  while (produced < length) {
    previous = hmacSha256(prk, Buffer.concat([previous, info, Buffer.from([counter])]));
    chunks.push(previous);
    produced += previous.length;
    counter += 1;
  }
  return Buffer.concat(chunks).subarray(0, length);
}

export function encryptWebPushPayload(
  subscription: BrowserPushSubscription,
  payload: AdminPushPayload,
): Buffer {
  const validated = validateBrowserPushSubscription(subscription);
  if (!validated) throw new Error('invalid_push_subscription');

  const userPublicKey = decodeBase64Url(validated.keys.p256dh);
  const authSecret = decodeBase64Url(validated.keys.auth);
  const sender = createECDH('prime256v1');
  sender.generateKeys();
  const senderPublicKey = sender.getPublicKey();
  const sharedSecret = sender.computeSecret(userPublicKey);

  const prkKey = hmacSha256(authSecret, sharedSecret);
  const keyInfo = Buffer.concat([
    Buffer.from('WebPush: info\0', 'utf8'),
    userPublicKey,
    senderPublicKey,
  ]);
  const ikm = hkdfExpand(prkKey, keyInfo, 32);

  const salt = randomBytes(16);
  const prk = hmacSha256(salt, ikm);
  const cek = hkdfExpand(prk, Buffer.from('Content-Encoding: aes128gcm\0', 'utf8'), 16);
  const nonce = hkdfExpand(prk, Buffer.from('Content-Encoding: nonce\0', 'utf8'), 12);

  const plaintext = Buffer.concat([
    Buffer.from(JSON.stringify(payload), 'utf8'),
    Buffer.from([2]),
  ]);
  const cipher = createCipheriv('aes-128-gcm', cek, nonce, { authTagLength: 16 });
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final(), cipher.getAuthTag()]);

  const recordSize = Buffer.alloc(4);
  recordSize.writeUInt32BE(4096, 0);
  return Buffer.concat([
    salt,
    recordSize,
    Buffer.from([senderPublicKey.length]),
    senderPublicKey,
    ciphertext,
  ]);
}

function buildVapidAuthorization(endpoint: string, config: VapidConfig): string {
  const publicKey = decodeBase64Url(config.publicKey);
  const privateKey = decodeBase64Url(config.privateKey);
  if (publicKey.length !== 65 || publicKey[0] !== 4 || privateKey.length !== 32) {
    throw new Error('invalid_vapid_key_material');
  }
  if (!(config.subject.startsWith('mailto:') || config.subject.startsWith('https://'))) {
    throw new Error('invalid_vapid_subject');
  }

  const keyObject = createPrivateKey({
    key: {
      kty: 'EC',
      crv: 'P-256',
      x: base64UrlEncode(publicKey.subarray(1, 33)),
      y: base64UrlEncode(publicKey.subarray(33, 65)),
      d: base64UrlEncode(privateKey),
    } as any,
    format: 'jwk',
  });
  const header = base64UrlEncode(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const claims = base64UrlEncode(JSON.stringify({
    aud: new URL(endpoint).origin,
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
    sub: config.subject,
  }));
  const signingInput = `${header}.${claims}`;
  const signature = cryptoSign('sha256', Buffer.from(signingInput, 'utf8'), {
    key: keyObject,
    dsaEncoding: 'ieee-p1363',
  });
  const jwt = `${signingInput}.${base64UrlEncode(signature)}`;
  return `vapid t=${jwt}, k=${config.publicKey}`;
}

export function buildWebPushRequest(
  subscription: BrowserPushSubscription,
  payload: AdminPushPayload,
  config: VapidConfig,
): { body: Buffer; headers: Record<string, string> } {
  return {
    body: encryptWebPushPayload(subscription, payload),
    headers: {
      Authorization: buildVapidAuthorization(subscription.endpoint, config),
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: '300',
      Urgency: 'high',
    },
  };
}
