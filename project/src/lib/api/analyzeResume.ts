import { apiPost } from './client.js';

const DEFAULT_ANALYSIS_TIMEOUT_MS = 120_000;
const MIN_ANALYSIS_TIMEOUT_MS = 30_000;
const MAX_ANALYSIS_TIMEOUT_MS = 180_000;

function analysisTimeoutMs(): number {
  const configured = Number(import.meta.env.VITE_AI_ANALYSIS_TIMEOUT_MS);
  if (!Number.isFinite(configured) || configured <= 0) return DEFAULT_ANALYSIS_TIMEOUT_MS;
  return Math.min(MAX_ANALYSIS_TIMEOUT_MS, Math.max(MIN_ANALYSIS_TIMEOUT_MS, configured));
}

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
  existingSkills: string[];
  missingSkills: string[];
  missingKeywords: string[];
  keywordRecommendations: {
    keyword: string;
    priority: 'Critical' | 'Important' | 'Optional';
    whyItMatters: string;
    recommendedSection: 'Skills' | 'Experience' | 'Projects';
  }[];
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
  atsScoreExplanation: {
    strengths: string[];
    missingElements: string[];
    formattingIssues: string[];
    keywordIssues: string[];
    whatIncreasedScore: string[];
    whatReducedScore: string[];
    topImprovements: string[];
    estimatedScoreImprovement: number;
    potentialAtsScore: number;
  };
  jobMatchExplanation: {
    strongMatches: string[];
    partialMatches: string[];
    missingSkills: string[];
  };
  hiringManagerAssessment: {
    overallDecision: 'Strong Match' | 'Good Match' | 'Potential Match' | 'Weak Match' | 'Poor Match';
    recruiterSummary: string;
    topReasonsToInterview: string[];
    topReasonsForRejection: string[];
    estimatedInterviewProbability: number;
    biggestImprovements: { text: string; estimatedImpact: number }[];
    confidence: 'High' | 'Medium' | 'Low';
  };
}

export async function fetchAiResumeAnalysis(
  resumeText: string,
  jobDescription: string,
): Promise<AiResumeAnalysis> {
  return apiPost<AiResumeAnalysis>('/api/analyze-resume', {
    resumeText,
    jobDescription,
    jobRole: jobDescription,
  }, { timeoutMs: analysisTimeoutMs() });
}
