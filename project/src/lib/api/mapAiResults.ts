import type { AiResumeAnalysis, AiResumeAnalysisPremium } from './analyzeResume.js';

export type ImprovementItem = {
  type: 'warning' | 'error' | 'info' | 'success';
  text: string;
};

export type BulletPair = { 
  before: string; 
  after: string; 
  confidence: 'High' | 'Medium' | 'Low';
  beforeScore: number;
  afterScore: number;
  improvementScore: number;
  improvements: string[];
  whyWeak: string[];
  missingInformation: string[];
  whyStronger: string[];
};

export type PremiumResumeDisplayResults = {
  atsScore: number;
  matchScore: number;
  missingKeywords: string[];
  keywordRecommendations: AiResumeAnalysisPremium['keywordRecommendations'];
  detectedSections: string[];
  missingSections: string[];
  improvements: ImprovementItem[];
  jobSpecificImprovements: ImprovementItem[];
  generalResumeImprovements: ImprovementItem[];
  formattingSuggestions: string[];
  bulletSuggestions: BulletPair[];
  candidateBulletsCount: number;
  parsed: AiResumeAnalysisPremium['parsed'];
  tier: 'premium';
  source: 'ai';
  engine: AiResumeAnalysisPremium;
  requirementBreakdown: any[];
  actionPlan: import('./analyzeResume.js').Gap[];
  matchScoreDetails?: any;
};

export type FreeResumeDisplayResults = {
  tier: 'free';
  source: 'ai';
  parsed: AiResumeAnalysis['parsed'];
  atsScore: number;
  detectedSections: string[];
  missingSections: string[];
  basicFeedback: string[];
};

export type ResumeDisplayResults = PremiumResumeDisplayResults | FreeResumeDisplayResults;

function buildJobSpecificImprovements(ai: AiResumeAnalysisPremium): ImprovementItem[] {
  const items: ImprovementItem[] = [];

  for (const text of ai.improvementSuggestions || []) {
    items.push({ type: 'info', text });
  }
  for (const text of ai.atsIssues || []) {
    items.push({ type: 'warning', text });
  }
  if (ai.missingRequiredSkills?.length) {
    items.push({
      type: 'error',
      text: `Required by the target job but not evidenced in the resume: ${ai.missingRequiredSkills.slice(0, 8).join(', ')}`,
    });
  }
  if (ai.keywordGaps?.length) {
    items.push({
      type: 'info',
      text: `Target-job terms not evidenced in the resume: ${ai.keywordGaps.slice(0, 10).join(', ')}`,
    });
  }

  return items;
}

function buildGeneralResumeImprovements(ai: AiResumeAnalysisPremium): ImprovementItem[] {
  const items: ImprovementItem[] = [];
  for (const text of ai.optimizationRecommendations || []) {
    items.push({ type: 'info', text });
  }
  for (const text of ai.formattingIssues || []) {
    items.push({ type: 'warning', text });
  }
  for (const text of ai.formattingSuggestions || []) {
    items.push({ type: 'info', text });
  }
  return items;
}

function mergeFormattingSuggestions(ai: AiResumeAnalysisPremium): string[] {
  return [...new Set([...(ai.formattingSuggestions || []), ...(ai.formattingIssues || [])])].filter(
    Boolean,
  );
}

function mergeKeywords(ai: AiResumeAnalysisPremium): string[] {
  const combined = [
    ...(ai.missingKeywords || []),
    ...(ai.keywordSuggestions || []),
    ...(ai.keywordGaps || []),
  ].filter(Boolean);
  return [...new Set(combined)].slice(0, 20);
}

/** Display only server-validated bullet rewrites. */
function bulletsFromAi(ai: AiResumeAnalysisPremium): BulletPair[] {
  const fromAi = (ai.improvedBulletPoints || [])
    .filter((b) => b?.before && b?.after)
    .map((b) => ({
      ...b,
      confidence: b.confidence === 'Medium' || b.confidence === 'Low' ? b.confidence : 'High' as const,
    }));
  return fromAi.slice(0, 6);
}

function mapAiResumeCore(ai: AiResumeAnalysisPremium): PremiumResumeDisplayResults {
  const jobSpecificImprovements = buildJobSpecificImprovements(ai);
  const generalResumeImprovements = buildGeneralResumeImprovements(ai);
  return {
    atsScore: ai.atsScore,
    matchScore: ai.matchScore,
    missingKeywords: mergeKeywords(ai),
    keywordRecommendations: ai.keywordRecommendations || [],
    detectedSections: ai.detectedSections || [],
    missingSections: ai.missingSections || [],
    improvements: [...jobSpecificImprovements, ...generalResumeImprovements],
    jobSpecificImprovements,
    generalResumeImprovements,
    formattingSuggestions: mergeFormattingSuggestions(ai),
    bulletSuggestions: bulletsFromAi(ai),
    candidateBulletsCount: ai.candidateBulletsCount || 0,
    parsed: ai.parsed,
    tier: 'premium' as const,
    source: 'ai' as const,
    engine: ai,
    requirementBreakdown: ai.requirementBreakdown || [],
    actionPlan: ai.actionPlan || [],
    matchScoreDetails: ai.matchScoreDetails,
  };
}

/**
 * Map Llama/OpenRouter JSON into ResumeAnalyzerPage display shape.
 * Uses AI content only — no generic template suggestions mixed in.
 */
export function mapAiResumeToDisplay(
  ai: AiResumeAnalysis,
): ResumeDisplayResults {
  if (ai.tier === 'free') {
    return {
      tier: 'free',
      source: 'ai',
      parsed: ai.parsed,
      atsScore: ai.atsScore,
      detectedSections: ai.detectedSections,
      missingSections: ai.missingSections,
      basicFeedback: ai.basicFeedback,
    };
  }
  return mapAiResumeCore(ai);
}
