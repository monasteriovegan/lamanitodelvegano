export function normalizeAmountToNumber(amountInput: string | number | null | undefined): number | null {
  if (amountInput === null || amountInput === undefined) return null;
  if (typeof amountInput === 'number') return Number.isFinite(amountInput) ? Math.round(amountInput) : null;
  const cleaned = String(amountInput).replace(/[^0-9]/g, '');
  if (!cleaned) return null;
  const num = parseInt(cleaned, 10);
  return Number.isFinite(num) ? num : null;
}

export function generateAmountSearchVariants(amountInput: string | number): string[] {
  const num = normalizeAmountToNumber(amountInput);
  if (num === null) {
    const raw = String(amountInput).trim();
    return raw ? [raw] : [];
  }

  const rawDigits = String(num);
  const clpDot = num.toLocaleString('es-CL'); // e.g. "22.950"
  const clpComma = num.toLocaleString('de-DE'); // e.g. "22.950"
  const clpSpace = rawDigits.length > 3 ? `${rawDigits.slice(0, -3)} ${rawDigits.slice(-3)}` : rawDigits;

  const set = new Set<string>([
    rawDigits,
    clpDot,
    clpComma,
    clpSpace,
    `$${rawDigits}`,
    `$ ${rawDigits}`,
    `$${clpDot}`,
    `$ ${clpDot}`,
    `$${clpSpace}`,
    `$ ${clpSpace}`,
  ]);

  return Array.from(set);
}

export function textContainsAmount(text: string | null | undefined, amountInput: string | number): boolean {
  if (!text) return false;
  const variants = generateAmountSearchVariants(amountInput);
  const normalizedText = text.toLowerCase();
  return variants.some((variant) => normalizedText.includes(variant.toLowerCase()));
}
