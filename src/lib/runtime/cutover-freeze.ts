export type CutoverFreezeEnvironment = {
  [key: string]: string | undefined;
  LMV_CUTOVER_FREEZE?: string;
};

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const SIDE_EFFECTING_GET_PREFIXES = [
  '/api/cron/',
  '/api/internal/',
  '/api/meta/oauth/',
  '/api/meta/instagram/oauth/',
  '/api/admin/',
  '/api/worker/',
  '/api/mcp',
  '/api/chat/',
  '/internal-',
];

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
  if (!SAFE_METHODS.has(method.toUpperCase())) return true;
  return SIDE_EFFECTING_GET_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}
