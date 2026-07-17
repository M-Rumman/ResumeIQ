import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getUserFromRequest } from '../_lib/auth.js';
import { syncBillingFromStoredEvents, profileHasProAccess } from '../_lib/billing.js';
import { applyBillingRateLimit } from '../_lib/billingRateLimit.js';
import { rejectOversizedBody, BODY_LIMITS } from '../_lib/requestLimits.js';
import { CLIENT_ERRORS, logApiError, respondError } from '../_lib/safeError.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (rejectOversizedBody(req, res, BODY_LIMITS.DEFAULT)) {
    return;
  }

  const user = await getUserFromRequest(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!(await applyBillingRateLimit(user.id, res))) {
    return;
  }

  try {
    const billing = await syncBillingFromStoredEvents(user.id);
    return res.status(200).json({
      plan: billing.plan,
      subscription_status: billing.subscription_status,
      is_pro: profileHasProAccess(billing),
      subscription_expires_at: billing.subscription_expires_at,
      unlocked_reports: Array.isArray(billing.unlocked_reports)
        ? billing.unlocked_reports
        : [],
      synced: true,
    });
  } catch (err) {
    logApiError('billing/sync', err, { user_id: user.id });
    return respondError(res, 500, CLIENT_ERRORS.BILLING_SYNC);
  }
}
