import { apiPost } from './client.js';

export interface ParsedResume {
  name: string;
  email: string;
  phone: string;
  location: string;
  education: string[];
  skills: string[];
  experience: string[];
  projects: string[];
  certifications: string[];
}

export interface AiResumeAnalysis {
  parsed: ParsedResume;
  atsScore: number;
  matchScore: number;
  missingKeywords: string[];
  keywordSuggestions: string[];
  keywordGaps: string[];
  missingRequiredSkills: string[];
  detectedSections: string[];
  missingSections: string[];
  formattingSuggestions: string[];
  formattingIssues: string[];
  weakBullets: string[];
  improvedBulletPoints: { before: string; after: string }[];
  improvementSuggestions: string[];
  optimizationRecommendations: string[];
  atsIssues: string[];
}

export async function fetchAiResumeAnalysis(
  resumeText: string,
  jobDescription: string,
): Promise<AiResumeAnalysis> {
  return apiPost<AiResumeAnalysis>('/api/analyze-resume', {
    resumeText,
    jobDescription,
    jobRole: jobDescription,
  }, { timeoutMs: 45_000 });
}
