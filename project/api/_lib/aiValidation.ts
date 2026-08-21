import { containsPhoneNumber } from './resumeParser.js';
import { scoreBulletQuality, generateReasoning, ScoreBreakdown } from './analysis-engine/bulletScoring.js';

export type RewritePair = {
  before: string;
  beforeScore: number;
  after: string;
  afterScore: number;
  improvementScore: number;
  groundingConfidence: 'High' | 'Medium' | 'Low';
  whyItIsWeak: string;
  whatInformationIsMissing: string;
  whyThisIsStronger: string;
  beforeScoreBreakdown: ScoreBreakdown;
  afterScoreBreakdown: ScoreBreakdown;
  scoreBreakdown: ScoreBreakdown;
  reasoning: string;
};
export type ValidationTelemetry = {
  acceptedRecommendations: number;
  rejectedRecommendations: number;
  rejectionReasons: Record<string, number>;
};

type HiringManagerAssessmentInput = {
  recruiterSummary?: unknown;
  topReasonsToInterview?: unknown;
  topReasonsForRejection?: unknown;
  biggestImprovements?: unknown;
};

const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i;
const URL_PATTERN = /(?:https?:\/\/|www\.)\S+/i;
const METRIC_PATTERN = /\b\d+(?:\.\d+)?%?\b/g;
const UNSUPPORTED_METRIC_PLACEHOLDER = /\[\s*x\s*\]\s*(?:%|users?|components?|requests?)/i;
const COMMON_CAPITALIZED_WORDS = new Set([
  'A', 'An', 'And', 'At', 'By', 'Created', 'Delivered', 'Designed', 'Developed', 'For', 'In', 'Implemented',
  'Led', 'Managed', 'On', 'Optimized', 'The', 'To', 'With', 'Using', 'Built', 'Improved', 'Reduced',
  'Engineered', 'Architected', 'Spearheaded', 'Orchestrated', 'Authored', 'Pioneered', 'Analyzed',
  'Negotiated', 'Launched', 'Founded', 'Established', 'Formulated', 'Executed', 'Directed',
  'Wrote', 'Did'
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
const GENERIC_JOB_WORDS = new Set(['about', 'and', 'candidate', 'company', 'description', 'experience', 'for', 'from', 'have', 'job', 'role', 'skills', 'the', 'this', 'with', 'work', 'your']);

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
  
  const firstWordMatch = value.match(/^[•\-\*·\s]*([A-Z][A-Za-z0-9+#.-]*)\b/);
  const firstWord = firstWordMatch ? firstWordMatch[1] : null;

  return terms.some((term) => {
    if (term === firstWord) return false;
    return !COMMON_CAPITALIZED_WORDS.has(term) && !source.includes(term.toLowerCase());
  });
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

/** Formatting/polish advice must still explain why it matters for this job. */
function isJobSpecificFormattingRecommendation(value: string, resumeText: string, jobDescription: string): boolean {
  if (candidateMissingJobRequirement(value, resumeText, jobDescription)) return true;
  const recommendationTerms = new Set((value.toLowerCase().match(/[a-z0-9+#]+/g) || []).filter((word) => word.length >= 3));
  const jobTerms = new Set((jobDescription.toLowerCase().match(/[a-z0-9+#]+/g) || [])
    .filter((word) => word.length >= 3 && !GENERIC_JOB_WORDS.has(word)));
  const resumeTerms = sourceWords(resumeText);
  const mentionsJobEvidence = [...recommendationTerms].some((word) => jobTerms.has(word));
  const mentionsResumeEvidence = [...recommendationTerms].some((word) => resumeTerms.has(word))
    || /\b(?:summary|experience|projects?|skills?|education|certifications?|section|bullet)\b/i.test(value);
  return mentionsJobEvidence && mentionsResumeEvidence;
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
  const fields = ['atsIssues', 'improvementSuggestions', 'formattingIssues', 'formattingSuggestions', 'optimizationRecommendations'];
  const formattingFields = new Set(['formattingIssues', 'formattingSuggestions', 'optimizationRecommendations']);
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
      if (formattingFields.has(field) && !isJobSpecificFormattingRecommendation(text, resumeText, jobDescription)) {
        if (telemetry) {
          telemetry.rejectedRecommendations += 1;
          telemetry.rejectionReasons.not_job_specific = (telemetry.rejectionReasons.not_job_specific || 0) + 1;
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

const COACHING_REPORT_CATEGORIES = new Set([
  'Summary', 'Experience', 'Projects', 'Skills', 'Education', 'ATS Formatting',
  'Keyword Usage', 'Technical Depth', 'Action Verbs', 'Quantification',
  'Missing Evidence', 'Job Alignment',
]);

/** Validates the categorized coaching report with the same evidence rules as all recommendations. */
function validateCoachingReport(
  output: Record<string, any>,
  resumeText: string,
  jobDescription: string,
  telemetry?: ValidationTelemetry,
): void {
  const seen = new Set<string>();
  const sections = Array.isArray(output.coachingReport) ? output.coachingReport : [];
  output.coachingReport = sections.flatMap((section: unknown) => {
    if (!section || typeof section !== 'object') return [];
    const candidate = section as Record<string, unknown>;
    const category = typeof candidate.category === 'string' ? candidate.category.trim() : '';
    if (!COACHING_REPORT_CATEGORIES.has(category)) return [];
    const recommendations = (Array.isArray(candidate.recommendations) ? candidate.recommendations : [])
      .filter((value: unknown) => {
        const text = recommendationText(value);
        const key = normalize(text);
        const valid = isGroundedRecommendation(text, resumeText, jobDescription)
          && isJobSpecificFormattingRecommendation(text, resumeText, jobDescription)
          && !seen.has(key);
        if (!valid && telemetry) {
          telemetry.rejectedRecommendations += 1;
          const reason = seen.has(key) ? 'duplicate' : recommendationRejectionReason(text, resumeText, jobDescription);
          telemetry.rejectionReasons[reason] = (telemetry.rejectionReasons[reason] || 0) + 1;
        }
        if (valid) {
          seen.add(key);
          if (telemetry) telemetry.acceptedRecommendations += 1;
        }
        return valid;
      })
      .slice(0, 3);
    return recommendations.length ? [{ category, recommendations }] : [];
  });
}

/** Assessment claims may cite either resume evidence or a documented job requirement. */
function isGroundedAssessmentStatement(value: string, resumeText: string, jobDescription: string): boolean {
  if (!value || hasSensitiveContent(value) || hasInventedMetric(value, resumeText)) return false;
  if (hasInventedNamedTerm(value, `${resumeText}\n${jobDescription}`)) return false;
  const terms = (value.toLowerCase().match(/[a-z0-9]+/g) || []).filter((word) => word.length >= 3);
  const resumeTerms = sourceWords(resumeText);
  const jobTerms = sourceWords(jobDescription);
  return terms.some((term) => resumeTerms.has(term)) || terms.some((term) => jobTerms.has(term));
}

/** Keeps the new assessment grounded without mixing it into recommendation planning. */
export function validateHiringManagerAssessment(
  raw: unknown,
  resumeText: string,
  jobDescription: string,
): {
  recruiterSummary: string;
  topReasonsToInterview: string[];
  topReasonsForRejection: string[];
  biggestImprovements: string[];
} {
  const value = raw && typeof raw === 'object' ? raw as HiringManagerAssessmentInput : {};
  const cleanText = (input: unknown, limit: number) => Array.isArray(input)
    ? input
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter((item) => isGroundedAssessmentStatement(item, resumeText, jobDescription))
      .filter((item, index, items) => !items.slice(0, index).some((existing) => isSemanticDuplicate(item, existing)))
      .slice(0, limit)
    : [];
  const summary = typeof value.recruiterSummary === 'string' && isGroundedAssessmentStatement(value.recruiterSummary.trim(), resumeText, jobDescription)
    ? value.recruiterSummary.trim()
    : '';
  return {
    recruiterSummary: summary,
    topReasonsToInterview: cleanText(value.topReasonsToInterview, 5),
    topReasonsForRejection: cleanText(value.topReasonsForRejection, 5),
    biggestImprovements: cleanText(value.biggestImprovements, 5),
  };
}

function hasUnsupportedGroundingClaims(before: string, after: string, resumeText: string): boolean {
  const normResume = resumeText.toLowerCase();
  const normBefore = before.toLowerCase();
  const normAfter = after.toLowerCase();

  const checks = [
    { pattern: /\b(?:improving|improved|improve)\b/i, roots: ['improv'] },
    { pattern: /\b(?:increasing|increased|increase)\b/i, roots: ['increas'] },
    { pattern: /\b(?:driving|drove|driven|drive)\b/i, roots: ['driv'] },
    { pattern: /\b(?:leading|led|lead)\b/i, roots: ['lead', 'led'] },
    { pattern: /\b(?:uncovering|uncovered|uncover)\b/i, roots: ['uncover'] },
    { pattern: /\b(?:proving|proved|prove)\b/i, roots: ['prov'] },
    { pattern: /\b(?:demonstrating\s+expertise|demonstrated\s+expertise|showcasing\s+expertise|showcased\s+expertise)\b/i, roots: ['expertise'] },
  ];

  for (const check of checks) {
    if (check.pattern.test(normAfter)) {
      // If it's already in the original bullet, it is explicitly supported.
      if (check.pattern.test(normBefore)) continue;
      if (check.roots.some(r => r === 'lead' || r === 'led') && /\b(?:led|leading|lead)\b/i.test(normBefore)) continue;

      // Otherwise, the resume text must explicitly support at least one of the roots.
      const hasSupportInResume = check.roots.some(r => {
        if (r === 'led') return /\bled\b/i.test(normResume);
        return normResume.includes(r);
      });

      if (!hasSupportInResume) {
        return true; // Unsupported claim detected!
      }
    }
  }
  return false;
}

export function validateRewrites(
  values: unknown, 
  resumeText: string, 
  targetKeywords: string[], 
  bulletContexts: { text: string; sourceContext: string }[] = []
): RewritePair[] {
  if (!Array.isArray(values)) return [];
  const source = normalize(resumeText);
  const accepted: RewritePair[] = [];

  for (const value of values) {
    if (!value || typeof value !== 'object') continue;
    const pair = value as Record<string, unknown>;
    const before = typeof pair.before === 'string' ? pair.before.trim() : '';
    let after = typeof pair.after === 'string' ? pair.after.trim() : '';
    if (!before || !source.includes(normalize(before))) continue;
    if (!after) after = before;
    if (hasSensitiveContent(before) || hasSensitiveContent(after)) continue;
    
    // Locate the specific experience block for this bullet
    const bulletCtx = bulletContexts.find(b => {
      const txt = typeof b === 'string' ? b : (b && typeof b === 'object' && 'text' in b ? String(b.text) : '');
      return normalize(txt) === normalize(before);
    });
    const validationContextText = typeof bulletCtx === 'string' 
      ? resumeText 
      : (bulletCtx ? bulletCtx.sourceContext : resumeText);

    // We check for hallucinated metrics against the specific context (employer/role) text.
    // Named technical terms MUST also be supported by the specific context text or the original bullet itself.
    const hasInvented = hasInventedMetric(after, validationContextText) || UNSUPPORTED_METRIC_PLACEHOLDER.test(after) || hasInventedNamedTerm(after, validationContextText) || hasInventedNamedTerm(after, before);
    const hasUnsupportedClaim = hasUnsupportedGroundingClaims(before, after, validationContextText);
    const beforeQuality = scoreBulletQuality(before, targetKeywords);
    const afterQuality = scoreBulletQuality(after, targetKeywords);
    
    const improvementScore = afterQuality.total - beforeQuality.total;
    
    if (accepted.some((item) => normalize(String(item.before)) === normalize(before))) continue;
    
    const rawConfidence = typeof pair.confidence === 'string' ? pair.confidence : 'High';
    const confidence = (['High', 'Medium', 'Low'].includes(rawConfidence) ? rawConfidence : 'High') as 'High' | 'Medium' | 'Low';
    
    let finalAfter = after;
    let finalAfterQuality = afterQuality;
    let finalImprovementScore = improvementScore;
    let finalConfidence = confidence;

    const rawInferenceType = typeof pair.inferenceType === 'string' ? pair.inferenceType : 'STRONGLY_SUPPORTED_INFERENCE';
    const inferenceType = (['EXPLICITLY_STATED', 'STRONGLY_SUPPORTED_INFERENCE', 'UNSUPPORTED'].includes(rawInferenceType) ? rawInferenceType : 'STRONGLY_SUPPORTED_INFERENCE') as 'EXPLICITLY_STATED' | 'STRONGLY_SUPPORTED_INFERENCE' | 'UNSUPPORTED';
    
    let isFallback = false;

    if (improvementScore <= 0 || hasInvented || hasUnsupportedClaim || normalize(before) === normalize(after) || inferenceType === 'UNSUPPORTED') {
      finalAfter = before;
      finalAfterQuality = beforeQuality;
      finalImprovementScore = 0;
      if (hasInvented || hasUnsupportedClaim || inferenceType === 'UNSUPPORTED') {
        finalConfidence = 'Low';
      }
      isFallback = true;
    }

    let reasoning = generateReasoning(beforeQuality, finalAfterQuality);

    if (isFallback) {
      reasoning = 'Original bullet preserved. Improvement attempted but required inventing unsupported facts or yielded no significant gain.';
    }

    const whyItIsWeak = typeof pair.whyItIsWeak === 'string' ? pair.whyItIsWeak.trim() : '';
    const whatInformationIsMissing = typeof pair.whatInformationIsMissing === 'string' ? pair.whatInformationIsMissing.trim() : '';
    const whyThisIsStronger = typeof pair.whyThisIsStronger === 'string' ? pair.whyThisIsStronger.trim() : '';

    accepted.push({
      before,
      beforeScore: beforeQuality.total,
      after: finalAfter,
      afterScore: finalAfterQuality.total,
      improvementScore: finalImprovementScore,
      groundingConfidence: finalConfidence,
      whyItIsWeak: isFallback ? '' : whyItIsWeak,
      whatInformationIsMissing: isFallback ? '' : whatInformationIsMissing,
      whyThisIsStronger: isFallback ? '' : whyThisIsStronger,
      beforeScoreBreakdown: beforeQuality.breakdown,
      afterScoreBreakdown: finalAfterQuality.breakdown,
      scoreBreakdown: finalAfterQuality.breakdown,
      reasoning,
    });
  }



  // Sort by improvement score descending, so unchanged bullets drop to the bottom
  return accepted.sort((a, b) => b.improvementScore - a.improvementScore);
}

/** Validates untrusted LLM resume-analysis output without changing its public schema. */
export function validateAiResumeOutput(
  raw: Record<string, any>,
  resumeText: string,
  jobDescription = '',
  telemetry?: ValidationTelemetry,
  targetKeywords: string[] = [],
  bulletContexts: { text: string; sourceContext: string }[] = [],
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
  output.improvedBulletPoints = validateRewrites(output.improvedBulletPoints, resumeText, targetKeywords, bulletContexts);
  output.weakBullets = Array.isArray(output.weakBullets)
    ? output.weakBullets.filter((value: unknown) => typeof value === 'string' && normalize(resumeText).includes(normalize(value)))
    : [];
  validateRecommendationGroups(output, resumeText, jobDescription, telemetry);
  validateCoachingReport(output, resumeText, jobDescription, telemetry);
  return output;
}
