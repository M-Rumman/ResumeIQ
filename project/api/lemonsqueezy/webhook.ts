import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  buildEventKey,
  getCustomData,
  getCustomerId,
  getOrderStatus,
  getResourceId,
  getSubscriptionExpiresAt,
  readRawBody,
  verifyWebhookSignature,
  type LemonWebhookPayload,
} from '../_lib/lemonSqueezy.js';
import {
  deactivateProSubscription,
  findUserIdForOrderRefund,
  getAmountCents,
  getCurrency,
  grantReportUnlock,
  hasProcessedEvent,
  recordPurchaseEvent,
  resolveBillingUserId,
  revokeReportUnlock,
  syncSubscriptionFromPayload,
} from '../_lib/billing.js';

const SUBSCRIPTION_EVENTS = new Set([
  'subscription_created',
  'subscription_updated',
  'subscription_cancelled',
  'subscription_expired',
  'subscription_payment_success',
  'subscription_payment_failed',
  'subscription_payment_refunded',
]);

function webhookLog(
  eventName: string,
  message: string,
  extra: Record<string, unknown> = {},
) {
  console.info(
    '[lemonsqueezy/webhook]',
    JSON.stringify({ event_name: eventName, message, ...extra }),
  );
}

function webhookError(
  eventName: string,
  message: string,
  extra: Record<string, unknown> = {},
) {
  console.error(
    '[lemonsqueezy/webhook]',
    JSON.stringify({ event_name: eventName, message, level: 'error', ...extra }),
  );
}

async function handleOrderCreated(payload: LemonWebhookPayload, eventKey: string): Promise<void> {
  const eventName = 'order_created';
  const custom = getCustomData(payload);
  const userId = custom?.user_id ?? (await resolveBillingUserId(payload));

  if (!userId) {
    webhookError(eventName, 'missing user_id — cannot persist billing', {
      resource_id: getResourceId(payload),
      checkout_type: custom?.checkout_type ?? null,
    });
    throw new Error('order_created: missing user_id in custom data and no purchase history match.');
  }

  const orderStatus = getOrderStatus(payload);
  const isPaid = !orderStatus || orderStatus === 'paid';
  const checkoutType = custom?.checkout_type ?? 'pro';

  webhookLog(eventName, 'processing', {
    user_id: userId,
    checkout_type: checkoutType,
    order_id: getResourceId(payload),
    order_status: orderStatus,
  });

  if (checkoutType === 'unlock' && isPaid) {
    const reportId = custom?.report_id;
    if (!reportId) {
      throw new Error('Unlock order missing report_id in custom data.');
    }
    await grantReportUnlock(userId, reportId);
  }

  await recordPurchaseEvent({
    eventKey,
    eventName,
    userId,
    purchaseType: checkoutType === 'unlock' ? 'unlock' : 'subscription',
    lemonOrderId: getResourceId(payload),
    reportId: custom?.report_id ?? null,
    amountCents: getAmountCents(payload),
    currency: getCurrency(payload),
    payload,
  });
}

async function handleOrderRefunded(payload: LemonWebhookPayload, eventKey: string): Promise<void> {
  const eventName = 'order_refunded';
  const custom = getCustomData(payload);
  let userId = custom?.user_id ?? (await resolveBillingUserId(payload));
  let reportId = custom?.report_id ?? null;

  if (!userId || !reportId) {
    const lookup = await findUserIdForOrderRefund(payload);
    if (!lookup) {
      webhookError(eventName, 'could not resolve user/report for refund');
      throw new Error('order_refunded: could not resolve user_id and report_id.');
    }
    userId = lookup.userId;
    reportId = lookup.reportId;
  }

  if (reportId) {
    await revokeReportUnlock(userId, reportId);
  }

  await recordPurchaseEvent({
    eventKey,
    eventName,
    userId,
    purchaseType: 'unlock',
    lemonOrderId: getResourceId(payload),
    reportId,
    amountCents: getAmountCents(payload),
    currency: getCurrency(payload),
    payload,
  });
}

async function handleSubscriptionEvent(
  payload: LemonWebhookPayload,
  eventKey: string,
  eventName: string,
): Promise<void> {
  const userId = await resolveBillingUserId(payload);
  const subscriptionId = getResourceId(payload);
  const customerId = getCustomerId(payload);

  if (!userId) {
    webhookError(eventName, 'missing user_id — cannot persist subscription billing', {
      subscription_id: subscriptionId,
      customer_id: customerId,
    });
    throw new Error(`${eventName}: could not resolve user_id for subscription event.`);
  }

  webhookLog(eventName, 'processing', {
    user_id: userId,
    subscription_id: subscriptionId,
    customer_id: customerId,
    checkout_type: 'pro',
  });

  if (eventName === 'subscription_expired' || eventName === 'subscription_payment_failed') {
    await deactivateProSubscription(userId, getSubscriptionExpiresAt(payload));
  } else if (eventName === 'subscription_payment_refunded') {
    await deactivateProSubscription(userId, getSubscriptionExpiresAt(payload));
  } else {
    await syncSubscriptionFromPayload(userId, payload);
  }

  await recordPurchaseEvent({
    eventKey,
    eventName,
    userId,
    purchaseType: 'subscription',
    lemonSubscriptionId: subscriptionId,
    lemonOrderId: null,
    amountCents: getAmountCents(payload),
    currency: getCurrency(payload),
    payload,
  });
}

async function processWebhook(payload: LemonWebhookPayload): Promise<void> {
  const eventName = payload.meta?.event_name;
  if (!eventName) {
    throw new Error('Webhook missing meta.event_name');
  }

  const eventKey = buildEventKey(payload);
  if (await hasProcessedEvent(eventKey)) {
    webhookLog(eventName, 'duplicate_event_skipped', { event_key: eventKey });
    return;
  }

  switch (eventName) {
    case 'order_created':
      await handleOrderCreated(payload, eventKey);
      return;
    case 'order_refunded':
      await handleOrderRefunded(payload, eventKey);
      return;
    default:
      if (SUBSCRIPTION_EVENTS.has(eventName)) {
        await handleSubscriptionEvent(payload, eventKey, eventName);
        return;
      }
      webhookLog(eventName, 'ignored_event');
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let rawBody: Buffer;
  try {
    rawBody = await readRawBody(req);
  } catch (err) {
    console.error('[lemonsqueezy/webhook] failed to read body', err);
    return res.status(400).json({ error: 'Invalid request body' });
  }

  const signatureHeader = req.headers['x-signature'];
  const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;

  if (!verifyWebhookSignature(rawBody, signature)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  let payload: LemonWebhookPayload;
  try {
    payload = JSON.parse(rawBody.toString('utf8')) as LemonWebhookPayload;
  } catch {
    return res.status(400).json({ error: 'Invalid JSON payload' });
  }

  const eventName = payload.meta?.event_name ?? 'unknown';

  try {
    await processWebhook(payload);
    webhookLog(eventName, 'completed', { http_status: 200 });
    return res.status(200).json({ received: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Webhook processing failed';
    webhookError(eventName, message, {
      user_id:
        typeof payload.meta?.custom_data?.user_id === 'string'
          ? payload.meta.custom_data.user_id
          : null,
      subscription_id: getResourceId(payload),
      customer_id: getCustomerId(payload),
    });
    return res.status(500).json({ error: 'Webhook processing failed.' });
  }
}
