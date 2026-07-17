import { containsPhoneNumber } from './resumeParser.js';

type RewritePair = { before?: unknown; after?: unknown };

const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i;
const URL_PATTERN = /(?:https?:\/\/|www\.)\S+/i;
const METRIC_PATTERN = /\b\d+(?:\.\d+)?%?\b/g;
const COMMON_CAPITALIZED_WORDS = new Set([
  'A', 'An', 'And', 'At', 'By', 'Created', 'Delivered', 'Designed', 'Developed', 'For', 'In', 'Implemented',
  'Led', 'Managed', 'On', 'Optimized', 'The', 'To', 'With', 'Using', 'Built', 'Improved', 'Reduced',
]);
const GENERIC_KEYWORDS = new Set([
  'ability', 'analysis', 'communication', 'development', 'engineering', 'experience', 'leadership',
  'management', 'projects', 'skills', 'solutions', 'teamwork', 'technology', 'work',
]);
const KEYWORD_FRAGMENT_PATTERNS = [
  /^(?:currently pursuing|understanding of|responsible for|ability to|knowledge of|familiar with)\b/i,
  /^(?:worked|working|developed|developing|implemented|implementing|managed|managing|used|using)\b/i,
];

function normalize(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

function sourceWords(resumeText: string): Set<string> {
  return new Set((resumeText.toLowerCase().match(/[a-z0-9]+/g) || []).filter((word) => word.length >= 3));
}

function hasSensitiveContent(value: string): boolean {
  return EMAIL_PATTERN.test(value) || URL_PATTERN.test(value) || /linkedin/i.test(value) || containsPhoneNumber(value);
}

function hasInventedMetric(value: string, resumeText: string): boolean {
  const resumeMetrics = new Set(resumeText.match(METRIC_PATTERN) || []);
  const metrics = value.match(METRIC_PATTERN) || [];
  return metrics.some((metric) => !resumeMetrics.has(metric));
}

/** Rejects title-case/uppercase named entities that do not occur in resume evidence. */
function hasInventedNamedTerm(value: string, resumeText: string): boolean {
  const source = normalize(resumeText);
  const terms = value.match(/\b(?:[A-Z]{2,}[A-Z0-9+#.-]*|[A-Z][A-Za-z0-9+#.-]*)\b/g) || [];
  return terms.some((term) => !COMMON_CAPITALIZED_WORDS.has(term) && !source.includes(term.toLowerCase()));
}

function isSemanticDuplicate(value: string, existing: string): boolean {
  const words = (text: string) => new Set(
    (text.toLowerCase().match(/[a-z0-9]+/g) || []).filter((word) => word.length > 2),
  );
  const left = words(value);
  const right = words(existing);
  if (!left.size || !right.size) return normalize(value) === normalize(existing);
  const intersection = [...left].filter((word) => right.has(word)).length;
  return intersection / left.size >= 0.75 || intersection / right.size >= 0.75;
}

function recommendationText(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (value && typeof value === 'object' && typeof (value as { text?: unknown }).text === 'string') {
    return (value as { text: string }).text.trim();
  }
  return '';
}

/** A recommendation must have meaningful lexical evidence in the submitted resume. */
function isGroundedRecommendation(value: string, resumeText: string): boolean {
  if (!value || hasSensitiveContent(value) || hasInventedMetric(value, resumeText) || hasInventedNamedTerm(value, resumeText)) {
    return false;
  }
  const source = sourceWords(resumeText);
  const terms = (value.toLowerCase().match(/[a-z0-9]+/g) || []).filter((word) => word.length >= 3);
  return terms.some((word) => source.has(word));
}

function validateKeyword(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const keyword = value.trim();
  const words = keyword.split(/\s+/).filter(Boolean);
  if (!keyword || words.length > 3 || !/^[A-Za-z0-9+# ]+$/.test(keyword)) return null;
  if (GENERIC_KEYWORDS.has(keyword.toLowerCase())) return null;
  if (KEYWORD_FRAGMENT_PATTERNS.some((pattern) => pattern.test(keyword))) return null;
  return keyword;
}

function deduplicateKeywords(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  const seen = new Set<string>();
  return values.reduce<string[]>((result, value) => {
    const keyword = validateKeyword(value);
    if (!keyword || seen.has(normalize(keyword))) return result;
    seen.add(normalize(keyword));
    result.push(keyword);
    return result;
  }, []);
}

function validateRecommendationGroups(output: Record<string, any>, resumeText: string): void {
  const fields = ['atsIssues', 'formattingIssues', 'formattingSuggestions', 'improvementSuggestions', 'optimizationRecommendations'];
  const accepted: string[] = [];

  for (const field of fields) {
    const values = Array.isArray(output[field]) ? output[field] : [];
    output[field] = values.filter((value: unknown) => {
      const text = recommendationText(value);
      if (!isGroundedRecommendation(text, resumeText)) return false;
      if (accepted.some((existing) => isSemanticDuplicate(text, existing))) return false;
      accepted.push(text);
      return true;
    });
  }
}

function validateRewrites(values: unknown, resumeText: string): RewritePair[] {
  if (!Array.isArray(values)) return [];
  const source = normalize(resumeText);
  const accepted: RewritePair[] = [];

  for (const value of values) {
    if (!value || typeof value !== 'object') continue;
    const pair = value as RewritePair;
    const before = typeof pair.before === 'string' ? pair.before.trim() : '';
    const after = typeof pair.after === 'string' ? pair.after.trim() : '';
    if (!before || !after || !source.includes(normalize(before))) continue;
    if (hasSensitiveContent(before) || hasSensitiveContent(after)) continue;
    if (hasInventedMetric(after, resumeText) || hasInventedNamedTerm(after, resumeText)) continue;
    if (accepted.some((item) => normalize(String(item.before)) === normalize(before))) continue;
    accepted.push({ before, after });
  }
  return accepted;
}

/** Validates untrusted LLM resume-analysis output without changing its public schema. */
export function validateAiResumeOutput(raw: Record<string, any>, resumeText: string): Record<string, any> {
  const output = { ...raw };
  const seenKeywords = new Set<string>();
  const dedupeKeywordGroup = (values: unknown) => deduplicateKeywords(values).filter((keyword) => {
    const key = normalize(keyword);
    if (seenKeywords.has(key)) return false;
    seenKeywords.add(key);
    return true;
  });
  output.existingSkills = dedupeKeywordGroup(output.existingSkills);
  output.missingSkills = dedupeKeywordGroup(output.missingSkills);
  output.missingKeywords = dedupeKeywordGroup(output.missingKeywords);
  output.keywordSuggestions = dedupeKeywordGroup(output.keywordSuggestions);
  output.keywordGaps = dedupeKeywordGroup(output.keywordGaps);
  output.missingRequiredSkills = dedupeKeywordGroup(output.missingRequiredSkills);
  output.improvedBulletPoints = validateRewrites(output.improvedBulletPoints, resumeText);
  output.weakBullets = Array.isArray(output.weakBullets)
    ? output.weakBullets.filter((value: unknown) => typeof value === 'string' && normalize(resumeText).includes(normalize(value)))
    : [];
  validateRecommendationGroups(output, resumeText);
  return output;
}
