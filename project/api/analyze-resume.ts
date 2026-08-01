import type { VercelRequest, VercelResponse } from '@vercel/node';
import { randomUUID } from 'node:crypto';
import { getUserFromRequest } from './_lib/auth.js';
import { AiPipelineError } from './_lib/openrouter.js';
import { runAnalysisPipeline } from './_lib/analysis-engine/pipeline.js';
import {
  createAiObservabilityContext,
  logAiEvent,
  textMetadata,
} from './_lib/aiObservability.js';
import {
  FEATURE_TYPES,
  commitSuccessfulDailyUsage,
  recordDailyUsage,
} from './_lib/dailyUsage.js';
import { enforceAiRateLimit } from './_lib/rateLimit.js';
import { verifyAiFeatureAccess } from './_lib/featureAccess.js';
import { getReconciledProfileBilling } from './_lib/billing.js';
import { BODY_LIMITS, INPUT_LIMITS, rejectOversizedBody } from './_lib/requestLimits.js';
import { CLIENT_ERRORS, respondError } from './_lib/safeError.js';
import {
  deleteResumeAnalysisRecord,
  insertResumeAnalysisRecord,
  persistAiResultAndCommitUsage,
} from './_lib/aiPersistence.js';

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

  const body = req.body as { resumeText?: string; jobRole?: string; jobDescription?: string; reportId?: string };
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

  const access = await verifyAiFeatureAccess(user.id, FEATURE_TYPES.RESUME_ANALYSIS);
  if ('status' in access) {
    return respondError(res, access.status, access.message);
  }

  const requestedReportId = typeof body.reportId === 'string' ? body.reportId.trim() : '';
  const billing = await getReconciledProfileBilling(user.id);
  const unlockedReports = Array.isArray(billing.unlocked_reports)
    ? billing.unlocked_reports.filter((reportId): reportId is string => typeof reportId === 'string')
    : [];
  const hasReportUnlock = requestedReportId.length > 0 && unlockedReports.includes(requestedReportId);
  // Free users should receive the complete report for their successful daily allowance.
  const includePremium = true;

  try {
    const engineResult = await runAnalysisPipeline(
      {
        resumeText,
        jobDescriptionText: jobDescription,
        includePremium
      },
      { observability }
    );
    const result = engineResult.legacyReport;

    const strengths = engineResult.tier === 'premium'
      ? result.atsScoreExplanation.strengths.join('\n')
      : result.basicFeedback.join('\n');
    const improvements = engineResult.tier === 'premium'
      ? [...result.improvementSuggestions, ...result.optimizationRecommendations]
        .map((item: string) => `- ${item}`)
        .join('\n')
      : result.basicFeedback.map((item: string) => `- ${item}`).join('\n');

    let reportId: string | null = null;
    try {
      const persisted = await persistAiResultAndCommitUsage({
        userId: user.id,
        featureType: FEATURE_TYPES.RESUME_ANALYSIS,
        shouldConsumeUsage: !access.hasPro,
        insertRecord: () => insertResumeAnalysisRecord(user.id, {
          atsScore: result.atsScore,
          strengths: strengths || 'AI analysis completed.',
          improvements: improvements || '- See full report in app.',
        }),
        deleteRecord: deleteResumeAnalysisRecord,
        commitUsage: () => commitSuccessfulDailyUsage(user.id, FEATURE_TYPES.RESUME_ANALYSIS),
        buildReportId: (recordId) => `resume_analysis:${recordId}`,
      });
      reportId = persisted.reportId;
    } catch (error) {
      if (error instanceof Error && /limit reached/i.test(error.message)) {
        return respondError(res, 429, "You've reached today's free resume analysis limit. Your limit resets tomorrow or you can upgrade to Pro for unlimited analyses.");
      }
      throw error;
    }

    if (!access.hasPro) {
      await recordDailyUsage(user.id, FEATURE_TYPES.RESUME_ANALYSIS);
    }
    logAiEvent(observability, 'request_completed', {
      status: 200,
      totalDurationMs: Date.now() - observability.startedAt,
    });
    return res.status(200).json({
      ...result,
      reportId,
    });
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
