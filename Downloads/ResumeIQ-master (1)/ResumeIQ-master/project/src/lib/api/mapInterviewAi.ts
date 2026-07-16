import type { AiInterviewPrep } from './interviewPrepApi.js';
import { generateInterviewPrep, toInterviewDisplayResults } from '../../utils/interviewPrep.js';

function mapQuestion(q: {
  question: string;
  idealAnswer?: string;
  tip: string;
  followUps?: string[];
  followUpQuestions?: string[];
}) {
  const followUps = q.followUps || q.followUpQuestions || [];
  return {
    question: q.question,
    tip: q.tip,
    idealAnswer: q.idealAnswer || '',
    followUps,
  };
}

function getLocalInterview(role: string, experienceLevel: string, skills: string) {
  const enginePrep = generateInterviewPrep({
    role,
    experienceLevel,
    skills,
    tier: 'pro',
  });
  return toInterviewDisplayResults(enginePrep);
}

function mapAiInterviewCore(ai: AiInterviewPrep) {
  const behavioral = (ai.behavioralQuestions || []).map(mapQuestion);
  const technical = (ai.technicalQuestions || []).map(mapQuestion);
  const hr = (ai.hrQuestions || []).length
    ? ai.hrQuestions.map(mapQuestion)
    : [];

  const roadmap = ai.preparationRoadmap || [];
  const prepTips = ai.preparationSuggestions || [];
  const comm = ai.communicationTips || [];

  return {
    hr,
    technical,
    behavioral,
    starTips: roadmap.length ? roadmap : prepTips.slice(0, 6),
    communicationTips: comm.length ? comm : prepTips.slice(0, 4),
    preparationSuggestions: prepTips.length ? prepTips : roadmap,
    source: 'ai' as const,
  };
}

/** Pure Llama/OpenRouter mapping — no local template questions mixed in. */
export function mapAiInterviewToDisplay(ai: AiInterviewPrep) {
  return mapAiInterviewCore(ai);
}

export function mapAiInterviewToDisplayWithContext(
  ai: AiInterviewPrep,
  _role: string,
  _experienceLevel: string,
  _skills: string,
) {
  return mapAiInterviewCore(ai);
}

export function mapLocalInterviewToDisplay(
  role: string,
  experienceLevel: string,
  skills: string,
) {
  return {
    ...getLocalInterview(role, experienceLevel, skills),
    source: 'local' as const,
  };
}
