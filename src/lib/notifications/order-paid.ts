import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AdminOrder } from '@/lib/repositories/orders-repository';
import {
  buildOrderPaidPushPayload,
  buildTestPushPayload,
  isExpiredPushStatus,
  type BrowserPushSubscription,
} from './web-push';
import { sendAdminWebPush } from './web-push-sender';

type StoredSubscription = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

function asBrowserSubscription(row: StoredSubscription): BrowserPushSubscription {
  return {
    endpoint: row.endpoint,
    keys: { p256dh: row.p256dh, auth: row.auth },
  };
}

async function markSubscriptionResult(
  db: SupabaseClient,
  subscriptionId: string,
  result: { ok: boolean; status: number; error: string | null },
) {
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = result.ok
    ? { last_success_at: now, last_failure_reason: null, updated_at: now }
    : { last_failure_at: now, last_failure_reason: result.error || `http_${result.status}`, updated_at: now };
  if (!result.ok && isExpiredPushStatus(result.status)) patch.enabled = false;
  const { error } = await db.from('admin_push_subscriptions').update(patch).eq('id', subscriptionId);
  if (error) throw error;
}

async function reserveOrderPaidDelivery(
  db: SupabaseClient,
  orderId: number,
  subscription: StoredSubscription,
): Promise<string | null> {
  const { data, error } = await db.from('admin_notification_deliveries').insert({
    event_type: 'order_paid',
    order_id: orderId,
    user_id: subscription.user_id,
    subscription_id: subscription.id,
    status: 'pending',
    attempt_count: 1,
  }).select('id').maybeSingle();
  if (error) {
    // At-most-once: a repeated Mercado Pago webhook, regardless of the previous
    // Push outcome, must never submit the same order to this device again.
    if ((error as any).code === '23505') return null;
    throw error;
  }
  return data?.id ? String(data.id) : null;
}

async function finishDelivery(
  db: SupabaseClient,
  deliveryId: string,
  result: { ok: boolean; status: number; error: string | null },
) {
  const now = new Date().toISOString();
  const { error } = await db.from('admin_notification_deliveries').update({
    status: result.ok ? 'sent' : 'failed',
    sent_at: result.ok ? now : null,
    error: result.error,
    updated_at: now,
  }).eq('id', deliveryId);
  if (error) throw error;
}

export async function notifyOrderPaid(db: SupabaseClient, order: AdminOrder) {
  const { data: adminRows, error: adminError } = await db.from('admin_roles')
    .select('user_id')
    .eq('rol', 'admin');
  if (adminError) throw adminError;
  const adminIds = (adminRows || []).map((row: any) => String(row.user_id || '')).filter(Boolean);
  if (!adminIds.length) return { sent: 0, failed: 0, duplicate: 0 };

  const { data: subscriptions, error: subscriptionError } = await db.from('admin_push_subscriptions')
    .select('id,user_id,endpoint,p256dh,auth')
    .eq('enabled', true)
    .in('user_id', adminIds);
  if (subscriptionError) throw subscriptionError;

  const payload = buildOrderPaidPushPayload(order);
  let sent = 0;
  let failed = 0;
  let duplicate = 0;

  for (const raw of subscriptions || []) {
    const subscription = raw as StoredSubscription;
    let deliveryId: string | null = null;
    try {
      deliveryId = await reserveOrderPaidDelivery(db, order.numeric_id, subscription);
      if (!deliveryId) {
        duplicate += 1;
        continue;
      }
      const result = await sendAdminWebPush(asBrowserSubscription(subscription), payload);
      await finishDelivery(db, deliveryId, result);
      await markSubscriptionResult(db, subscription.id, result);
      if (result.ok) sent += 1;
      else failed += 1;
    } catch (error) {
      failed += 1;
      const reason = error instanceof Error ? error.message : 'unknown';
      console.error('admin_order_paid_push_failed', {
        orderId: order.numeric_id,
        subscriptionId: subscription.id,
        reason,
      });
      if (deliveryId) {
        try {
          await db.from('admin_notification_deliveries').update({
            status: 'failed',
            error: reason,
            updated_at: new Date().toISOString(),
          }).eq('id', deliveryId);
        } catch {
          // El error de auditoría tampoco debe impedir procesar otras suscripciones.
        }
      }
    }
  }

  return { sent, failed, duplicate };
}

export async function sendAdminTestPush(
  db: SupabaseClient,
  userId: string,
  endpoint: string,
) {
  const { data, error } = await db.from('admin_push_subscriptions')
    .select('id,user_id,endpoint,p256dh,auth')
    .eq('user_id', userId)
    .eq('endpoint', endpoint)
    .eq('enabled', true)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { ok: false, status: 404, error: 'subscription_not_found' };

  const subscription = data as StoredSubscription;
  const { data: delivery, error: deliveryError } = await db.from('admin_notification_deliveries').insert({
    event_type: 'test',
    order_id: null,
    user_id: userId,
    subscription_id: subscription.id,
    status: 'pending',
    attempt_count: 1,
  }).select('id').single();
  if (deliveryError) throw deliveryError;

  try {
    const result = await sendAdminWebPush(asBrowserSubscription(subscription), buildTestPushPayload());
    await finishDelivery(db, String(delivery.id), result);
    await markSubscriptionResult(db, subscription.id, result);
    return result;
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown';
    await db.from('admin_notification_deliveries').update({
      status: 'failed', error: reason, updated_at: new Date().toISOString(),
    }).eq('id', delivery.id);
    return { ok: false, status: 500, error: reason };
  }
}
