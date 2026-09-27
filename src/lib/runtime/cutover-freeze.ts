export type CutoverFreezeEnvironment = {
  [key: string]: string | undefined;
  LMV_CUTOVER_FREEZE?: string;
};

const PROVIDER_HANDSHAKE_PATHS = new Set(['/api/whatsapp', '/api/instagram']);

export function isCutoverFreezeEnabled(
  environment: CutoverFreezeEnvironment = process.env,
) {
  return environment.LMV_CUTOVER_FREEZE === 'true';
}

export function shouldBlockRequestDuringCutover(
  pathname: string,
  method: string,
  environment: CutoverFreezeEnvironment = process.env,
) {
  if (!isCutoverFreezeEnabled(environment)) return false;
  const normalizedMethod = method.toUpperCase();
  if (normalizedMethod === 'OPTIONS') return false;
  if ((normalizedMethod === 'GET' || normalizedMethod === 'HEAD') && PROVIDER_HANDSHAKE_PATHS.has(pathname)) {
    return false;
  }
  return true;
}
