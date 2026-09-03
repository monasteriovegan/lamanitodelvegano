const MAX_LABELS = 24;
const MAX_LABEL_LENGTH = 40;

export function normalizeConversationLabels(input: unknown): string[] {
  if (!Array.isArray(input)) return [];

  const labels = input
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
    .map((value) => value
      .normalize('NFKC')
      .replace(/\s+/g, '-')
      .replace(/[^\p{L}\p{N}_-]/gu, '')
      .slice(0, MAX_LABEL_LENGTH))
    .filter(Boolean);

  return Array.from(new Set(labels)).slice(0, MAX_LABELS);
}
