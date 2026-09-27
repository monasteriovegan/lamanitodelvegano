type MetaReconnectEnvironment = {
  [key: string]: string | undefined;
  LMV_PREVIEW_SAFE_MODE?: string;
  META_RECONNECT_MODE?: string;
};

export function metaReconnectReadOnly(environment: MetaReconnectEnvironment) {
  if (environment.LMV_PREVIEW_SAFE_MODE === '1') return true;
  return environment.META_RECONNECT_MODE !== 'live';
}

export function metaReconnectFailureCode(stage: 'decrypt' | 'health' | 'subscribe') {
  return stage === 'subscribe' ? 'webhook_subscription_failed' : 'reauthorization_required';
}
