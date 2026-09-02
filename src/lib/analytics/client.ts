'use client';

const CURRENCY = 'CLP';

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
  metaTrack('PageView', {});
  googleTrack('page_view', {
    page_location: url,
    page_path: `${window.location.pathname}${window.location.search}`,
    page_title: document.title,
  });
}

export function trackViewContent(item: Required<Pick<AnalyticsItem, 'id' | 'name' | 'price'>>) {
  metaTrack('ViewContent', { ...metaCommerceParameters({ items: [item], value: item.price }), ...attributionParameters() });
  googleTrack('view_item', { currency: CURRENCY, value: item.price, items: googleItems([item]), ...attributionParameters() });
}

export function trackAddToCart(event: CommerceEvent) {
  metaTrack('AddToCart', { ...metaCommerceParameters(event), ...attributionParameters() });
  googleTrack('add_to_cart', { currency: CURRENCY, value: event.value, items: googleItems(event.items), ...attributionParameters() });
}

export function trackInitiateCheckout(event: CommerceEvent) {
  metaTrack('InitiateCheckout', { ...metaCommerceParameters(event), ...attributionParameters() });
  googleTrack('begin_checkout', { currency: CURRENCY, value: event.value, items: googleItems(event.items), ...attributionParameters() });
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
