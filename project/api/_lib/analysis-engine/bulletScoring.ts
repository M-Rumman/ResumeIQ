export type ScoreBreakdown = {
  relevance: number;
  specificity: number;
  impact: number;
  clarity: number;
  action: number;
};

export type BulletScore = {
  total: number;
  breakdown: ScoreBreakdown;
};

export const FLUFF_WORDS = new Set([
  'spearheaded', 'leveraged', 'synergized', 'revolutionized', 'skyrocketed', 'maximized', 'drove', 'championed', 'pioneered', 'supercharged', 'utilized'
]);

export const WEAK_VERBS = new Set([
  'worked', 'helped', 'assisted', 'participated', 'involved', 'responsible', 'did', 'made', 'used', 'handled', 'supported', 'contributed'
]);

export const STRONG_VERBS = new Set([
  'directed', 'engineered', 'architected', 'orchestrated', 'authored', 'designed', 'developed', 'managed', 'led', 'implemented', 'optimized', 'reduced', 'increased', 'delivered', 'built', 'analyzed', 'negotiated', 'launched', 'founded', 'established', 'formulated', 'executed'
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

export function scoreBulletQuality(text: string, targetKeywords: string[]): BulletScore {
  const words = text.trim().split(/\s+/);
  const wordCount = words.length;

  let relevance = 5;
  const hasKeyword = targetKeywords.some(kw => supportsTargetKeyword(text, kw));
  if (hasKeyword) {
    relevance = 20;
  }

  let specificity = 5;
  if (/\[\s*x\s*\]/i.test(text)) {
    specificity = 0;
  } else {
    const specificTerms = words.filter(w => /^[A-Z]{2,}/.test(w) || /^[a-z]+[A-Z][a-z]+/.test(w) || /\d/.test(w)).length;
    if (specificTerms >= 3) specificity = 20;
    else if (specificTerms >= 1) specificity = 10;
  }

  let impact = 5;
  if (hasQuantification(text)) {
    impact = 20;
  }

  let clarity = 20;
  if (wordCount > 35) clarity -= 10;
  if (wordCount < 8) clarity -= 5;
  const fluffCount = words.filter(w => FLUFF_WORDS.has(w.toLowerCase().replace(/[^a-z]/g, ''))).length;
  clarity -= (fluffCount * 5);
  if (clarity < 0) clarity = 0;

  let action = 10;
  const first = firstWord(text);
  if (WEAK_VERBS.has(first)) {
    action = 5;
  } else if (STRONG_VERBS.has(first)) {
    action = 20;
  }

  const total = relevance + specificity + impact + clarity + action;

  return {
    total,
    breakdown: { relevance, specificity, impact, clarity, action }
  };
}

export function generateReasoning(beforeScore: BulletScore, afterScore: BulletScore): string {
  if (beforeScore.total === afterScore.total) {
    if (beforeScore.total >= 80) return "Bullet is already strong across all dimensions.";
    return "The proposed changes do not meaningfully improve the core dimensions of the bullet without inventing information.";
  }
  
  const reasons: string[] = [];
  const bb = beforeScore.breakdown;
  const ab = afterScore.breakdown;

  if (ab.relevance > bb.relevance) reasons.push("better aligns with target role requirements");
  if (ab.specificity > bb.specificity) reasons.push("replaces generic descriptions with specific details");
  if (ab.impact > bb.impact) reasons.push("highlights measurable impact");
  if (ab.clarity > bb.clarity) reasons.push("improves clarity and conciseness by removing fluff or optimizing length");
  if (ab.action > bb.action) reasons.push("strengthens action and ownership framing");

  if (reasons.length > 0) {
    return "Improvement " + reasons.join(", ") + ".";
  }

  return "Adjusts phrasing for readability.";
}
