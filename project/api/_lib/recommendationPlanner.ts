type Confidence = 'High' | 'Medium' | 'Low';

type RecommendationValue = string | { text?: unknown; confidence?: unknown };

const RECOMMENDATION_FIELDS = [
  'atsIssues',
  'formattingIssues',
  'formattingSuggestions',
  'improvementSuggestions',
  'optimizationRecommendations',
] as const;

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function words(value: string): Set<string> {
  return new Set(normalize(value).split(' ').filter((word) => word.length > 2));
}

function textOf(value: RecommendationValue): string {
  if (typeof value === 'string') return value.trim();
  if (value && typeof value.text === 'string') return value.text.trim();
  return '';
}

function semanticallySimilar(left: string, right: string): boolean {
  const leftWords = words(left);
  const rightWords = words(right);
  if (!leftWords.size || !rightWords.size) return normalize(left) === normalize(right);
  const overlap = [...leftWords].filter((word) => rightWords.has(word)).length;
  return overlap / leftWords.size >= 0.75 || overlap / rightWords.size >= 0.75;
}

/** Confidence remains internal; the existing response normalizer continues returning strings. */
function confidenceFor(value: string, resumeText: string): Confidence {
  const resumeWords = words(resumeText);
  const recommendationWords = words(value);
  const overlap = [...recommendationWords].filter((word) => resumeWords.has(word)).length;
  if (overlap >= 2 || /\b\d+(?:\.\d+)?%?\b/.test(value)) return 'High';
  if (overlap === 1) return 'Medium';
  return 'Low';
}

function retainUniqueRecommendations(values: unknown, seen: string[], resumeText: string): RecommendationValue[] {
  if (!Array.isArray(values)) return [];
  const result: RecommendationValue[] = [];
  for (const value of values as RecommendationValue[]) {
    const text = textOf(value);
    const confidence = confidenceFor(text, resumeText);
    if (!text || confidence === 'Low' || seen.some((existing) => semanticallySimilar(text, existing))) continue;
    seen.push(text);
    result.push(typeof value === 'string' ? value : { ...value, confidence });
  }
  return result;
}

function dedupeKeywords(output: Record<string, any>): void {
  const fields = ['missingKeywords', 'keywordSuggestions', 'keywordGaps', 'missingRequiredSkills'];
  const seen = new Set<string>();
  for (const field of fields) {
    const values = Array.isArray(output[field]) ? output[field] : [];
    output[field] = values.filter((value: unknown) => {
      if (typeof value !== 'string') return false;
      const key = normalize(value);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}

/**
 * Plans one resume recommendation per observation across ATS, format, and improvement sections.
 * Weak bullets are reserved for the bullet-rewrite section whenever a rewrite exists.
 */
export function planResumeRecommendations(raw: Record<string, any>, resumeText: string): Record<string, any> {
  const output = { ...raw };
  const seen: string[] = [];

  for (const field of RECOMMENDATION_FIELDS) {
    output[field] = retainUniqueRecommendations(output[field], seen, resumeText);
  }

  const rewrittenBefore = new Set(
    (Array.isArray(output.improvedBulletPoints) ? output.improvedBulletPoints : [])
      .map((pair: { before?: unknown }) => typeof pair?.before === 'string' ? normalize(pair.before) : '')
      .filter(Boolean),
  );
  output.weakBullets = (Array.isArray(output.weakBullets) ? output.weakBullets : []).filter(
    (bullet: unknown) => {
      if (typeof bullet !== 'string' || rewrittenBefore.has(normalize(bullet))) return false;
      if (seen.some((existing) => semanticallySimilar(bullet, existing))) return false;
      seen.push(bullet);
      return true;
    },
  );

  dedupeKeywords(output);
  return output;
}

/** Keeps interview roadmap, communication, and preparation advice from repeating across lists. */
export function planInterviewRecommendations(raw: Record<string, any>): Record<string, any> {
  const output = { ...raw };
  const fields = ['preparationRoadmap', 'communicationTips', 'preparationSuggestions'];
  const seen: string[] = [];

  for (const field of fields) {
    const values = Array.isArray(output[field]) ? output[field] : [];
    output[field] = values.filter((value: unknown) => {
      if (typeof value !== 'string' || !value.trim() || seen.some((existing) => semanticallySimilar(value, existing))) {
        return false;
      }
      seen.push(value);
      return true;
    });
  }
  return output;
}
