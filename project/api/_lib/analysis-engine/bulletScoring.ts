export type BulletQuality = {
  total: number;
  actionVerb: number;
  keywordRichness: number;
  measurableImpact: number;
  sentenceClarity: number;
  ownershipStructure: number;
};

export const STRONG_BULLET_ACTION_VERBS = new Set([
  'accelerated', 'achieved', 'analyzed', 'architected', 'assembled', 'automated', 'built',
  'coordinated', 'created', 'delivered', 'designed', 'developed', 'engineered', 'fabricated',
  'implemented', 'improved', 'integrated', 'led', 'managed', 'optimized', 'presented',
  'produced', 'reduced', 'streamlined', 'tested', 'validated',
]);

export const GENERIC_BULLET_OPENERS = new Set([
  'assisted', 'helped', 'participated', 'responsible', 'supported', 'worked',
]);

export function firstWord(text: string) {
  return text.trim().match(/[A-Za-z]+/)?.[0]?.toLowerCase() || '';
}

export function hasQuantification(text: string) {
  return /(?:\b\d+(?:\.\d+)?(?:%|x)?\b|\[x\]\s*(?:%|users|components|requests))/i.test(text);
}

export function containsTerm(text: string, term: string) {
  const escaped = term.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?=$|[^a-z0-9])`, 'i').test(text);
}

export function supportsTargetKeyword(text: string, keyword: string): boolean {
  if (containsTerm(text, keyword)) return true;
  const normalized = text.toLowerCase();
  const target = keyword.toLowerCase();
  if (target === 'control systems') return /\bpid\b|\bcontrol(?:ler)?\b/.test(normalized);
  if (target === 'sensor integration') return /\bsensor|lidar\b/.test(normalized) && /\binterface|interfacing|integrat/.test(normalized);
  return false;
}

export function scoreBulletQuality(text: string, targetKeywords: string[]): BulletQuality {
  const words = text.trim().match(/[A-Za-z0-9+#]+/g) || [];
  const opener = firstWord(text);
  const actionVerb = STRONG_BULLET_ACTION_VERBS.has(opener) ? 30 : GENERIC_BULLET_OPENERS.has(opener) ? 5 : 15;
  const keywordRichness = Math.min(25, [...new Set(targetKeywords.map((term) => term.trim()).filter(Boolean))]
    .filter((term) => supportsTargetKeyword(text, term)).length * 8.5);
  const measurableImpact = hasQuantification(text) ? (text.includes('[X]') || text.includes('[x]') ? 12 : 20) : 0;
  const sentenceClarity = words.length >= 12 && words.length <= 42 ? 15 : words.length >= 7 && words.length <= 55 ? 8 : 4;
  const ownershipStructure = STRONG_BULLET_ACTION_VERBS.has(opener)
    && words.length >= 10
    ? 10
    : 0;
  const total = Math.round(actionVerb + keywordRichness + measurableImpact + sentenceClarity + ownershipStructure);
  return { total, actionVerb, keywordRichness, measurableImpact, sentenceClarity, ownershipStructure };
}

export function bulletQualityImprovements(before: BulletQuality, after: BulletQuality) {
  const improvements = [
    [after.actionVerb > before.actionVerb, 'Stronger action verb'],
    [after.keywordRichness > before.keywordRichness, 'Better ATS keywords for this role'],
    [after.measurableImpact > before.measurableImpact, 'More measurable impact'],
    [after.sentenceClarity > before.sentenceClarity, 'Clearer sentence structure'],
    [after.ownershipStructure > before.ownershipStructure, 'Clearer ownership and contribution structure'],
  ] as const;
  return improvements.filter(([improved]) => improved).map(([, label]) => label);
}

export function buildDetailedBulletTeachingGuide(
  pair: { before: string; after: string },
  targetKeywords: string[],
) {
  const { before, after } = pair;
  const targetTerms = targetKeywords.filter((term) => containsTerm(after, term) && !containsTerm(before, term));
  const purpose = after.match(/\bto\s+([^.;]+)/i)?.[1]?.trim();
  const genericOpening = GENERIC_BULLET_OPENERS.has(firstWord(before));

  const whyWeak = [
    genericOpening
      ? `Opens with “${firstWord(before)},” which does not clearly show ownership of the work.`
      : `Does not clearly connect the documented work to a specific professional objective.`,
    targetTerms.length > 0
      ? 'This bullet does not name the specific tools, technologies, or methodologies involved.'
      : 'Uses generic phrasing but gives limited context about how skills were applied.',
    hasQuantification(before)
      ? 'This bullet does not clearly explain the purpose or practical result of the work.'
      : 'This bullet does not state a supported outcome, scope, or measurable result.',
  ];

  const missingInformation = [
    targetTerms.length
      ? `Detected in the source bullet: ${targetTerms.slice(0, 3).join(', ')}.`
      : 'Not explicitly stated in this bullet: tools, technologies, or methodologies used. Check other resume sections before treating this as missing.',
    purpose
      ? `Detected professional objective: ${purpose}.`
      : 'Not explicitly stated in this bullet: the professional purpose. Do not assume it is missing from the rest of the resume.',
    hasQuantification(before)
      ? 'Detected: a clear link between the documented work and its practical outcome.'
      : 'Unsupported in this bullet: a metric, test result, scope, or performance outcome. Add one only if documented elsewhere.',
  ];

  const whyStronger = [
    `Makes ownership explicit with the action “${firstWord(after).replace(/^./, (letter) => letter.toUpperCase())}.”`,
    targetTerms.length
      ? `Adds resume-supported professional context: ${targetTerms.slice(0, 3).join(', ')}.`
      : 'Makes the documented work easier for a recruiter to understand.',
    purpose
      ? `Clarifies the professional objective: ${purpose}.`
      : 'Uses a clearer action-to-contribution structure without adding unsupported results.',
    targetTerms.length
      ? `Improves alignment with this role through supported job terminology: ${targetTerms.slice(0, 2).join(', ')}.`
      : `Makes the documented work easier to evaluate against this role's stated requirements without adding unsupported job terminology.`,
  ];
  return { whyWeak, missingInformation, whyStronger };
}
