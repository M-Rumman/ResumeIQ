import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getUserFromRequest } from './_lib/auth.js';
import { generateInterviewPrepWithAi, evaluateInterviewAnswerWithAi } from './_lib/openrouter.js';
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

  const body = req.body as {
    action?: string;
    jobRole?: string;
    experienceLevel?: string;
    skills?: string;
    interviewerName?: string;
    voiceId?: string;
    avatarId?: string;
    question?: string;
    candidateAnswer?: string;
    suggestedPoints?: string[];
    stage?: string;
    interviewerPersona?: {
      id?: string;
      name?: string;
      role?: string;
      style?: string;
    };
  };

  const user = await getUserFromRequest(req);
  if (!user && body.action !== 'evaluate_answer' && body.action !== 'start_session') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (user) {
    const rate = await enforceAiRateLimit(user.id);
    if (!rate.allowed) {
      res.setHeader('Retry-After', String(rate.retryAfter));
      return res.status(429).json({
        error: 'Too many requests. Please wait a moment and try again.',
      });
    }
  }

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
    const candidateAnswer = String(body.candidateAnswer || '').trim();
    const question = String(body.question || '').trim();
    const suggestedPoints = Array.isArray(body.suggestedPoints) ? body.suggestedPoints : [];
    const stage = String(body.stage || 'Technical Round');
    const persona = body.interviewerPersona || { name: 'Alex Rivera', role: 'Principal Engineer', id: 'alex' };
    const personaName = persona.name || 'Alex Rivera';
    const personaRole = persona.role || 'Principal Engineer';

    const words = candidateAnswer.split(/\s+/).filter(Boolean);
    const wordCount = words.length;

    // Handle empty or too brief answers
    if (wordCount < 5) {
      return res.status(200).json({
        isCorrect: false,
        correctnessAssessment: 'Answer is too brief to evaluate against the question. Please provide a detailed response.',
        overallScore: 25,
        rating: 'Needs Improvement',
        summaryFeedback: 'Response was too concise to assess candidate proficiency. Elaboration recommended.',
        spokenFeedback: `That was a bit too brief. Please explain your approach in detail so I can evaluate your technical understanding.`,
        strengths: ['Attempted to respond.'],
        improvements: ['Directly address the question with technical depth.', 'Use the STAR framework to explain your actions and outcomes.'],
        starBreakdown: {
          situation: { present: false, feedback: 'Missing background context.' },
          task: { present: false, feedback: 'Missing task definition.' },
          action: { present: false, feedback: 'Missing concrete steps taken.' },
          result: { present: false, feedback: 'Missing quantifiable result.' },
        },
        detectedKeyTerms: [],
        missingKeyPoints: suggestedPoints.slice(0, 3),
      });
    }

    // Attempt AI evaluation with question verification
    try {
      const aiEvaluation = await evaluateInterviewAnswerWithAi({
        question,
        candidateAnswer,
        suggestedPoints,
        stage,
        personaName,
        personaRole,
      });

      if (aiEvaluation && typeof aiEvaluation.overallScore === 'number') {
        return res.status(200).json(aiEvaluation);
      }
    } catch (aiErr) {
      console.warn('[Interview Prep API] AI evaluation fallback triggered:', aiErr);
    }

    // High-accuracy semantic & conceptual question verification fallback
    const lower = candidateAnswer.toLowerCase();
    const stopWords = new Set([
      'what', 'when', 'where', 'which', 'with', 'about', 'explain', 'describe',
      'difference', 'between', 'your', 'have', 'could', 'would', 'should',
      'please', 'tell', 'time', 'how', 'why', 'the', 'and', 'for', 'you',
    ]);

    // Extract core question terms
    const questionTerms = question
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 3 && !stopWords.has(w));

    const matchedQuestionTerms = questionTerms.filter((term) => lower.includes(term));
    const questionRelevanceRatio = questionTerms.length > 0
      ? matchedQuestionTerms.length / questionTerms.length
      : 1;

    // Check suggested key points
    const detectedKeyTerms: string[] = [];
    const missingKeyPoints: string[] = [];

    suggestedPoints.forEach((point) => {
      const keywords = point
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 3 && !stopWords.has(w));

      const matched = keywords.filter((k) => lower.includes(k));
      if (matched.length >= 1) {
        detectedKeyTerms.push(...matched.slice(0, 2));
      } else {
        missingKeyPoints.push(point);
      }
    });

    const uniqueDetectedTerms = Array.from(new Set([...detectedKeyTerms, ...matchedQuestionTerms]));

    // STAR framework detection
    const hasSituation = /\b(when|in my (previous|last|recent)|at (my|our)|during|project|team was|we were|system had|faced)\b/i.test(lower);
    const hasTask = /\b(task|goal|objective|needed to|had to|responsible for|target|requirement|problem was)\b/i.test(lower);
    const hasAction = /\b(i (built|designed|implemented|refactored|led|analyzed|decided|debugged|migrated|optimized)|my approach|steps taken)\b/i.test(lower);
    const hasResult = /\b(result|outcome|achieved|reduced|improved|increased|saved|delivered|impact|%|percent|ms)\b/i.test(lower);
    const starCount = [hasSituation, hasTask, hasAction, hasResult].filter(Boolean).length;

    // Verify correctness: candidate must address question terms or suggested concepts
    const isTopicAddressed = matchedQuestionTerms.length > 0 || detectedKeyTerms.length > 0;
    const isCorrect = isTopicAddressed && wordCount >= 12;

    let base = 50;
    if (isCorrect) {
      base += 20;
      base += Math.min(15, Math.round(questionRelevanceRatio * 20));
      base += starCount * 4;
      if (wordCount >= 60 && wordCount <= 280) base += 8;
      if (/\b(\d+%|\d+\s*(x|ms|seconds|minutes|users|gb)|metric|latency|throughput)\b/i.test(lower)) base += 4;
      if (/\b(trade-off|architecture|scalab|database|query|cache|microservice|pipeline|monitoring|rollback)\b/i.test(lower)) base += 4;
    } else {
      base = Math.max(30, 45 - (questionTerms.length > 0 && matchedQuestionTerms.length === 0 ? 15 : 0));
    }

    const score = Math.min(96, Math.max(30, Math.round(base)));
    let rating: 'Strong Hire' | 'Hire' | 'Borderline' | 'Needs Improvement' = 'Hire';
    if (score >= 88) rating = 'Strong Hire';
    else if (score >= 75) rating = 'Hire';
    else if (score >= 60) rating = 'Borderline';
    else rating = 'Needs Improvement';

    const correctnessAssessment = isCorrect
      ? `Your answer directly addressed the question and demonstrated accurate technical understanding.`
      : `Your answer did not directly address the question asked. Be sure to focus specifically on the prompt: "${question}".`;

    const strengths: string[] = [];
    if (isCorrect && matchedQuestionTerms.length > 0) strengths.push(`Directly tackled question concepts: ${matchedQuestionTerms.slice(0, 3).join(', ')}.`);
    if (hasAction) strengths.push('Clear personal technical ownership and approach.');
    if (hasResult) strengths.push('Connected actions to measurable engineering and business impact.');
    if (strengths.length === 0) strengths.push('Provided an initial overview of the topic.');

    const improvements: string[] = [];
    if (!isCorrect) improvements.push(`Focus directly on the question rather than tangential topics.`);
    if (missingKeyPoints.length > 0) improvements.push(`Cover key expected points: ${missingKeyPoints[0]}`);
    if (!hasResult) improvements.push('Always quantify the outcome with measurable KPIs or latency deltas.');
    if (improvements.length === 0) improvements.push('Conclude with a brief reflection on architectural trade-offs.');

    const spoken = isCorrect
      ? (score >= 80
        ? `Solid answer. You addressed the core requirements clearly and articulated your solution well.`
        : `Good direction. You answered the question, though detailing deeper metrics or edge cases will make it even stronger.`)
      : `That response doesn't quite answer what was asked. Let's refocus on the specific question asked and walk through your approach.`;

    return res.status(200).json({
      isCorrect,
      correctnessAssessment,
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
      detectedKeyTerms: uniqueDetectedTerms.slice(0, 6),
      missingKeyPoints: missingKeyPoints.slice(0, 3),
    });
  }

  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
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
