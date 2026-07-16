import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getUserFromRequest } from './_lib/auth.js';
import { analyzeResumeWithAi } from './_lib/openrouter.js';
import {
  FEATURE_TYPES,
  recordDailyUsage,
} from './_lib/dailyUsage.js';
import { enforceAiRateLimit } from './_lib/rateLimit.js';
import { verifyAiFeatureAccess } from './_lib/featureAccess.js';
import { BODY_LIMITS, INPUT_LIMITS, rejectOversizedBody } from './_lib/requestLimits.js';
import { CLIENT_ERRORS, logApiError, respondError } from './_lib/safeError.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (rejectOversizedBody(req, res, BODY_LIMITS.AI)) {
    return;
  }

  const user = await getUserFromRequest(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const rate = await enforceAiRateLimit(user.id);
  if (!rate.allowed) {
    res.setHeader('Retry-After', String(rate.retryAfter));
    return res.status(429).json({
      error: 'Too many requests. Please wait a moment and try again.',
    });
  }

  const access = await verifyAiFeatureAccess(user.id, FEATURE_TYPES.RESUME_ANALYSIS);
  if (!access.allowed) {
    return respondError(res, access.status, access.message);
  }

  const body = req.body as { resumeText?: string; jobRole?: string; jobDescription?: string };
  const resumeText = (body.resumeText || '').trim().slice(0, INPUT_LIMITS.RESUME_TEXT_MAX);
  const jobDescription = (body.jobDescription || body.jobRole || '')
    .trim()
    .slice(0, INPUT_LIMITS.JOB_DESCRIPTION_MAX);

  if (!resumeText || resumeText.length < 50) {
    return res.status(400).json({ error: 'Resume text is too short for analysis.' });
  }

  if (!jobDescription) {
    return res.status(400).json({ error: 'Target job description is required.' });
  }

  try {
    const result = await analyzeResumeWithAi(resumeText, jobDescription);
    await recordDailyUsage(user.id, FEATURE_TYPES.RESUME_ANALYSIS);
    return res.status(200).json(result);
  } catch (err) {
    logApiError('analyze-resume', err);
    return respondError(res, 502, CLIENT_ERRORS.AI_ANALYSIS);
  }
}
