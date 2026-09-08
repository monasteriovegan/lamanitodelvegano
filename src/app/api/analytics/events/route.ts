import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { BusinessRepository } from '@/lib/repositories/business-repository';

const ALLOWED_EVENTS = new Set(['PageView', 'ViewContent', 'AddToCart', 'InitiateCheckout', 'Contact']);
const MAX_BODY_BYTES = 16_384;

function sameOrigin(request: NextRequest) {
  const expectedOrigin = request.nextUrl.origin;
  const origin = request.headers.get('origin');
  if (origin) {
    try {
      return new URL(origin).origin === expectedOrigin;
    } catch {
      return false;
    }
  }

  const referer = request.headers.get('referer');
  if (!referer) return false;
  try {
    return new URL(referer).origin === expectedOrigin;
  } catch {
    return false;
  }
}

function cleanString(value: unknown, max: number) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

function safeParams(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const raw = value as Record<string, unknown>;
  const allowed = [
    'content_ids',
    'content_name',
    'content_type',
    'contents',
    'currency',
    'num_items',
    'value',
    'contact_method',
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_content',
    'utm_term',
    'page_location',
    'page_title',
  ];
  return Object.fromEntries(allowed.filter((key) => raw[key] !== undefined).map((key) => [key, raw[key]]));
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ ok: false, error: 'invalid_origin' }, { status: 403 });
  }

  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ ok: false, error: 'payload_too_large' }, { status: 413 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const eventName = cleanString(body.event_name, 64);
  if (!eventName || !ALLOWED_EVENTS.has(eventName)) {
    return NextResponse.json({ ok: false, error: 'invalid_event' }, { status: 400 });
  }

  const db = createSupabaseServiceClient();
  const business = await new BusinessRepository(db).requireDefault();
  const { error } = await db.from('analytics_events').insert({
    business_unit_id: business.id,
    customer_id: null,
    event_name: eventName,
    event_params: safeParams(body.event_params),
    page_path: cleanString(body.page_path, 500),
    session_id: cleanString(body.session_id, 120),
  });

  if (error) {
    console.error('first_party_analytics_insert_failed', { code: error.code || 'unknown' });
    return NextResponse.json({ ok: false, error: 'persist_failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 202 });
}
