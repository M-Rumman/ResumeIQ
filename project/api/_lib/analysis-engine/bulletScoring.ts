export type ScoreBreakdown = {
  relevance: number;
  specificity: number;
  impact: number;
  action: number;
  clarity: number;
  evidence: number;
};

export type BulletScore = {
  total: number;
  breakdown: ScoreBreakdown;
};

export const FLUFF_WORDS = new Set([
  'spearheaded', 'leveraged', 'synergized', 'revolutionized', 'skyrocketed', 'maximized', 'drove', 'championed', 'pioneered', 'supercharged', 'utilized'
]);

export const WEAK_VERBS = new Set([
  'worked', 'helped', 'assisted', 'participated', 'involved', 'responsible', 'did', 'made', 'used', 'handled', 'supported', 'contributed', 'run', 'ran'
]);

export const STRONG_VERBS = new Set([
  'led', 'built', 'conducted', 'designed', 'managed', 'created', 'established', 'presented', 'developed',
  'directed', 'engineered', 'architected', 'orchestrated', 'authored', 'implemented', 'optimized',
  'reduced', 'increased', 'delivered', 'analyzed', 'negotiated', 'launched', 'founded', 'formulated',
  'executed', 'mentored', 'partnered', 'synthesized', 'coordinated', 'migrated'
]);

const STOP_WORDS = new Set([
  'and', 'or', 'of', 'to', 'in', 'with', 'a', 'the', 'for', 'on', 'at', 'by', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'but', 'if', 'then', 'else', 'as', 'into', 'from', 'about', 'through', 'during', 'before', 'after', 'above', 'below', 'under', 'over', 'again', 'further', 'then', 'once'
]);

const IMPACT_KEYWORDS = new Set([
  'reducing', 'increasing', 'improving', 'optimizing', 'cutting', 'influencing', 'shaping', 'shaped',
  'influenced', 'optimized', 'reduced', 'increased', 'improved', 'saved', 'saving', 'growth', 'revenue',
  'adoption', 'performance', 'trust', 'satisfaction', 'efficiency', 'speed', 'scale', 'uptime', 'adopted',
  'delivered', 'achieved', 'launched', 'established'
]);

const IMPACT_PHRASES = [
  'resulting in', 'leading to', 'led to', 'in order to', 'to resolve', 'to improve', 'to increase',
  'to reduce', 'to optimize', 'company-wide', 'directly influencing'
];

export function firstWord(text: string) {
  const words = text.trim().toLowerCase().split(/\s+/).map(w => w.replace(/[^a-z]/g, ''));
  const adverbs = new Set(['regularly', 'successfully', 'consistently', 'actively', 'effectively', 'efficiently']);
  for (const w of words) {
    if (adverbs.has(w)) continue;
    if (w) return w;
  }
  return '';
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
  if (target === 'ux research' || target === 'qualitative and quantitative research methods' || target === 'ux research experience' || target === '6+ years of ux research experience') {
    return /\busability\b|\binterview\b|\bsurvey\b|\bpersona\b|\bjourney\b|\bdiary\b|\bresearch\b/.test(normalized);
  }
  if (target === 'research operations' || target === 'research at scale' || target === 'participant panel') {
    return /\brepository\b|\bpanel\b|\brecruit\b/.test(normalized);
  }
  if (target === 'stakeholder communication' || target === 'present findings to senior leadership') {
    return /\bpresent\b|\bstakeholder\b|\bc-suite\b|\bvp\b|\bleadership\b/.test(normalized);
  }
  return false;
}

const COMMON_DOMAIN_WORDS = new Set(['research', 'experience', 'development', 'engineering', 'skills', 'management', 'work', 'role', 'team', 'project', 'process']);

function matchesKeyword(text: string, keyword: string): boolean {
  if (supportsTargetKeyword(text, keyword)) return true;
  const normalizedText = text.toLowerCase();
  const normalizedKeyword = keyword.toLowerCase();
  if (normalizedText.includes(normalizedKeyword) || normalizedKeyword.includes(normalizedText)) {
    return true;
  }
  
  const words = normalizedKeyword.split(/\s+/).map(w => w.replace(/[^a-z0-9+#.-]/g, '')).filter(w => w.length >= 2 && !STOP_WORDS.has(w));
  if (words.length > 0) {
    const hasNonDomainWord = words.some(w => !COMMON_DOMAIN_WORDS.has(w));
    for (const w of words) {
      if (w.length < 2) continue;
      if (hasNonDomainWord && COMMON_DOMAIN_WORDS.has(w)) continue;
      const escaped = w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(?:^|[^a-z0-9+#.-])${escaped}(?=$|[^a-z0-9+#.-])`, 'i');
      if (regex.test(normalizedText)) {
        return true;
      }
    }
  }
  return false;
}

export function hasGenericPhrasing(text: string): boolean {
  const normalized = text.toLowerCase();
  
  if (/\bfindings\b/.test(normalized)) {
    if (!/\b(?:research|user|usability|qualitative|quantitative|key|actionable|survey|test|testing)\s+findings\b/.test(normalized)) {
      return true;
    }
  }
  
  if (/\bpersonas\b/.test(normalized)) {
    if (!/\b(?:user|customer|target|buyer|audience|archetype|proto)\s+personas\b/.test(normalized)) {
      return true;
    }
  }

  if (/\busers\b/.test(normalized)) {
    if (!/\b(?:active|target|end|new|existing|mobile|desktop|app|registered|daily|monthly|external|internal)\s+users\b/.test(normalized)) {
      return true;
    }
  }

  if (/\binterviews\b/.test(normalized)) {
    if (!/\b(?:user|customer|stakeholder|in-depth|contextual|qualitative|depth)\s+interviews\b/.test(normalized)) {
      return true;
    }
  }

  if (/\btesting\b/.test(normalized)) {
    if (!/\b(?:usability|user|moderated|unmoderated|a\/b|beta|concept|hallway|automated|manual)\s+testing\b/.test(normalized)) {
      return true;
    }
  }

  if (/\bfeedback\b/.test(normalized)) {
    if (!/\b(?:user|customer|stakeholder|qualitative|direct|client)\s+feedback\b/.test(normalized)) {
      return true;
    }
  }

  if (/\b(?:designs|wireframes|prototypes)\b/.test(normalized)) {
    if (!/\b(?:ux|ui|product|interaction|high-fidelity|mobile|web|interactive|low-fidelity)\s+(?:designs|wireframes|prototypes)\b/.test(normalized)) {
      return true;
    }
  }

  return false;
}

export function scoreBulletQuality(text: string, targetKeywords?: string[]): BulletScore {
  const words = text.trim().split(/\s+/);
  const wordCount = words.length;

  // 1. RELEVANCE (20 points)
  let relevance = 12;
  if (!targetKeywords || targetKeywords.length === 0) {
    const hasVerb = STRONG_VERBS.has(firstWord(text));
    if (hasVerb || wordCount >= 12) {
      relevance = 18;
    }
  } else {
    let matchedCount = 0;
    for (const kw of targetKeywords) {
      if (matchesKeyword(text, kw)) {
        matchedCount++;
      }
    }
    if (matchedCount >= 2) {
      relevance = 20;
    } else if (matchedCount === 1) {
      relevance = 17;
    } else {
      const specificTerms = words.filter(w => /^[A-Z]{2,}/.test(w) || /^[a-z]+[A-Z][a-z]+/.test(w) || /\d/.test(w)).length;
      if (wordCount >= 10 || specificTerms > 0) {
        relevance = 12;
      } else if (wordCount >= 6) {
        relevance = 8;
      } else {
        relevance = 4;
      }
    }
  }
  if (text.length < 3) relevance = 0;

  // 2. SPECIFICITY (15 points)
  let specificity = 5;
  let specificTermsShared = 0;
  if (/\[\s*x\s*\]/i.test(text)) {
    specificity = 0;
  } else {
    // Specificity evaluates clear activity/method/scope
    // Count specific terms: capitalized words (not first word), numbers, hyphenated words
    let specificTerms = 0;
    for (let i = 1; i < words.length; i++) {
      const w = words[i];
      if (/^[A-Z]/.test(w) && !/^[A-Z]+$/.test(words[i-1])) {
        specificTerms++;
      } else if (/\d/.test(w)) {
        specificTerms++;
      } else if (w.includes('-')) {
        specificTerms++;
      }
    }
    const COMMON_SPECIFICITY_EXCLUSIONS = new Set([
      'supported', 'conducting', 'moderated', 'management', 'experience', 'financial', 'personal', 'habits', 'regularly', 'presented', 'findings', 'directly', 'quarterly', 'product', 'strategy', 'usability', 'testing', 'interviews', 'research'
    ]);
    const longWords = words.filter(w => {
      const clean = w.toLowerCase().replace(/[^a-z]/g, '');
      return clean.length >= 8 && !COMMON_SPECIFICITY_EXCLUSIONS.has(clean);
    }).length;
    specificTerms += longWords;
    specificTermsShared = specificTerms;

    if (wordCount >= 15 && specificTerms >= 4) {
      specificity = 15;
    } else if (wordCount >= 12 && specificTerms >= 3) {
      specificity = 13;
    } else if (wordCount >= 9 && specificTerms >= 2) {
      specificity = 11;
    } else if (wordCount >= 7 && specificTerms >= 1) {
      specificity = 8;
    } else if (wordCount >= 5) {
      specificity = 5;
    } else {
      specificity = 2;
    }

    if (hasGenericPhrasing(text) && specificTerms < 3) {
      specificity = Math.min(8, specificity);
    }
  }
  if (text.length < 3) specificity = 0;

  // 3. IMPACT / OUTCOME (20 points)
  let impact = 4;
  if (hasQuantification(text)) {
    impact = 20;
  } else {
    const textLower = text.toLowerCase();
    let hasPhrase = false;
    for (const ph of IMPACT_PHRASES) {
      if (textLower.includes(ph)) {
        hasPhrase = true;
        break;
      }
    }
    let keywordCount = 0;
    for (const word of words) {
      const cleanWord = word.toLowerCase().replace(/[^a-z]/g, '');
      if (IMPACT_KEYWORDS.has(cleanWord)) {
        keywordCount++;
      }
    }

    if (hasPhrase || keywordCount >= 2) {
      impact = 17;
    } else if (keywordCount === 1) {
      impact = 12;
    } else {
      const first = firstWord(text);
      if (STRONG_VERBS.has(first)) {
        impact = 9;
      } else if (wordCount >= 8) {
        impact = 6;
      }
    }
  }
  if (text.length < 3) impact = 0;

  // 4. ACTION / OWNERSHIP (15 points)
  let action = 5;
  const first = firstWord(text);
  if (WEAK_VERBS.has(first)) {
    const cleanWords = words.map(w => w.toLowerCase().replace(/[^a-z]/g, ''));
    const hasStrongVerbLater = cleanWords.some(w => STRONG_VERBS.has(w));
    if (hasStrongVerbLater) {
      action = 8;
    } else {
      action = 6;
    }
  } else if (STRONG_VERBS.has(first)) {
    const cleanWords = words.map(w => w.toLowerCase().replace(/[^a-z]/g, ''));
    const hasWeakModifier = cleanWords.some(w => WEAK_VERBS.has(w));
    if (hasWeakModifier) {
      action = 11;
    } else {
      action = 15;
    }
  } else if (first && first.endsWith('ed')) {
    action = 13;
  } else if (wordCount >= 5) {
    action = 7;
  } else {
    action = 2;
  }
  if (text.length < 3) action = 0;

  // 5. CLARITY & CONCISENESS (15 points)
  let clarity = 15;
  if (wordCount > 35) clarity -= 3;
  if (wordCount > 45) clarity -= 2;
  if (wordCount < 8) clarity -= 3;
  if (wordCount < 5) clarity -= 2;

  let fluffCount = 0;
  for (const w of words) {
    const cleanWord = w.toLowerCase().replace(/[^a-z]/g, '');
    if (FLUFF_WORDS.has(cleanWord)) {
      fluffCount++;
    }
  }
  clarity -= (fluffCount * 2);

  const commaCount = (text.match(/,/g) || []).length;
  if (commaCount > 3) clarity -= 1;

  if (hasGenericPhrasing(text) && specificTermsShared < 3) {
    clarity = Math.max(0, clarity - 3);
  }

  if (clarity < 0) clarity = 0;
  if (text.length < 3) clarity = 0;

  // 6. EVIDENCE / CREDIBILITY / GROUNDING (15 points)
  let evidence = 15;
  if (/\[\s*x\s*\]/i.test(text)) {
    evidence = 5;
  }
  if (text.length < 3) evidence = 0;

  const total = relevance + specificity + impact + action + clarity + evidence;

  return {
    total,
    breakdown: { relevance, specificity, impact, action, clarity, evidence }
  };
}

export function generateReasoning(beforeScore: BulletScore, afterScore: BulletScore, beforeText?: string, afterText?: string): string {
  if (beforeScore.total === afterScore.total) {
    if (beforeScore.total >= 80) return "Bullet is already strong across all dimensions.";
    return "The proposed changes do not meaningfully improve the core dimensions of the bullet without inventing information.";
  }
  
  const reasons: string[] = [];
  const bb = beforeScore.breakdown;
  const ab = afterScore.breakdown;

  if (ab.relevance > bb.relevance) reasons.push("better aligns with target role requirements");
  if (ab.specificity > bb.specificity) reasons.push("replaces generic descriptions with specific details");
  if (ab.impact > bb.impact) {
    const beforeHasMetric = beforeText ? hasQuantification(beforeText) : false;
    const afterHasMetric = afterText ? hasQuantification(afterText) : false;
    if (afterHasMetric && !beforeHasMetric) {
      reasons.push("highlights measurable impact");
    } else {
      reasons.push("strengthens qualitative impact or contribution framing");
    }
  }
  if (ab.action > bb.action) reasons.push("strengthens action and ownership framing");
  if (ab.clarity > bb.clarity) reasons.push("improves clarity and conciseness by removing fluff or optimizing length");
  if (ab.evidence > bb.evidence) reasons.push("strengthens grounding and credibility");

  if (reasons.length > 0) {
    return "Improvement " + reasons.join(", ") + ".";
  }

  return "Adjusts phrasing for readability.";
}

