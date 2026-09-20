import { apiPost } from './client.js';

export interface AiInterviewQuestion {
  question: string;
  idealAnswer: string;
  tip: string;
  followUpQuestions: string[];
}

export interface AiInterviewPrep {
  technicalQuestions: AiInterviewQuestion[];
  behavioralQuestions: AiInterviewQuestion[];
  hrQuestions: AiInterviewQuestion[];
  preparationRoadmap: string[];
  communicationTips: string[];
  preparationSuggestions: string[];
}

export interface StartInterviewSessionPayload {
  interviewerName: string;
  voiceId: string;
  avatarId: string;
  jobRole?: string;
  questionId?: string;
}

export interface StarBreakdown {
  situation: { present: boolean; feedback: string };
  task: { present: boolean; feedback: string };
  action: { present: boolean; feedback: string };
  result: { present: boolean; feedback: string };
}

export interface AnswerEvaluation {
  overallScore: number;
  rating: 'Strong Hire' | 'Hire' | 'Borderline' | 'Needs Improvement';
  summaryFeedback: string;
  spokenFeedback: string;
  strengths: string[];
  improvements: string[];
  starBreakdown: StarBreakdown;
  detectedKeyTerms: string[];
}

export interface EvaluateAnswerPayload {
  question: string;
  stage?: string;
  candidateAnswer: string;
  suggestedPoints?: string[];
  tip?: string;
  interviewerPersona?: {
    id?: string;
    name: string;
    role: string;
    style: string;
  };
  durationSeconds?: number;
  wpm?: number;
  fillerCount?: number;
}

export async function fetchAiInterviewPrep(
  jobRole: string,
  experienceLevel: string,
  skills: string,
  interviewer?: { name: string; voiceId: string; avatarId: string },
): Promise<AiInterviewPrep> {
  return apiPost<AiInterviewPrep>('/api/interview-prep', {
    jobRole,
    experienceLevel,
    skills,
    voiceId: interviewer?.voiceId,
    avatarId: interviewer?.avatarId,
    interviewerName: interviewer?.name,
  });
}

export async function startInterviewSession(
  payload: StartInterviewSessionPayload
): Promise<{ status: string; sessionStartedAt: string }> {
  try {
    return await apiPost<{ status: string; sessionStartedAt: string }>('/api/interview-prep', {
      action: 'start_session',
      ...payload,
    });
  } catch {
    // Client-side fallback if backend route only handles prep generation
    return { status: 'started', sessionStartedAt: new Date().toISOString() };
  }
}

/**
 * Evaluates candidate response using multi-criteria NLP heuristic & AI evaluation.
 * Computes STAR completeness, technical relevance, depth, strengths, missing elements,
 * and interviewer-specific spoken critique.
 */
export async function evaluateInterviewAnswer(
  payload: EvaluateAnswerPayload
): Promise<AnswerEvaluation> {
  try {
    const apiResult = await apiPost<AnswerEvaluation>('/api/interview-prep', {
      action: 'evaluate_answer',
      ...payload,
    });
    if (apiResult && typeof apiResult.overallScore === 'number' && apiResult.summaryFeedback) {
      return apiResult;
    }
  } catch {
    // Fall back to our local client-side evaluation engine
  }

  return generateLocalAnswerEvaluation(payload);
}

export function generateLocalAnswerEvaluation(payload: EvaluateAnswerPayload): AnswerEvaluation {
  const text = (payload.candidateAnswer || '').trim();
  const lower = text.toLowerCase();
  const words = text.split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  const personaName = payload.interviewerPersona?.name || 'Interviewer';
  const personaId = payload.interviewerPersona?.id || 'alex';

  // Handle empty or extremely short answers
  if (wordCount < 10) {
    return {
      overallScore: 35,
      rating: 'Needs Improvement',
      summaryFeedback: 'Response is too brief to evaluate technical depth or behavioral impact. Please elaborate with specific examples and steps.',
      spokenFeedback: `That was quite brief. In an actual interview, you'll want to structure your answer with concrete context, what you specifically did, and the end outcome. Let's try expanding on that.`,
      strengths: ['Addressed the topic directly without unnecessary preamble.'],
      improvements: [
        'Provide concrete project context and scale details.',
        'Use the STAR framework (Situation, Task, Action, Result) to give a complete story.',
        'Quantify outcomes with measurable metrics or engineering impact.',
      ],
      starBreakdown: {
        situation: { present: false, feedback: 'No background or context provided.' },
        task: { present: false, feedback: 'No specific goal or task defined.' },
        action: { present: false, feedback: 'Action steps were missing or too sparse.' },
        result: { present: false, feedback: 'No measurable outcome or reflection mentioned.' },
      },
      detectedKeyTerms: [],
    };
  }

  // 1. STAR Framework Pattern Detection
  const hasSituation =
    /\b(when|in my (previous|last|recent) (role|job|company)|at (my|our)|during|project|team was|we were|system had|faced|background)\b/i.test(lower);
  const hasTask =
    /\b(task|goal|objective|needed to|had to|responsible for|target|requirement|challenge|problem was)\b/i.test(lower);
  const hasAction =
    /\b(i (built|designed|implemented|refactored|led|analyzed|decided|debugged|migrated|optimized|developed|created|setup|configured|collaborated)|my approach|steps i took|strategy)\b/i.test(lower);
  const hasResult =
    /\b(result|outcome|achieved|reduced|improved|increased|saved|delivered|success|impact|%|percent|ms|seconds|users|revenue|scale)\b/i.test(lower);

  const starCount = [hasSituation, hasTask, hasAction, hasResult].filter(Boolean).length;

  // 2. Keyword & Concept Matching
  const suggested = payload.suggestedPoints || [];
  const detectedKeyTerms: string[] = [];
  const missingPoints: string[] = [];

  suggested.forEach((point) => {
    const keywords = point
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 3 && !['with', 'what', 'that', 'this', 'from', 'have', 'your', 'about'].includes(w));

    const matched = keywords.filter((k) => lower.includes(k));
    if (matched.length >= 1) {
      detectedKeyTerms.push(...matched.slice(0, 2));
    } else {
      missingPoints.push(point);
    }
  });

  const uniqueKeyTerms = Array.from(new Set(detectedKeyTerms));

  // 3. Technical & Quantitative Markers
  const hasMetrics = /\b(\d+%|\d+\s*(x|ms|seconds|minutes|hours|users|gb|mb|rps|qps)|metric|latency|throughput|roi)\b/i.test(lower);
  const hasEngineeringDepth = /\b(trade-off|architecture|scalab|database|query|cache|microservice|concurrency|pipeline|monitoring|rollback|async|refactor|test)\b/i.test(lower);
  const hasLeadershipOrCollaboration = /\b(collaborat|stakeholder|mentored|team|consensus|disagree|persuad|communicat|cross-functional)\b/i.test(lower);

  // 4. Score Calculation
  let baseScore = 60;

  // Length scoring (ideal: 70 - 280 words)
  if (wordCount >= 70 && wordCount <= 300) {
    baseScore += 12;
  } else if (wordCount >= 40) {
    baseScore += 6;
  } else {
    baseScore -= 10;
  }

  // STAR scoring (+5 per element)
  baseScore += starCount * 5;

  // Keyword relevance
  if (uniqueKeyTerms.length >= 3) baseScore += 10;
  else if (uniqueKeyTerms.length >= 1) baseScore += 5;

  // Quantitative metrics bonus
  if (hasMetrics) baseScore += 6;
  if (hasEngineeringDepth) baseScore += 5;
  if (hasLeadershipOrCollaboration) baseScore += 4;

  // Filler word penalty
  const fillerCount = payload.fillerCount || 0;
  if (fillerCount > 5) baseScore -= 6;
  else if (fillerCount === 0 && wordCount > 40) baseScore += 3;

  const overallScore = Math.min(97, Math.max(45, Math.round(baseScore)));

  // Rating
  let rating: AnswerEvaluation['rating'] = 'Hire';
  if (overallScore >= 88) rating = 'Strong Hire';
  else if (overallScore >= 75) rating = 'Hire';
  else if (overallScore >= 62) rating = 'Borderline';
  else rating = 'Needs Improvement';

  // Strengths
  const strengths: string[] = [];
  if (hasAction) {
    strengths.push('Clear ownership: explicitly outlined the proactive actions and technical decisions you led.');
  }
  if (hasMetrics) {
    strengths.push('Data-driven outcome: backed up achievements with concrete metrics and impact.');
  }
  if (uniqueKeyTerms.length > 0) {
    strengths.push(`Direct domain relevance: effectively incorporated core concepts (${uniqueKeyTerms.slice(0, 3).join(', ')}).`);
  }
  if (hasSituation && hasTask) {
    strengths.push('Solid context setting: clearly framed initial constraints and goals before jumping into execution.');
  }
  if (strengths.length === 0) {
    strengths.push('Clear and articulate communication of your experience.');
  }

  // Improvements
  const improvements: string[] = [];
  if (!hasResult) {
    improvements.push('Conclude with a measurable result: quantify business impact, latency delta, or efficiency gain.');
  }
  if (!hasAction) {
    improvements.push('Highlight personal initiative ("I evaluated..." vs "We just did...") to showcase your individual technical leadership.');
  }
  if (missingPoints.length > 0) {
    improvements.push(`Address expected criteria: consider touching upon ${missingPoints[0].toLowerCase().replace(/\.$/, '')}.`);
  }
  if (fillerCount > 4) {
    improvements.push('Pause instead of using filler words to project composure during transitions.');
  }
  if (wordCount < 60) {
    improvements.push('Provide a bit more depth on the architectural trade-offs or alternative options you considered.');
  }
  if (improvements.length === 0) {
    improvements.push('Add reflection on what you would do differently in hindsight to show engineering maturity.');
  }

  // Persona-tailored Spoken Feedback
  let spokenFeedback = '';
  if (personaId === 'sarah') {
    if (overallScore >= 80) {
      spokenFeedback = `Great answer. I appreciate how methodically you broke down the technical decisions and constraints. You demonstrated sound engineering judgment.`;
    } else {
      spokenFeedback = `You've got the right starting intuition. For a staff-level bar, I want to hear more about the trade-offs you evaluated and how your solution handled edge cases.`;
    }
  } else if (personaId === 'marcus') {
    if (overallScore >= 80) {
      spokenFeedback = `Strong response. You tied the engineering effort directly to execution and impact, which is exactly what leadership looks for.`;
    } else {
      spokenFeedback = `Good effort. Next time, emphasize the broader team alignment and the concrete business metrics achieved as a result of your work.`;
    }
  } else {
    // Alex Rivera
    if (overallScore >= 80) {
      spokenFeedback = `Excellent delivery! Your story flowed naturally, your communication was crisp, and you highlighted real collaboration.`;
    } else {
      spokenFeedback = `Thanks for walking me through that. To take this to the next level, structure it cleanly with the STAR framework so the punchline lands clearly.`;
    }
  }

  const summaryFeedback = `Overall Score: ${overallScore}/100 (${rating}). Evaluated by ${personaName}. ${
    overallScore >= 80
      ? 'The response demonstrates strong readiness and relevant problem-solving skills.'
      : 'The response covers foundational elements but requires more structured metrics and depth.'
  }`;

  return {
    overallScore,
    rating,
    summaryFeedback,
    spokenFeedback,
    strengths: strengths.slice(0, 3),
    improvements: improvements.slice(0, 3),
    starBreakdown: {
      situation: {
        present: hasSituation,
        feedback: hasSituation ? 'Context and background were clearly framed.' : 'Add brief context explaining the project and scale.',
      },
      task: {
        present: hasTask,
        feedback: hasTask ? 'The primary objective was well articulated.' : 'Clarify what specific goal or requirement was assigned to you.',
      },
      action: {
        present: hasAction,
        feedback: hasAction ? 'Your specific contributions and implementation steps were clear.' : 'Detail the exact technical steps you personally took.',
      },
      result: {
        present: hasResult,
        feedback: hasResult ? 'Concluded with tangible impact or outcome.' : 'Include measurable metrics or post-launch takeaways.',
      },
    },
    detectedKeyTerms: uniqueKeyTerms,
  };
}

