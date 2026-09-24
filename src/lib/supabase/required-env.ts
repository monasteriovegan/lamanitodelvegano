type SupabaseServiceEnvironment = {
  readonly [key: string]: string | undefined;
};

export function requireSupabaseServiceConfig(environment: SupabaseServiceEnvironment) {
  const url = environment.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = environment.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !serviceKey) {
    throw new Error('Supabase server configuration is incomplete.');
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.hostname !== '127.0.0.1' && parsed.hostname !== 'localhost') {
      throw new Error('unsupported protocol');
    }
  } catch {
    throw new Error('Supabase server URL is invalid.');
  }

  return { url, serviceKey };
}
