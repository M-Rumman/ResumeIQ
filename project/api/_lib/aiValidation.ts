import { containsPhoneNumber } from './resumeParser.js';

type RewritePair = { before?: unknown; after?: unknown };
export type ValidationTelemetry = {
  acceptedRecommendations: number;
  rejectedRecommendations: number;
  rejectionReasons: Record<string, number>;
};

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
const MISSING_SKILL_ACTION_PATTERN = /\b(?:add|mention|include|highlight|emphasize|demonstrate|show|address)\b/i;
const TECHNICAL_REQUIREMENT_SIGNAL = /\b(?:api|architecture|automation|cad|circuit|cloud|database|design|development|docker|embedded|firmware|framework|hardware|integration|kubernetes|library|microcontroller|platform|programming|protocol|security|simulation|software|testing|tool|validation)\b|\b(?:aws|azure|gcp|react|angular|vue|node|python|java|typescript|javascript|c\+\+|c#|sql|stm32|esp32|arduino|ros|ltspice|proteus)\b|[+#\d]/i;

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

function normalizeForPhraseMatch(value: string): string {
  return ` ${normalize(value).replace(/[^a-z0-9+#]+/g, ' ')} `;
}

function candidateMissingJobRequirement(
  recommendation: string,
  resumeText: string,
  jobDescription: string,
): boolean {
  if (!jobDescription || !MISSING_SKILL_ACTION_PATTERN.test(recommendation)) return false;

  const job = normalizeForPhraseMatch(jobDescription);
  const resume = normalizeForPhraseMatch(resumeText);
  const clauses = recommendation
    .split(/[.!?;]|\b(?:to|for|in|on|with)\s+(?:your|the|a|an)\b/i)
    .map((clause) => clause.trim())
    .filter(Boolean);

  for (const clause of clauses) {
    const action = clause.match(/\b(?:add|mention|include|highlight|emphasize|demonstrate|show|address)\s+(.+)/i);
    if (!action) continue;

    const candidate = action[1]
      .replace(/^(?:experience|skills?|knowledge|proficiency)\s+(?:with|in)\s+/i, '')
      .replace(/\s+to\s+(?:(?:your|the)\s+)?(?:skills?|resume|experience|profile)\b.*$/i, '')
      .replace(/\s+(?:within|under)\s+(?:your|the)\b.*$/i, '')
      .trim();
    const candidates = candidate.split(/\s*(?:,|\/|\band\b)\s*/i).filter(Boolean);
    if (!candidates.length) continue;

    const everyCandidateIsMissingRequirement = candidates.every((item) => {
      const words = item.match(/[A-Za-z0-9+#]+/g) || [];
      if (words.length === 0 || words.length > 4 || !TECHNICAL_REQUIREMENT_SIGNAL.test(item)) return false;
      const phrase = normalizeForPhraseMatch(item);
      return job.includes(phrase) && !resume.includes(phrase);
    });
    if (everyCandidateIsMissingRequirement) return true;
  }

  return false;
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
function isGroundedRecommendation(value: string, resumeText: string, jobDescription: string): boolean {
  const missingJobRequirement = candidateMissingJobRequirement(value, resumeText, jobDescription);
  if (!value || hasSensitiveContent(value) || hasInventedMetric(value, resumeText)) {
    return false;
  }
  if (hasInventedNamedTerm(value, resumeText) && !missingJobRequirement) return false;
  if (missingJobRequirement) return true;
  const source = sourceWords(resumeText);
  const terms = (value.toLowerCase().match(/[a-z0-9]+/g) || []).filter((word) => word.length >= 3);
  return terms.some((word) => source.has(word));
}

function recommendationRejectionReason(value: string, resumeText: string, jobDescription: string): string {
  if (!value) return 'empty';
  if (hasSensitiveContent(value)) return 'sensitive_content';
  if (hasInventedMetric(value, resumeText)) return 'invented_metric';
  const missingJobRequirement = candidateMissingJobRequirement(value, resumeText, jobDescription);
  if (hasInventedNamedTerm(value, resumeText) && !missingJobRequirement) return 'unsupported_named_term';
  return 'insufficient_resume_evidence';
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

function validateRecommendationGroups(
  output: Record<string, any>,
  resumeText: string,
  jobDescription: string,
  telemetry?: ValidationTelemetry,
): void {
  const fields = ['atsIssues', 'formattingIssues', 'formattingSuggestions', 'improvementSuggestions', 'optimizationRecommendations'];
  const accepted: string[] = [];

  for (const field of fields) {
    const values = Array.isArray(output[field]) ? output[field] : [];
    output[field] = values.filter((value: unknown) => {
      const text = recommendationText(value);
      if (!isGroundedRecommendation(text, resumeText, jobDescription)) {
        if (telemetry) {
          telemetry.rejectedRecommendations += 1;
          const reason = recommendationRejectionReason(text, resumeText, jobDescription);
          telemetry.rejectionReasons[reason] = (telemetry.rejectionReasons[reason] || 0) + 1;
        }
        return false;
      }
      if (accepted.some((existing) => isSemanticDuplicate(text, existing))) {
        if (telemetry) {
          telemetry.rejectedRecommendations += 1;
          telemetry.rejectionReasons.duplicate = (telemetry.rejectionReasons.duplicate || 0) + 1;
        }
        return false;
      }
      accepted.push(text);
      if (telemetry) telemetry.acceptedRecommendations += 1;
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
export function validateAiResumeOutput(
  raw: Record<string, any>,
  resumeText: string,
  jobDescription = '',
  telemetry?: ValidationTelemetry,
): Record<string, any> {
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
  validateRecommendationGroups(output, resumeText, jobDescription, telemetry);
  return output;
}
