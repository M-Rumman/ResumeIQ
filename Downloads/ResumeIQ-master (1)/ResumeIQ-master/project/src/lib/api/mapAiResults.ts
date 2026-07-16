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
  detectedSections: string[];
  missingSections: string[];
  improvements: ImprovementItem[];
  formattingSuggestions: string[];
  bulletSuggestions: BulletPair[];
  parsed: AiResumeAnalysis['parsed'];
  tier: 'pro';
  source: 'ai';
  engine: AiResumeAnalysis;
};

function buildImprovements(ai: AiResumeAnalysis): ImprovementItem[] {
  const items: ImprovementItem[] = [];

  for (const text of ai.improvementSuggestions || ai.optimizationRecommendations || []) {
    items.push({ type: 'info', text });
  }
  for (const text of ai.atsIssues || []) {
    items.push({ type: 'warning', text });
  }
  for (const text of ai.formattingIssues || []) {
    items.push({ type: 'info', text });
  }
  for (const text of ai.weakBullets || []) {
    items.push({ type: 'warning', text: `Weak bullet: ${text}` });
  }
  if (ai.missingRequiredSkills?.length) {
    items.push({
      type: 'error',
      text: `Missing required skills: ${ai.missingRequiredSkills.slice(0, 8).join(', ')}`,
    });
  }
  if (ai.keywordGaps?.length) {
    items.push({
      type: 'info',
      text: `Keyword gaps vs job description: ${ai.keywordGaps.slice(0, 10).join(', ')}`,
    });
  }
  if (ai.detectedSections?.length) {
    items.push({
      type: 'success',
      text: `Strong sections detected: ${ai.detectedSections.join(', ')}`,
    });
  }

  return items.length > 0
    ? items
    : [{ type: 'info', text: 'Review the recommendations below to strengthen your resume.' }];
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
  return {
    atsScore: ai.atsScore,
    matchScore: ai.matchScore,
    missingKeywords: mergeKeywords(ai),
    detectedSections: ai.detectedSections || [],
    missingSections: ai.missingSections || [],
    improvements: buildImprovements(ai),
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
