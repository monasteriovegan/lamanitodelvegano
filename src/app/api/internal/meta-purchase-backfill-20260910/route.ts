import { createHash, timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { syncPaidWebPurchaseToMeta } from '@/lib/meta/conversions-api';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const TOKEN_HASH = '7bde2895ede185c82e06107bbc165ea62cbd409e0d910a84796bd6ee97eb4564';
const ORDER_IDS = [26, 28, 32, 33, 37, 38];

function authorized(token: string) {
  const actual = Buffer.from(createHash('sha256').update(token).digest('hex'));
  const expected = Buffer.from(TOKEN_HASH);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token') || '';
  if (!authorized(token)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const db = createSupabaseServiceClient();
  const results = [];
  for (const orderId of ORDER_IDS) {
    const result = await syncPaidWebPurchaseToMeta(db, orderId, 'one_time_transfer_backfill_20260910');
    results.push({ orderId, ...result });
  }

  const sent = results.filter((result) => result.sent).length;
  const failed = results.length - sent;
  console.info('meta_purchase_transfer_backfill_complete', { sent, failed, orderIds: ORDER_IDS });
  return NextResponse.json({ ok: failed === 0, sent, failed, results });
}
