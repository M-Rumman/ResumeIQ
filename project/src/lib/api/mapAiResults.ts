import type { AiResumeAnalysis } from './analyzeResume.js';

export type ImprovementItem = {
  type: 'warning' | 'error' | 'info' | 'success';
  text: string;
};

export type BulletPair = { before: string; after: string };

export type ResumeDisplayResults = {
  atsScore: number;
  matchScore: number;
  missingKeywords: string[];
  keywordRecommendations: AiResumeAnalysis['keywordRecommendations'];
  detectedSections: string[];
  missingSections: string[];
  improvements: ImprovementItem[];
  jobSpecificImprovements: ImprovementItem[];
  generalResumeImprovements: ImprovementItem[];
  formattingSuggestions: string[];
  bulletSuggestions: BulletPair[];
  parsed: AiResumeAnalysis['parsed'];
  tier: 'pro';
  source: 'ai';
  engine: AiResumeAnalysis;
};

function buildJobSpecificImprovements(ai: AiResumeAnalysis): ImprovementItem[] {
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

function buildGeneralResumeImprovements(ai: AiResumeAnalysis): ImprovementItem[] {
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

function mergeFormattingSuggestions(ai: AiResumeAnalysis): string[] {
  return [...new Set([...(ai.formattingSuggestions || []), ...(ai.formattingIssues || [])])].filter(
    Boolean,
  );
}

function mergeKeywords(ai: AiResumeAnalysis): string[] {
  const combined = [
    ...(ai.missingKeywords || []),
    ...(ai.keywordSuggestions || []),
    ...(ai.keywordGaps || []),
  ].filter(Boolean);
  return [...new Set(combined)].slice(0, 20);
}

/** Display only server-validated bullet rewrites. */
function bulletsFromAi(ai: AiResumeAnalysis): BulletPair[] {
  const fromAi = (ai.improvedBulletPoints || []).filter((b) => b?.before && b?.after);
  return fromAi.slice(0, 6);
}

function mapAiResumeCore(ai: AiResumeAnalysis): ResumeDisplayResults {
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
    parsed: ai.parsed,
    tier: 'pro' as const,
    source: 'ai' as const,
    engine: ai,
  };
}

/**
 * Map Llama/OpenRouter JSON into ResumeAnalyzerPage display shape.
 * Uses AI content only — no generic template suggestions mixed in.
 */
export function mapAiResumeToDisplay(
  ai: AiResumeAnalysis,
): ResumeDisplayResults {
  return mapAiResumeCore(ai);
}
