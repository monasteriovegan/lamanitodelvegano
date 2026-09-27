export type ExternalSideEffect =
  | 'payment'
  | 'meta_capi'
  | 'email'
  | 'whatsapp_outbound'
  | 'instagram_outbound';

export function externalSideEffectsBlocked(env: NodeJS.ProcessEnv = process.env) {
  return env.VERCEL_ENV === 'preview'
    || env.LMV_PREVIEW_SAFE_MODE === 'true'
    || env.LMV_CUTOVER_FREEZE === 'true';
}

export function assertExternalSideEffectsAllowed(
  effect: ExternalSideEffect,
  env: NodeJS.ProcessEnv = process.env,
) {
  if (externalSideEffectsBlocked(env)) {
    throw new Error(`preview_safe_mode:${effect}`);
  }
}
