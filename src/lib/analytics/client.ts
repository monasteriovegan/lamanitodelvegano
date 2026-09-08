'use client';

const CURRENCY = 'CLP';
const FIRST_PARTY_ENDPOINT = '/api/analytics/events';

export type AnalyticsItem = {
  id: string | number;
  name: string;
  price?: number;
  quantity?: number;
};

export type CommerceEvent = { items: AnalyticsItem[]; value: number };

function metaTrack(eventName: string, parameters: Record<string, unknown>, eventId?: string) {
  if (typeof window === 'undefined') return;
  const options = eventId ? { eventID: eventId } : undefined;
  if (!window.fbq) {
    window.__lmvPendingMetaEvents = window.__lmvPendingMetaEvents || [];
    window.__lmvPendingMetaEvents.push(['track', eventName, parameters, options]);
    return;
  }
  window.fbq('track', eventName, parameters, options);
}

function googleTrack(eventName: string, parameters: Record<string, unknown>) {
  if (typeof window === 'undefined') return;
  if (!window.gtag || !window.__lmvAnalytics?.initialPageViewSent) {
    window.__lmvPendingGoogleEvents = window.__lmvPendingGoogleEvents || [];
    window.__lmvPendingGoogleEvents.push([eventName, parameters]);
    return;
  }
  window.gtag('event', eventName, parameters);
}

function firstPartySessionId() {
  if (typeof window === 'undefined') return null;
  try {
    const key = 'lmv_analytics_session_id';
    const existing = window.sessionStorage.getItem(key);
    if (existing) return existing;
    const created = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    window.sessionStorage.setItem(key, created);
    return created;
  } catch {
    return null;
  }
}

function persistFirstPartyEvent(eventName: string, parameters: Record<string, unknown>) {
  if (typeof window === 'undefined') return;
  const body = {
    event_name: eventName,
    event_params: parameters,
    page_path: `${window.location.pathname}${window.location.search}`,
    session_id: firstPartySessionId(),
  };

  void fetch(FIRST_PARTY_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    keepalive: true,
    body: JSON.stringify(body),
  }).catch(() => {
    // First-party observability must never block the customer flow or vendor analytics.
  });
}

function metaCommerceParameters({ items, value }: CommerceEvent) {
  return {
    content_ids: items.map((item) => String(item.id)),
    content_name: items.length === 1 ? items[0].name : undefined,
    content_type: 'product',
    contents: items.map((item) => ({ id: String(item.id), quantity: item.quantity ?? 1 })),
    currency: CURRENCY,
    num_items: items.reduce((total, item) => total + (item.quantity ?? 1), 0),
    value,
  };
}

function googleItems(items: AnalyticsItem[]) {
  return items.map((item) => ({
    item_id: String(item.id),
    item_name: item.name,
    price: item.price,
    quantity: item.quantity ?? 1,
  }));
}

function attributionParameters() {
  if (typeof window === 'undefined') return {};
  const params = new URLSearchParams(window.location.search);
  return Object.fromEntries(
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']
      .map((key) => [key, params.get(key)])
      .filter((entry): entry is [string, string] => Boolean(entry[1])),
  );
}

export function trackPageView(url = window.location.href) {
  const parameters = {
    page_location: url,
    page_title: document.title,
  };
  metaTrack('PageView', {});
  googleTrack('page_view', {
    ...parameters,
    page_path: `${window.location.pathname}${window.location.search}`,
  });
  persistFirstPartyEvent('PageView', parameters);
}

export function trackViewContent(item: Required<Pick<AnalyticsItem, 'id' | 'name' | 'price'>>) {
  const parameters = { ...metaCommerceParameters({ items: [item], value: item.price }), ...attributionParameters() };
  metaTrack('ViewContent', parameters);
  googleTrack('view_item', { currency: CURRENCY, value: item.price, items: googleItems([item]), ...attributionParameters() });
  persistFirstPartyEvent('ViewContent', parameters);
}

export function trackAddToCart(event: CommerceEvent) {
  const parameters = { ...metaCommerceParameters(event), ...attributionParameters() };
  metaTrack('AddToCart', parameters);
  googleTrack('add_to_cart', { currency: CURRENCY, value: event.value, items: googleItems(event.items), ...attributionParameters() });
  persistFirstPartyEvent('AddToCart', parameters);
}

export function trackInitiateCheckout(event: CommerceEvent) {
  const parameters = { ...metaCommerceParameters(event), ...attributionParameters() };
  metaTrack('InitiateCheckout', parameters);
  googleTrack('begin_checkout', { currency: CURRENCY, value: event.value, items: googleItems(event.items), ...attributionParameters() });
  persistFirstPartyEvent('InitiateCheckout', parameters);
}

export function trackContact(contactMethod: 'whatsapp' | 'instagram' | 'web', details: Partial<CommerceEvent> = {}) {
  const item = details.items?.[0];
  const parameters = {
    contact_method: contactMethod,
    content_ids: details.items?.map((entry) => String(entry.id)),
    content_name: item?.name,
    content_type: details.items?.length ? 'product' : undefined,
    currency: details.value === undefined ? undefined : CURRENCY,
    value: details.value,
    ...attributionParameters(),
  };
  metaTrack('Contact', parameters);
  googleTrack('contact', { ...parameters, items: details.items ? googleItems(details.items) : undefined });
  persistFirstPartyEvent('Contact', parameters);
}

export function trackPurchase(orderId: string, event: CommerceEvent) {
  const eventId = `purchase_${orderId}`;
  metaTrack('Purchase', { ...metaCommerceParameters(event), ...attributionParameters() }, eventId);
  googleTrack('purchase', {
    transaction_id: orderId,
    currency: CURRENCY,
    value: event.value,
    items: googleItems(event.items),
    ...attributionParameters(),
  });
}
