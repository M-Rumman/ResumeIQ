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

