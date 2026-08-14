import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';

export function googleCalendarConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function googleCalendarRedirectUri(origin: string) {
  return `${origin.replace(/\/$/, '')}/api/admin/wonka/google-calendar/callback`;
}

export async function getGoogleCalendarAccessToken(db: SupabaseClient) {
  const { data: config, error } = await db.from('integraciones_secretas')
    .select('google_calendar_access_token,google_calendar_refresh_token,google_calendar_token_expires_at,google_calendar_account')
    .eq('id', 'global')
    .maybeSingle();
  if (error) throw error;
  if (!config?.google_calendar_refresh_token && !config?.google_calendar_access_token) return null;

  const expiresAt = config.google_calendar_token_expires_at ? new Date(config.google_calendar_token_expires_at).getTime() : 0;
  if (config.google_calendar_access_token && expiresAt > Date.now() + 90_000) {
    return { accessToken: String(config.google_calendar_access_token), account: config.google_calendar_account || null };
  }

  if (!config.google_calendar_refresh_token || !process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) return null;
  const body = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    refresh_token: String(config.google_calendar_refresh_token),
    grant_type: 'refresh_token',
  });
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    cache: 'no-store',
  });
  const token = await response.json().catch(() => ({}));
  if (!response.ok || !token?.access_token) throw new Error(`google_token_refresh_failed:${response.status}`);
  const expires = new Date(Date.now() + Number(token.expires_in || 3600) * 1000).toISOString();
  await db.from('integraciones_secretas').update({
    google_calendar_access_token: String(token.access_token),
    google_calendar_token_expires_at: expires,
    updated_at: new Date().toISOString(),
  }).eq('id', 'global');
  return { accessToken: String(token.access_token), account: config.google_calendar_account || null };
}

export async function listCalendarEvents(db: SupabaseClient, input: { timeMin?: string; timeMax?: string; maxResults?: number } = {}) {
  const auth = await getGoogleCalendarAccessToken(db);
  if (!auth) throw new Error('google_calendar_not_connected');
  const url = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
  url.searchParams.set('singleEvents', 'true');
  url.searchParams.set('orderBy', 'startTime');
  url.searchParams.set('maxResults', String(Math.max(1, Math.min(30, Number(input.maxResults || 10)))));
  url.searchParams.set('timeMin', input.timeMin || new Date().toISOString());
  if (input.timeMax) url.searchParams.set('timeMax', input.timeMax);
  const response = await fetch(url, { headers: { Authorization: `Bearer ${auth.accessToken}` }, cache: 'no-store' });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`google_calendar_list_failed:${response.status}`);
  return (body.items || []).map((event: any) => ({
    id: event.id,
    summary: event.summary || '(Sin título)',
    start: event.start?.dateTime || event.start?.date || null,
    end: event.end?.dateTime || event.end?.date || null,
    status: event.status || null,
    htmlLink: event.htmlLink || null,
    attendees: Array.isArray(event.attendees) ? event.attendees.map((a: any) => ({ email: a.email, responseStatus: a.responseStatus })) : [],
  }));
}

export async function createCalendarEvent(db: SupabaseClient, input: {
  summary: string;
  start: string;
  end: string;
  description?: string;
  attendeeEmails?: string[];
  timeZone?: string;
}) {
  const auth = await getGoogleCalendarAccessToken(db);
  if (!auth) throw new Error('google_calendar_not_connected');
  const timeZone = input.timeZone || 'America/Santiago';
  const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all', {
    method: 'POST',
    headers: { Authorization: `Bearer ${auth.accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      summary: input.summary,
      description: input.description || undefined,
      start: { dateTime: input.start, timeZone },
      end: { dateTime: input.end, timeZone },
      attendees: (input.attendeeEmails || []).filter(Boolean).map((email) => ({ email })),
    }),
    cache: 'no-store',
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`google_calendar_create_failed:${response.status}`);
  return { id: body.id, summary: body.summary, start: body.start, end: body.end, htmlLink: body.htmlLink || null };
}
