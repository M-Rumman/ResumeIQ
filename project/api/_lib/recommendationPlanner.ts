type Confidence = 'High' | 'Medium' | 'Low';

type RecommendationValue = string | { text?: unknown; confidence?: unknown };

const RECOMMENDATION_FIELDS = [
  'atsIssues',
  'improvementSuggestions',
  'formattingIssues',
  'formattingSuggestions',
  'optimizationRecommendations',
] as const;

const NON_EVIDENCE_WORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'that', 'this', 'your', 'into', 'onto', 'about', 'within', 'using',
]);

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function words(value: string): Set<string> {
  return new Set(
    normalize(value).split(' ').filter((word) => word.length > 2 && !NON_EVIDENCE_WORDS.has(word)),
  );
}

function evidenceWord(word: string): string {
  if (word.length > 4 && word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  if (word.length > 4 && word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
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
  const resumeEvidenceWords = new Set([...resumeWords].map(evidenceWord));
  const overlap = [...recommendationWords].filter(
    (word) => resumeWords.has(word) || resumeEvidenceWords.has(evidenceWord(word)),
  ).length;
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

type RecommendationPriorityGroups = {
  critical: string[];
  important: string[];
  optional: string[];
};

function addPriorityItem(
  groups: RecommendationPriorityGroups,
  priority: keyof RecommendationPriorityGroups,
  value: unknown,
): void {
  const text = textOf(value as RecommendationValue);
  if (!text) return;
  const allItems = [...groups.critical, ...groups.important, ...groups.optional];
  if (allItems.some((existing) => semanticallySimilar(text, existing))) return;
  groups[priority].push(text);
}

/**
 * Creates an additive, API-safe priority view from already validated and
 * deduplicated output. Flat legacy fields remain unchanged for the current UI.
 */
function prioritizeRecommendations(output: Record<string, any>): RecommendationPriorityGroups {
  const groups: RecommendationPriorityGroups = { critical: [], important: [], optional: [] };
  const addAll = (priority: keyof RecommendationPriorityGroups, values: unknown) => {
    if (!Array.isArray(values)) return;
    for (const value of values) addPriorityItem(groups, priority, value);
  };

  // Critical: failed ATS/required-skill checks and resume content that blocks
  // a recruiter from evaluating work experience clearly.
  addAll('critical', output.atsIssues);
  addAll('critical', (Array.isArray(output.missingRequiredSkills) ? output.missingRequiredSkills : [])
    .map((skill: unknown) => typeof skill === 'string' ? `Missing required job skill: ${skill}` : ''));
  addAll('critical', (Array.isArray(output.weakBullets) ? output.weakBullets : [])
    .map((bullet: unknown) => typeof bullet === 'string' ? `Weak bullet: ${bullet}` : ''));
  addAll('critical', (Array.isArray(output.formattingIssues) ? output.formattingIssues : [])
    .filter((issue: unknown) => /\b(experience|employment|work history|date|chronolog)/i.test(textOf(issue as RecommendationValue))));
  addAll('critical', (Array.isArray(output.missingSections) ? output.missingSections : [])
    .filter((section: unknown) => /^(experience|work experience|professional experience)$/i.test(String(section || '')))
    .map((section: unknown) => `Missing resume section: ${section}`));

  // Important: job alignment and substantive changes to the candidate's
  // summary, projects, skills, and overall section organization.
  addAll('important', output.improvementSuggestions);
  addAll('important', output.missingKeywords);
  addAll('important', output.keywordSuggestions);
  addAll('important', output.keywordGaps);
  addAll('important', output.missingSkills);
  addAll('important', (Array.isArray(output.formattingIssues) ? output.formattingIssues : [])
    .filter((issue: unknown) => !/\b(experience|employment|work history|date|chronolog)/i.test(textOf(issue as RecommendationValue))));
  addAll('important', (Array.isArray(output.missingSections) ? output.missingSections : [])
    .filter((section: unknown) => !/^(experience|work experience|professional experience)$/i.test(String(section || '')))
    .map((section: unknown) => `Missing resume section: ${section}`));

  // Optional: polish after substantive alignment issues have been addressed.
  addAll('optional', output.formattingSuggestions);
  addAll('optional', output.optimizationRecommendations);

  return groups;
}

/**
 * Plans one resume recommendation per observation across ATS, format, and improvement sections.
 * Weak bullets are reserved for the bullet-rewrite section whenever a rewrite exists.
 */
export function planResumeRecommendations(
  raw: Record<string, any>,
  resumeText: string,
  gapAnalysis?: { items?: { skill?: unknown; status?: unknown }[] },
): Record<string, any> {
  const output = { ...raw };
  const seen: string[] = [];

  // The deterministic gap stage is the source of truth for required skills
  // absent from the resume. Retain the existing field/API shape while making
  // those gaps available to every downstream recommendation decision.
  const missingFromGap = Array.isArray(gapAnalysis?.items)
    ? gapAnalysis.items
      .filter((item) => item?.status === 'MISSING' && typeof item.skill === 'string')
      .map((item) => String(item.skill).trim())
      .filter(Boolean)
    : [];
  output.missingRequiredSkills = [
    ...(Array.isArray(output.missingRequiredSkills) ? output.missingRequiredSkills : []),
    ...missingFromGap,
  ];

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
  output.recommendationPriorities = prioritizeRecommendations(output);
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
