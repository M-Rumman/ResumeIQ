import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getUserFromRequest } from './_lib/auth.js';
import { getReconciledProfileBilling, profileHasProAccess } from './_lib/billing.js';
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js';
import { BODY_LIMITS, INPUT_LIMITS, rejectOversizedBody } from './_lib/requestLimits.js';

/**
 * Server-side authorization boundary for client-side PDF rendering. The PDF
 * renderer receives data only after this endpoint confirms the caller owns the
 * report and has Pro or that report's one-time unlock.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (rejectOversizedBody(req, res, BODY_LIMITS.DEFAULT)) return;

  const user = await getUserFromRequest(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const reportId = typeof req.body?.reportId === 'string'
    ? req.body.reportId.trim().slice(0, INPUT_LIMITS.REPORT_ID_MAX)
    : '';
  const match = /^resume_analysis:([0-9a-f-]{36})$/i.exec(reportId);
  if (!match) return res.status(400).json({ error: 'A valid resume report is required.' });

  const admin = getSupabaseAdmin();
  const { data: report, error: reportError } = await admin
    .from('resume_analysis')
    .select('id')
    .eq('id', match[1])
    .eq('user_id', user.id)
    .maybeSingle();
  if (reportError || !report) return res.status(404).json({ error: 'Resume report not found.' });

  const billing = await getReconciledProfileBilling(user.id);
  const unlockedReports = Array.isArray(billing.unlocked_reports)
    ? billing.unlocked_reports.filter((item): item is string => typeof item === 'string')
    : [];
  if (!profileHasProAccess(billing) && !unlockedReports.includes(reportId)) {
    return res.status(403).json({ error: 'PDF export requires Pro or an unlock for this report.' });
  }

  return res.status(200).json({ allowed: true });
}
