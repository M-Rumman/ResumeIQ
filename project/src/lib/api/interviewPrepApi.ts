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

export async function fetchAiInterviewPrep(
  jobRole: string,
  experienceLevel: string,
  skills: string,
): Promise<AiInterviewPrep> {
  return apiPost<AiInterviewPrep>('/api/interview-prep', {
    jobRole,
    experienceLevel,
    skills,
  });
}
