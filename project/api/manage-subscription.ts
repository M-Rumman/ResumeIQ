import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getUserFromRequest } from './_lib/auth.js';
import { getProfileBilling, profileHasProAccess } from './_lib/billing.js';
import { getCustomerPortalUrl } from './_lib/lemonSqueezy.js';
import { isPaymentsEnabled, PAYMENTS_DISABLED_MESSAGE } from './_lib/payments.js';
import { applyBillingRateLimit } from './_lib/billingRateLimit.js';
import { rejectOversizedBody, BODY_LIMITS } from './_lib/requestLimits.js';
import { CLIENT_ERRORS, logApiError, respondError } from './_lib/safeError.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (rejectOversizedBody(req, res, BODY_LIMITS.DEFAULT)) {
    return;
  }

  const user = await getUserFromRequest(req);
  if (!user) {
    return res.status(401).json({ error: 'You must be logged in to manage your subscription.' });
  }

  if (!(await applyBillingRateLimit(user.id, res))) {
    return;
  }

  if (!isPaymentsEnabled()) {
    return res.status(403).json({ error: PAYMENTS_DISABLED_MESSAGE });
  }

  try {
    const billing = await getProfileBilling(user.id);

    if (!profileHasProAccess(billing)) {
      return res.status(404).json({
        error: 'No active Pro subscription was found on your account.',
      });
    }

    const subscriptionId = billing.lemonsqueezy_subscription_id;
    const customerId = billing.lemonsqueezy_customer_id;

    if (!subscriptionId && !customerId) {
      return res.status(400).json({
        error:
          'Your subscription billing details are not linked yet. Try refreshing your dashboard or contact support.',
      });
    }

    const status = billing.subscription_status.toLowerCase();
    if (
      status === 'expired' ||
      status === 'inactive' ||
      (status === 'cancelled' &&
        billing.subscription_expires_at &&
        new Date(billing.subscription_expires_at).getTime() <= Date.now())
    ) {
      return res.status(403).json({
        error: 'Your Pro subscription has expired. Upgrade again to manage billing.',
      });
    }

    const url = await getCustomerPortalUrl({
      subscriptionId,
      customerId,
      userEmail: user.email,
    });

    let portalHost = 'unknown';
    let portalPath = 'unknown';
    try {
      const parsed = new URL(url);
      portalHost = parsed.hostname;
      portalPath = parsed.pathname;
    } catch {
      // omit URL from logs
    }

    console.info(
      '[manage-subscription]',
      JSON.stringify({
        user_id: user.id,
        subscription_id: subscriptionId,
        customer_id: customerId,
        portal_host: portalHost,
        portal_path: portalPath,
      }),
    );

    return res.status(200).json({ url });
  } catch (err) {
    const message = err instanceof Error ? err.message : CLIENT_ERRORS.MANAGE_SUBSCRIPTION;
    logApiError('manage-subscription', err, { user_id: user.id });

    if (message.includes('Billing details do not match')) {
      return respondError(res, 403, message);
    }

    return respondError(res, 502, CLIENT_ERRORS.MANAGE_SUBSCRIPTION);
  }
}
