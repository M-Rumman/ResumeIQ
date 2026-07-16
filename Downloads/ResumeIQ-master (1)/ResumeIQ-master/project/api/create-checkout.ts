import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getUserFromRequest } from './_lib/auth.js';
import { createLemonCheckout, assertLemonCheckoutConfig } from './_lib/lemonSqueezy.js';
import { isPaymentsEnabled, PAYMENTS_DISABLED_MESSAGE } from './_lib/payments.js';
import { applyBillingRateLimit } from './_lib/billingRateLimit.js';
import { BODY_LIMITS, INPUT_LIMITS, rejectOversizedBody } from './_lib/requestLimits.js';
import { CLIENT_ERRORS, logApiError, respondError } from './_lib/safeError.js';

type CheckoutBody = {
  mode?: 'unlock' | 'subscription';
  reportId?: string;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (rejectOversizedBody(req, res, BODY_LIMITS.CHECKOUT)) {
    return;
  }

  const user = await getUserFromRequest(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!(await applyBillingRateLimit(user.id, res))) {
    return;
  }

  if (!isPaymentsEnabled()) {
    return res.status(403).json({ error: PAYMENTS_DISABLED_MESSAGE });
  }

  const body = (req.body || {}) as CheckoutBody;
  const mode = body.mode;

  if (mode !== 'unlock' && mode !== 'subscription') {
    return res.status(400).json({ error: 'Invalid checkout mode.' });
  }

  if (mode === 'unlock') {
    const reportId = (body.reportId || '').trim().slice(0, INPUT_LIMITS.REPORT_ID_MAX);
    if (!reportId) {
      return res.status(400).json({ error: 'Report ID is required for unlock checkout.' });
    }
  }

  try {
    const config = assertLemonCheckoutConfig();
    const variantId = mode === 'unlock' ? config.unlockVariantId : config.proVariantId;
    const checkoutUrl = await createLemonCheckout({
      variantId,
      storeId: config.storeId,
      userId: user.id,
      userEmail: user.email,
      checkoutType: mode === 'unlock' ? 'unlock' : 'pro',
      reportId: mode === 'unlock' ? body.reportId?.trim().slice(0, INPUT_LIMITS.REPORT_ID_MAX) : null,
    });

    return res.status(200).json({ checkoutUrl });
  } catch (err) {
    logApiError('create-checkout', err);
    return respondError(res, 502, CLIENT_ERRORS.CHECKOUT);
  }
}
