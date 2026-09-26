export function hasValidCronAuthorization(authorization: string | null, secret: string | undefined) {
  const configuredSecret = String(secret || '').trim();
  return Boolean(configuredSecret) && authorization === `Bearer ${configuredSecret}`;
}
