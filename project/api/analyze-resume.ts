import type { VercelRequest, VercelResponse } from '@vercel/node';
import { randomUUID } from 'node:crypto';
import { getUserFromRequest } from './_lib/auth.js';
import { AiPipelineError, analyzeResumeWithAi } from './_lib/openrouter.js';
import {
  createAiObservabilityContext,
  logAiEvent,
  textMetadata,
} from './_lib/aiObservability.js';
import {
  FEATURE_TYPES,
  recordDailyUsage,
} from './_lib/dailyUsage.js';
import { enforceAiRateLimit } from './_lib/rateLimit.js';
import { verifyAiFeatureAccess } from './_lib/featureAccess.js';
import { BODY_LIMITS, INPUT_LIMITS, rejectOversizedBody } from './_lib/requestLimits.js';
import { CLIENT_ERRORS, respondError } from './_lib/safeError.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const requestId = randomUUID();
  const observability = createAiObservabilityContext(requestId);
  res.setHeader('X-Request-ID', requestId);

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
  if ('status' in access) {
    return respondError(res, access.status, access.message);
  }

  const body = req.body as { resumeText?: string; jobRole?: string; jobDescription?: string };
  const resumeText = (body.resumeText || '').trim().slice(0, INPUT_LIMITS.RESUME_TEXT_MAX);
  const jobDescription = (body.jobDescription || body.jobRole || '')
    .trim()
    .slice(0, INPUT_LIMITS.JOB_DESCRIPTION_MAX);

  logAiEvent(observability, 'resume_received', {
    // The frontend sends extracted/pasted text only; original PDF/DOCX type and
    // client-side extraction duration are intentionally unavailable to this route.
    inputTransport: 'text',
    originalFileType: 'unavailable',
    clientExtractionDurationMs: null,
    resume: textMetadata(resumeText),
    jobDescription: textMetadata(jobDescription),
  });

  if (!resumeText || resumeText.length < 50) {
    return res.status(400).json({ error: 'Resume text is too short for analysis.' });
  }

  if (!jobDescription) {
    return res.status(400).json({ error: 'Target job description is required.' });
  }

  try {
    const result = await analyzeResumeWithAi(resumeText, jobDescription, { observability });
    await recordDailyUsage(user.id, FEATURE_TYPES.RESUME_ANALYSIS);
    logAiEvent(observability, 'request_completed', {
      status: 200,
      totalDurationMs: Date.now() - observability.startedAt,
    });
    return res.status(200).json(result);
  } catch (err) {
    if (err instanceof AiPipelineError) {
      logAiEvent(observability, 'request_failed', {
        status: 502,
        stage: err.stage,
        code: err.code,
        totalDurationMs: Date.now() - observability.startedAt,
      });
      return res.status(502).json({
        error: 'Resume analysis could not be completed.',
        pipelineError: { stage: err.stage, code: err.code },
      });
    }
    console.error('[analyze-resume] unexpected failure', {
      requestId,
      errorType: err instanceof Error ? err.name : 'unknown',
    });
    logAiEvent(observability, 'request_failed', {
      status: 502,
      stage: 'openrouter_or_transport',
      code: 'REQUEST_FAILED',
      totalDurationMs: Date.now() - observability.startedAt,
    });
    return respondError(res, 502, CLIENT_ERRORS.AI_ANALYSIS);
  }
}
