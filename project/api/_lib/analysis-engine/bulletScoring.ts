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
  const measurableImpact = hasQuantification(text) ? (text.includes('[X]') || text.includes('[x]') ? 12 : 20) : 0;
  const sentenceClarity = words.length >= 12 && words.length <= 42 ? 15 : words.length >= 7 && words.length <= 55 ? 8 : 4;
  const ownershipStructure = STRONG_BULLET_ACTION_VERBS.has(opener)
    && words.length >= 10
    ? 15
    : 0;

  const rawKeywordScore = [...new Set(targetKeywords.map((term) => term.trim()).filter(Boolean))]
    .filter((term) => supportsTargetKeyword(text, term)).length * 10;
  
  // Keyword richness is penalized if the bullet lacks a strong action verb or measurable impact (anti-stuffing).
  let keywordRichness = 0;
  if (actionVerb === 30 || measurableImpact > 0) {
    keywordRichness = Math.min(20, rawKeywordScore);
  } else {
    keywordRichness = Math.min(5, rawKeywordScore * 0.25);
  }

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
  const hasStrongActionVerb = STRONG_BULLET_ACTION_VERBS.has(firstWord(after));
  const beforeHasQuant = hasQuantification(before);

  const whyWeak: string[] = [];
  if (genericOpening) {
    whyWeak.push(`"${firstWord(before).replace(/^./, l => l.toUpperCase())}" communicates limited ownership.`);
  } else if (!STRONG_BULLET_ACTION_VERBS.has(firstWord(before))) {
    whyWeak.push(`The sentence structure is passive or uses a weak opening verb.`);
  }
  
  if (!beforeHasQuant) {
    whyWeak.push(`No documented outcome or measurable impact is stated in this bullet.`);
  }

  const missingInformation: string[] = [];
  if (targetTerms.length > 0) {
    missingInformation.push(`Check if you can add specific tools or methodologies to this bullet without inventing them.`);
  } else if (!beforeHasQuant) {
    missingInformation.push(`A metric, scope, or performance outcome is absent (only add if supported elsewhere in your resume).`);
  } else {
    missingInformation.push(`This bullet is factually complete based on your resume evidence.`);
  }

  const whyStronger: string[] = [];
  if (hasStrongActionVerb && !STRONG_BULLET_ACTION_VERBS.has(firstWord(before))) {
    whyStronger.push(`Uses the stronger action verb "${firstWord(after).replace(/^./, l => l.toUpperCase())}".`);
  }
  if (targetTerms.length > 0) {
    whyStronger.push(`Clarifies alignment with the target role through relevant terminology.`);
  }
  whyStronger.push(`Preserves all original facts without inventing outcomes.`);

  return { whyWeak, missingInformation, whyStronger };
}
