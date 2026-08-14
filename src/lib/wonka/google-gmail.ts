import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getGoogleCalendarAccessToken } from './google-calendar';

const GMAIL_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';

function decodeBase64Url(value: string) {
  try {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    return Buffer.from(normalized, 'base64').toString('utf8');
  } catch { return ''; }
}

function header(headers: any[], name: string) {
  return String((headers || []).find((h: any) => String(h?.name || '').toLowerCase() === name.toLowerCase())?.value || '');
}

function extractBody(payload: any): string {
  if (!payload) return '';
  if (payload.mimeType === 'text/plain' && payload.body?.data) return decodeBase64Url(String(payload.body.data));
  const parts = Array.isArray(payload.parts) ? payload.parts : [];
  for (const part of parts) {
    const text = extractBody(part);
    if (text) return text;
  }
  if (payload.body?.data) return decodeBase64Url(String(payload.body.data));
  return '';
}

async function gmailFetch(db: SupabaseClient, path: string, init: RequestInit = {}) {
  const auth = await getGoogleCalendarAccessToken(db);
  if (!auth) throw new Error('google_workspace_not_connected');
  const response = await fetch(`${GMAIL_BASE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${auth.accessToken}`, ...(init.headers || {}) },
    cache: 'no-store',
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`gmail_api_failed:${response.status}`);
  return body;
}

export async function searchEmails(db: SupabaseClient, input: { query?: string; limit?: number } = {}) {
  const limit = Math.max(1, Math.min(20, Number(input.limit || 10)));
  const params = new URLSearchParams({ maxResults: String(limit) });
  if (input.query) params.set('q', String(input.query));
  const list = await gmailFetch(db, `/messages?${params.toString()}`);
  const refs = Array.isArray(list.messages) ? list.messages.slice(0, limit) : [];
  const rows = await Promise.all(refs.map(async (ref: any) => {
    const msg = await gmailFetch(db, `/messages/${encodeURIComponent(String(ref.id))}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`);
    const headers = msg.payload?.headers || [];
    return {
      id: msg.id,
      thread_id: msg.threadId,
      from: header(headers, 'From'),
      to: header(headers, 'To'),
      subject: header(headers, 'Subject') || '(Sin asunto)',
      date: header(headers, 'Date'),
      snippet: String(msg.snippet || '').slice(0, 500),
      label_ids: Array.isArray(msg.labelIds) ? msg.labelIds : [],
    };
  }));
  return rows;
}

export async function readEmail(db: SupabaseClient, messageId: string) {
  if (!messageId) throw new Error('message_id_required');
  const msg = await gmailFetch(db, `/messages/${encodeURIComponent(messageId)}?format=full`);
  const headers = msg.payload?.headers || [];
  return {
    id: msg.id,
    thread_id: msg.threadId,
    from: header(headers, 'From'),
    to: header(headers, 'To'),
    cc: header(headers, 'Cc'),
    subject: header(headers, 'Subject') || '(Sin asunto)',
    date: header(headers, 'Date'),
    body: extractBody(msg.payload).slice(0, 12000),
    snippet: String(msg.snippet || '').slice(0, 500),
  };
}

function encodedSubject(subject: string) {
  return `=?UTF-8?B?${Buffer.from(subject, 'utf8').toString('base64')}?=`;
}

export async function sendEmail(db: SupabaseClient, input: { to: string[]; subject: string; body: string; cc?: string[]; replyToMessageId?: string }) {
  const to = (input.to || []).map(String).map((v) => v.trim()).filter(Boolean);
  if (!to.length) throw new Error('email_recipient_required');
  if (!String(input.subject || '').trim()) throw new Error('email_subject_required');
  const lines = [
    `To: ${to.join(', ')}`,
    ...(input.cc?.length ? [`Cc: ${input.cc.join(', ')}`] : []),
    `Subject: ${encodedSubject(String(input.subject))}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    String(input.body || ''),
  ];
  const raw = Buffer.from(lines.join('\r\n'), 'utf8').toString('base64url');
  const payload: Record<string, unknown> = { raw };
  if (input.replyToMessageId) {
    const original = await gmailFetch(db, `/messages/${encodeURIComponent(input.replyToMessageId)}?format=metadata`);
    if (original?.threadId) payload.threadId = original.threadId;
  }
  const auth = await getGoogleCalendarAccessToken(db);
  if (!auth) throw new Error('google_workspace_not_connected');
  const response = await fetch(`${GMAIL_BASE}/messages/send`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${auth.accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    cache: 'no-store',
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`gmail_send_failed:${response.status}`);
  return { id: body.id, thread_id: body.threadId, to, subject: input.subject };
}
