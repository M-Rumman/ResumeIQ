import { CandidateFact, JobRequirement } from './api/_lib/analysis-engine/types.js';

export function scoreFactForRequirement(fact: CandidateFact, req: JobRequirement, baseClassification: string): number {
  let score = 0;
  const rawLower = fact.rawText.toLowerCase();
  const reqNameLower = req.normalized_name.toLowerCase();
  const factClean = fact.normalizedName.toLowerCase().replace(/[^a-z0-9]/g, '');
  const reqClean = reqNameLower.replace(/[^a-z0-9]/g, '');
  
  // 1. Fact/source section relevance & Experience-backed (Priority)
  const priorityMap: Record<string, number> = {
    'experience': 1, 'education': 2, 'project': 3, 'certification': 4,
    'other': 5, 'skill': 6, 'tool': 7, 'methodology': 8, 'language': 9
  };
  const basePriority = 10 - (priorityMap[fact.type] || 9);
  score += basePriority * 1000;

  // 2. Direct lexical / exact terminology
  if (baseClassification === 'EXACT_MATCH') score += 5000;
  if (factClean === reqClean || rawLower === reqNameLower) score += 2000;
  
  const rawLowerPadded = ' ' + rawLower.replace(/[.,;:()]/g, ' ') + ' ';
  if (rawLowerPadded.includes(` ${reqNameLower} `)) score += 1000;

  // 3. Quantified evidence
  if (/\b\d+\b/.test(rawLower)) {
    score += 500;
    // 5,000-person participant panel vs research operations best practices
    if ((reqNameLower.includes('scale') || reqNameLower.includes('research operations')) && /\b\d{4,}\b|\d+,\d{3}/.test(rawLower)) {
      score += 10000;
    }
    if ((reqNameLower.includes('mentor') || reqNameLower.includes('lead') || reqNameLower.includes('manage')) && /\b[1-9]\d?\b/.test(rawLower)) {
      score += 2000;
    }
  }

  // 4. Specificity / Responsibility over generic
  if (fact.type === 'experience' || fact.type === 'project') {
    if (rawLower.split(' ').length > 8) {
      score += 300;
    }
  }

  // 5. Requirement-category compatibility (e.g. Domain)
  if (req.category === 'domain') {
    if (fact.type === 'experience' || fact.type === 'other' || fact.type === 'project') {
      score += 2000;
    }
  }
  
  // Executive Presentation specific override
  if (reqNameLower.includes('executive') || reqNameLower.includes('stakeholder') || reqNameLower.includes('presentation') || reqNameLower.includes('leadership')) {
     if (rawLower.includes('c-suite') || rawLower.includes('vp') || rawLower.includes('executive') || rawLower.includes('director')) {
       score += 5000;
     }
     if (fact.type === 'experience') score += 1000;
  }

  return score;
}
