import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getUserFromRequest } from './_lib/auth.js';
import { generateInterviewPrepWithAi } from './_lib/openrouter.js';
import {
  FEATURE_TYPES,
  commitSuccessfulDailyUsage,
  recordDailyUsage,
} from './_lib/dailyUsage.js';
import { enforceAiRateLimit } from './_lib/rateLimit.js';
import { verifyAiFeatureAccess } from './_lib/featureAccess.js';
import { BODY_LIMITS, INPUT_LIMITS, rejectOversizedBody } from './_lib/requestLimits.js';
import { CLIENT_ERRORS, logApiError, respondError } from './_lib/safeError.js';
import {
  deleteInterviewPrepRecord,
  insertInterviewPrepRecord,
  persistAiResultAndCommitUsage,
} from './_lib/aiPersistence.js';

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

  const body = req.body as {
    action?: string;
    jobRole?: string;
    experienceLevel?: string;
    skills?: string;
    interviewerName?: string;
    voiceId?: string;
    avatarId?: string;
  };

  if (body.action === 'start_session') {
    return res.status(200).json({
      status: 'started',
      sessionStartedAt: new Date().toISOString(),
      interviewerName: body.interviewerName || 'Alex Rivera',
      voiceId: body.voiceId || 'male-1',
      avatarId: body.avatarId || 'alex',
    });
  }

  if (body.action === 'evaluate_answer') {
    const candidateAnswer = String((body as any).candidateAnswer || '').trim();
    const question = String((body as any).question || '').trim();
    const persona = (body as any).interviewerPersona || { name: 'Interviewer', id: 'alex' };
    const personaName = persona.name || 'Interviewer';
    const words = candidateAnswer.split(/\s+/).filter(Boolean);
    const wordCount = words.length;

    if (wordCount < 5) {
      return res.status(200).json({
        overallScore: 35,
        rating: 'Needs Improvement',
        summaryFeedback: 'Response was too concise to assess candidate proficiency. Elaboration recommended.',
        spokenFeedback: `That was a bit short. In a real interview, walk through your situation, your specific actions, and the measurable outcome.`,
        strengths: ['Addressed the topic directly.'],
        improvements: ['Elaborate using the STAR framework.', 'Cite concrete metrics and technologies.'],
        starBreakdown: {
          situation: { present: false, feedback: 'Missing background context.' },
          task: { present: false, feedback: 'Missing task definition.' },
          action: { present: false, feedback: 'Missing concrete steps taken.' },
          result: { present: false, feedback: 'Missing quantifiable result.' },
        },
        detectedKeyTerms: [],
      });
    }

    const lower = candidateAnswer.toLowerCase();
    const hasSituation = /\b(when|in my (previous|last|recent)|at (my|our)|during|project|team was|we were)\b/i.test(lower);
    const hasTask = /\b(task|goal|objective|needed to|had to|responsible for|target|requirement)\b/i.test(lower);
    const hasAction = /\b(i (built|designed|implemented|refactored|led|analyzed|decided|debugged|migrated|optimized)|my approach)\b/i.test(lower);
    const hasResult = /\b(result|outcome|achieved|reduced|improved|increased|saved|delivered|impact|%|percent|ms)\b/i.test(lower);
    const starCount = [hasSituation, hasTask, hasAction, hasResult].filter(Boolean).length;

    let base = 62 + starCount * 5;
    if (wordCount >= 60 && wordCount <= 280) base += 10;
    else if (wordCount < 40) base -= 8;
    if (/\b(\d+%|\d+\s*(x|ms|seconds|minutes|users|gb)|metric|latency|throughput)\b/i.test(lower)) base += 6;
    if (/\b(trade-off|architecture|scalab|database|query|cache|microservice|pipeline|monitoring|rollback)\b/i.test(lower)) base += 5;

    const score = Math.min(96, Math.max(45, Math.round(base)));
    let rating = 'Hire';
    if (score >= 88) rating = 'Strong Hire';
    else if (score >= 75) rating = 'Hire';
    else if (score >= 62) rating = 'Borderline';
    else rating = 'Needs Improvement';

    const strengths: string[] = [];
    if (hasAction) strengths.push('Direct technical ownership: clearly highlighted what you personally executed.');
    if (hasResult) strengths.push('Impact-oriented: connected technical actions to business and operational outcomes.');
    if (strengths.length === 0) strengths.push('Communicated core idea directly and concisely.');

    const improvements: string[] = [];
    if (!hasResult) improvements.push('Always quantify the outcome with measurable KPIs or latency deltas.');
    if (!hasAction) improvements.push('Focus more on your specific contributions rather than generic team actions.');
    if (wordCount < 50) improvements.push('Provide additional technical depth regarding trade-offs and alternative approaches.');
    if (improvements.length === 0) improvements.push('Conclude with brief reflection on architectural lessons learned.');

    const spoken = score >= 80
      ? `Great answer. I appreciate how methodically you structured your experience and highlighted the real impact.`
      : `Good starting points. Next time, make sure to detail the architectural trade-offs and conclude with a measurable result.`;

    return res.status(200).json({
      overallScore: score,
      rating,
      summaryFeedback: `Score: ${score}/100 (${rating}). Evaluated by ${personaName}.`,
      spokenFeedback: spoken,
      strengths: strengths.slice(0, 3),
      improvements: improvements.slice(0, 3),
      starBreakdown: {
        situation: { present: hasSituation, feedback: hasSituation ? 'Good context provided.' : 'Add project background.' },
        task: { present: hasTask, feedback: hasTask ? 'Goal was defined.' : 'Clarify the objective.' },
        action: { present: hasAction, feedback: hasAction ? 'Actions were highlighted.' : 'Detail your specific contributions.' },
        result: { present: hasResult, feedback: hasResult ? 'Outcomes were noted.' : 'Quantify the final result.' },
      },
      detectedKeyTerms: [],
    });
  }

  const jobRole = (body.jobRole || '').trim().slice(0, INPUT_LIMITS.JOB_ROLE_MAX);
  if (!jobRole) {
    return res.status(400).json({ error: 'Job role is required.' });
  }

  const experienceLevel = (body.experienceLevel || 'mid').trim().slice(0, 64);
  const skills = (body.skills || '').trim().slice(0, INPUT_LIMITS.SKILLS_MAX);

  const access = await verifyAiFeatureAccess(user.id, FEATURE_TYPES.INTERVIEW_PREP);
  if ('status' in access) {
    return respondError(res, access.status, access.message);
  }

  try {
    const result = await generateInterviewPrepWithAi(jobRole, experienceLevel, skills);
    if (!isValidInterviewPrepResult(result)) {
      throw new Error('Interview preparation result is structurally invalid or incomplete.');
    }
    let reportId: string | null = null;
    try {
      if (req.destroyed) {
        console.warn('[interview-prep] Client connection was destroyed before database persistence. Skipping daily usage commit.');
        return res.status(499).end();
      }

      const persisted = await persistAiResultAndCommitUsage({
        userId: user.id,
        featureType: FEATURE_TYPES.INTERVIEW_PREP,
        shouldConsumeUsage: !access.hasPro,
        insertRecord: () => insertInterviewPrepRecord(user.id, {
          jobRole: jobRole.trim(),
          hrQuestions: JSON.stringify(result.hrQuestions ?? []),
          technicalQuestions: JSON.stringify(result.technicalQuestions ?? []),
          behavioralQuestions: JSON.stringify(result.behavioralQuestions ?? []),
          starTips: (result.preparationRoadmap ?? []).join('\n'),
        }),
        deleteRecord: deleteInterviewPrepRecord,
        commitUsage: () => commitSuccessfulDailyUsage(user.id, FEATURE_TYPES.INTERVIEW_PREP),
        buildReportId: (recordId) => `interview_prep:${recordId}`,
      });
      reportId = persisted.reportId;
    } catch (error) {
      if (error instanceof Error && /limit reached/i.test(error.message)) {
        return respondError(res, 429, "You've reached today's free interview preparation limit. Your limit resets tomorrow or upgrade to Pro for unlimited interview preparation.");
      }
      throw error;
    }

    if (!access.hasPro) {
      await recordDailyUsage(user.id, FEATURE_TYPES.INTERVIEW_PREP);
    }
    return res.status(200).json({
      ...result,
      reportId,
    });
  } catch (err) {
    logApiError('interview-prep', err);
    return respondError(res, 502, err instanceof Error ? err.message : CLIENT_ERRORS.INTERVIEW_PREP);
  }
}

function isValidInterviewPrepResult(result: any): boolean {
  return (
    result &&
    typeof result === 'object' &&
    Array.isArray(result.hrQuestions) && result.hrQuestions.length > 0 &&
    Array.isArray(result.technicalQuestions) && result.technicalQuestions.length > 0 &&
    Array.isArray(result.behavioralQuestions) && result.behavioralQuestions.length > 0 &&
    Array.isArray(result.preparationRoadmap)
  );
}
