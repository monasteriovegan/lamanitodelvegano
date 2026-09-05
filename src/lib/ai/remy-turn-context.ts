export type RemyTurnHistoryRow = {
  direction: 'inbound' | 'outbound';
  body: string;
};

const QUANTITY = String.raw`(?:\d{1,2}|un(?:o|a)?|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|diecis[eé]is|diecisiete|dieciocho|diecinueve|veinte)`;
const CART_MUTATION = new RegExp(
  String.raw`(?:\b(?:agrega|agregar|a[nñ]ade|a[nñ]adir|dame|ponme)\b|\bquiero\s+(?:comprar\b|${QUANTITY}\b)|\b(?:me\s+)?llevo\s+${QUANTITY}\b)`,
  'i',
);
const SHORT_CONFIRM = /^(?:s[ií](?:\s+confirmo)?|confirmo|dale|ok|okay|ya|por\s*favor|hazlo|vamos)$/i;

export function isCartMutationIntent(text: string) {
  return CART_MUTATION.test(String(text || '').trim());
}

export function isShortCommerceConfirmation(text: string) {
  return SHORT_CONFIRM.test(String(text || '').trim());
}

/**
 * A short “sí/confirmo/dale” carries no product words of its own. In that
 * situation we keep the latest meaningful customer turn as the catalog query
 * instead of starting a brand-new lookup for the confirmation phrase.
 */
export function resolveCatalogLookupText(currentText: string, history: RemyTurnHistoryRow[]) {
  const current = String(currentText || '').trim();
  if (!isShortCommerceConfirmation(current)) return current;

  for (let index = history.length - 1; index >= 0; index -= 1) {
    const row = history[index];
    if (row.direction !== 'inbound') continue;
    const candidate = String(row.body || '').trim();
    if (!candidate || candidate === current || isShortCommerceConfirmation(candidate)) continue;
    return candidate;
  }
  return current;
}
