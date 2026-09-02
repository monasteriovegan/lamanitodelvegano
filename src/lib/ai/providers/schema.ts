export function sanitizeGeminiSchema(schema: any): any {
  if (!schema || typeof schema !== 'object') return schema;
  if (Array.isArray(schema)) return schema.map(sanitizeGeminiSchema);
  const allowed = new Set(['type', 'description', 'properties', 'required', 'enum', 'items', 'minimum', 'maximum', 'minLength', 'maxLength']);
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(schema)) {
    if (!allowed.has(key)) continue;
    if (key === 'properties' && value && typeof value === 'object') {
      clean.properties = Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([name, child]) => [name, sanitizeGeminiSchema(child)]));
    } else if (key === 'items') clean.items = sanitizeGeminiSchema(value);
    else clean[key] = value;
  }
  return clean;
}
