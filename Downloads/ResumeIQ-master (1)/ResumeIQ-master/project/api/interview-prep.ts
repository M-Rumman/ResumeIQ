import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getUserFromRequest } from './_lib/auth.js';
import { generateInterviewPrepWithAi } from './_lib/openrouter.js';
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

  const access = await verifyAiFeatureAccess(user.id, FEATURE_TYPES.INTERVIEW_PREP);
  if (!access.allowed) {
    return respondError(res, access.status, access.message);
  }

  const body = req.body as {
    jobRole?: string;
    experienceLevel?: string;
    skills?: string;
  };

  const jobRole = (body.jobRole || '').trim().slice(0, INPUT_LIMITS.JOB_ROLE_MAX);
  if (!jobRole) {
    return res.status(400).json({ error: 'Job role is required.' });
  }

  const experienceLevel = (body.experienceLevel || 'mid').trim().slice(0, 64);
  const skills = (body.skills || '').trim().slice(0, INPUT_LIMITS.SKILLS_MAX);

  try {
    const result = await generateInterviewPrepWithAi(jobRole, experienceLevel, skills);
    await recordDailyUsage(user.id, FEATURE_TYPES.INTERVIEW_PREP);
    return res.status(200).json(result);
  } catch (err) {
    logApiError('interview-prep', err);
    return respondError(res, 502, CLIENT_ERRORS.INTERVIEW_PREP);
  }
}
