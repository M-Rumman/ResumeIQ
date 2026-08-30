import type { AiResumeAnalysisFull } from '../openrouter.js';
import type { JobProfile, CandidateProfile, RequirementMatch, CandidateFact, MatchClassification } from './types.js';
import { isValidEvidenceForCategory } from './matcher.js';
import {
  extractDateRangeString,
  parseDateRange,
  calculateIntervalsDurationYears,
  isRoleRelevantToRequirement,
  isInternshipOrAcademicRole,
  isSeniorRole,
  isJuniorRole
} from './resumeExtraction.js';

function cleanWord(w: string): string {
  return w.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
}

const GENERIC_WORDS = new Set([
  'research', 'user', 'users', 'test', 'testing', 'design', 'stakeholder', 'stakeholders',
  'experience', 'work', 'worked', 'help', 'helped', 'note', 'notes', 'session', 'sessions',
  'interview', 'interviews', 'conduct', 'conducted', 'usability', 'team', 'finding', 'findings',
  'with', 'about', 'from', 'that', 'this', 'have', 'having', 'other', 'another', 'role',
  'job', 'skills', 'skill', 'ability', 'abilities', 'strong', 'excellent', 'good', 'years', 'responsibilities'
]);

function getNonGenericWords(text: string): Set<string> {
  const words = text.toLowerCase().split(/\s+/);
  const result = new Set<string>();
  for (const w of words) {
    const cleaned = cleanWord(w);
    if (cleaned.length > 3 && !GENERIC_WORDS.has(cleaned)) {
      result.add(cleaned);
    }
  }
  return result;
}
function getCommunicationLevel(text: string): { level: 1 | 2 | 3 | null, name: string } {
  const clean = text.toLowerCase();
  
  // LEVEL 3 — Executive/strategic communication
  const hasLevel3 = /vp|c-suite|executive|board|senior\s+leadership|roadmap|product\s+strategy|strategic\s+decision|drive\s+strategic|influence\s+roadmap|influence\s+strategy/i.test(clean);
  if (hasLevel3) {
    return { level: 3, name: 'Level 3 (Executive/strategic communication)' };
  }
  
  // LEVEL 2 — Strong stakeholder communication
  const hasLevel2 = /present|recommendation|narrative|cross-functional|decision|influence\s+feature|pick\s+feature|actionable/i.test(clean);
  if (hasLevel2) {
    return { level: 2, name: 'Level 2 (Strong stakeholder communication)' };
  }
  
  // LEVEL 1 — Basic communication
  const hasLevel1 = /share|communicate|collaborate|write\s+up|tell|talk|work\s+with/i.test(clean);
  if (hasLevel1) {
    return { level: 1, name: 'Level 1 (Basic communication)' };
  }
  
  return { level: null, name: 'No communication evidence' };
}

const SEMANTIC_EQUIVALENTS: Array<{ reqKeywords: string[], evidenceKeywords: string[] }> = [
  {
    reqKeywords: ['qualitative'],
    evidenceKeywords: ['interview', 'interviews', 'usability', 'survey', 'surveys', 'diary', 'focus', 'group', 'groups', 'card', 'sorting']
  },
  {
    reqKeywords: ['quantitative'],
    evidenceKeywords: ['survey', 'surveys', 'analytics', 'statistics', 'a/b', 'experiment', 'experiments', 'nps', 'csat', 'quantitative']
  },
  {
    reqKeywords: ['repository', 'repositories'],
    evidenceKeywords: ['repository', 'repositories', 'database', 'library', 'sharepoint', 'confluence', 'drive', 'notion', 'centralized']
  },
  {
    reqKeywords: ['stakeholder', 'communication', 'storytelling'],
    evidenceKeywords: ['present', 'presented', 'presentation', 'presentations', 'share', 'shared', 'communicate', 'communicated', 'report', 'reports', 'narrative', 'narratives', 'story', 'stories']
  },
  {
    reqKeywords: ['mentor', 'mentoring', 'coach', 'coaching'],
    evidenceKeywords: ['mentor', 'mentored', 'coach', 'coached', 'lead', 'led', 'guide', 'guided', 'teach', 'taught', 'train', 'trained', 'onboard', 'onboarded']
  },
  {
    reqKeywords: ['senior leadership', 'leadership', 'executive', 'c-suite', 'vp', 'strategic', 'strategy', 'roadmap'],
    evidenceKeywords: ['vp', 'c-suite', 'executive', 'board', 'leadership', 'senior', 'strategy', 'strategic', 'roadmap', 'present', 'presented', 'presentation']
  }
];

export function applyStrictGroundingRules(
  match: RequirementMatch,
  validatedEvidence: any[],
  candidateFacts: CandidateFact[]
): { classification: MatchClassification; explanation: string; validatedEvidence: any[] } {
  let classification = match.classification;
  let explanation = match.explanation;

  if (classification !== 'EXACT_MATCH' && classification !== 'STRONG_SEMANTIC_MATCH' && classification !== 'PARTIAL_MATCH') {
    return { classification, explanation, validatedEvidence };
  }

  const reqNameLower = match.requirement.normalized_name.toLowerCase();
  const reqTextLower = (match.requirement.original_text || '').toLowerCase();
  const combinedEvidenceText = validatedEvidence.map(e => e.source_text).join(' ').toLowerCase();

  // Location Work Mode Check (Case 1)
  if (match.requirement.category === 'location') {
    const hasHybrid = reqTextLower.includes('hybrid') || reqNameLower.includes('hybrid');
    const hasOnsite = reqTextLower.includes('onsite') || reqTextLower.includes('on-site') || reqNameLower.includes('onsite') || reqNameLower.includes('on-site');
    const hasRemote = reqTextLower.includes('remote') || reqNameLower.includes('remote');
    
    if (hasHybrid || hasOnsite || hasRemote) {
      const evidenceHasHybrid = combinedEvidenceText.includes('hybrid');
      const evidenceHasOnsite = combinedEvidenceText.includes('onsite') || combinedEvidenceText.includes('on-site') || /days\s+onsite|days\s+on-site/i.test(combinedEvidenceText);
      const evidenceHasRemote = combinedEvidenceText.includes('remote');
      
      let modeSatisfied = false;
      if (hasHybrid && evidenceHasHybrid) modeSatisfied = true;
      if (hasOnsite && evidenceHasOnsite) modeSatisfied = true;
      if (hasRemote && evidenceHasRemote) modeSatisfied = true;
      
      if (!modeSatisfied) {
        classification = 'PARTIAL_MATCH';
        explanation = `The candidate's location matches, but the resume does not establish availability for the required hybrid/onsite schedule. Do not add this unless factually accurate.`;
        return { classification, explanation, validatedEvidence };
      }
    }
  }

  // Seniority Validation (Case 2)
  const isSeniorRoleReq = (match.requirement.category === 'seniority' || match.requirement.category === 'experience' || (match.requirement.category as string) === 'role' || match.requirement.category === 'hard skill') &&
    (/(^|\b)senior\b/i.test(reqNameLower) || /(^|\b)senior\b/i.test(reqTextLower) || /(^|\b)sr\b/i.test(reqNameLower) || /(^|\b)sr\b/i.test(reqTextLower) || /(^|\b)lead\b/i.test(reqNameLower) || /(^|\b)lead\b/i.test(reqTextLower));
  if (isSeniorRoleReq) {
    const hasSeniorityEvidence = 
      isSeniorRole(combinedEvidenceText) ||
      candidateFacts.some(f => (f.type === 'experience' || f.type === 'project' || f.type === 'other') && isSeniorRole(f.rawText));
      
    if (!hasSeniorityEvidence) {
      classification = 'PARTIAL_MATCH';
      explanation = `Downgraded: Candidate has UX research experience but the resume does not demonstrate seniority or senior-level responsibilities (such as leadership, mentoring, or strategic ownership).`;
      return { classification, explanation, validatedEvidence };
    }
  }

  // Experience Duration Check (Case 3)
  const matchMinYears = (reqTextLower + ' ' + reqNameLower).match(/\b(\d+)(?:\+)?\s*(?:years?|yrs?)\b/i) ||
                        (reqTextLower + ' ' + reqNameLower).match(/\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b(?:\+|\s+plus)?\s*(?:years?|yrs?)\b/i);
  const WORD_TO_NUM: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 };
  const parsedMinYears = matchMinYears ? (matchMinYears[1] && /^\d+$/.test(matchMinYears[1]) ? parseInt(matchMinYears[1], 10) : WORD_TO_NUM[matchMinYears[1].toLowerCase()] || 0) : 0;
  const reqMinYears = match.requirement.minimum_years || parsedMinYears;

  if (reqMinYears > 0) {
    const intervalsWithInternship: Array<{ start: Date, end: Date }> = [];
    const intervalsWithoutInternship: Array<{ start: Date, end: Date }> = [];
    let hasAmbiguous = false;
    let yearRanges: number[] = [];

    const experienceFacts = candidateFacts.filter(f => f.type === 'experience');
    
    for (const fact of experienceFacts) {
      const factText = fact.rawText;
      
      if (!isRoleRelevantToRequirement(factText, match.requirement.normalized_name)) {
        continue;
      }
      
      const dateStr = extractDateRangeString(factText);
      if (!dateStr) {
        hasAmbiguous = true;
        continue;
      }
      
      const parsedRange = parseDateRange(dateStr);
      if (!parsedRange) {
        hasAmbiguous = true;
        continue;
      }
      
      if (parsedRange.isAmbiguous) {
        hasAmbiguous = true;
      }
      
      const isIntern = isInternshipOrAcademicRole(factText);
      
      intervalsWithInternship.push({ start: parsedRange.start, end: parsedRange.end });
      if (!isIntern) {
        intervalsWithoutInternship.push({ start: parsedRange.start, end: parsedRange.end });
        yearRanges.push(parsedRange.start.getFullYear());
        yearRanges.push(parsedRange.end.getFullYear());
      }
    }
    
    const yearsWith = calculateIntervalsDurationYears(intervalsWithInternship);
    const yearsWithout = calculateIntervalsDurationYears(intervalsWithoutInternship);
    
    const roundedWith = Math.round(yearsWith * 10) / 10;
    const roundedWithout = Math.round(yearsWithout * 10) / 10;
    
    const minYearInRoles = yearRanges.length > 0 ? Math.min(...yearRanges) : null;
    const maxYearInRoles = yearRanges.length > 0 ? Math.max(...yearRanges) : null;
    const hasInternship = intervalsWithInternship.length > intervalsWithoutInternship.length;
    
    let basisExplanation = '';
    if (roundedWith === 0 && roundedWithout === 0) {
      if (experienceFacts.length > 0) {
        classification = 'ANALYSIS_FAILED';
        explanation = `Analysis Failed: Unable to determine experience duration due to missing or ambiguous dates on relevant roles.`;
        return { classification, explanation, validatedEvidence: [] };
      }
      classification = 'MISSING';
      explanation = `Missing: No relevant research experience found in the resume.`;
      return { classification, explanation, validatedEvidence: [] };
    }
    
    const startStr = minYearInRoles ? String(minYearInRoles) : 'unknown';
    const endStr = maxYearInRoles === new Date().getFullYear() ? 'present' : maxYearInRoles ? String(maxYearInRoles) : 'present';

    if (hasInternship && roundedWith !== roundedWithout) {
      basisExplanation = `Approximately ${roundedWithout} years of relevant professional research experience based on roles from ${startStr} to ${endStr} (or approximately ${roundedWith} years including internship experience).`;
    } else {
      basisExplanation = `Approximately ${roundedWithout} years of relevant professional research experience based on roles from ${startStr} to ${endStr}.`;
    }
    
    if (hasAmbiguous) {
      basisExplanation += ` (Some dates were ambiguous or incomplete).`;
    }
    
    const primaryYears = roundedWithout;
    if (primaryYears >= reqMinYears) {
      classification = 'EXACT_MATCH';
      explanation = `${basisExplanation}`;
    } else if (roundedWith >= reqMinYears) {
      classification = 'PARTIAL_MATCH';
      explanation = `Downgraded: Candidate meets the requirement only when including internship experience. ${basisExplanation}`;
    } else {
      classification = primaryYears < 1 ? 'MISSING' : 'PARTIAL_MATCH';
      explanation = `Downgraded: Candidate has only ${primaryYears} years of relevant experience, which is less than the required ${reqMinYears}+ years. ${basisExplanation}`;
      if (classification === 'MISSING') {
        return { classification, explanation, validatedEvidence: [] };
      }
    }
    
    return { classification, explanation, validatedEvidence };
  }

  // Education Field Verification (Case 4)
  if (match.requirement.category === 'education') {
    const reqFields = match.requirement.fields || [];
    if (reqFields.length === 0) {
      if (/psychology/i.test(reqTextLower)) reqFields.push('psychology');
      if (/hci|human-computer interaction/i.test(reqTextLower)) {
        reqFields.push('hci');
        reqFields.push('human-computer interaction');
        reqFields.push('human computer interaction');
      }
      if (/cognitive science/i.test(reqTextLower)) reqFields.push('cognitive science');
      if (/social science|sociology|anthropology/i.test(reqTextLower)) reqFields.push('social science');
      if (/computer science/i.test(reqTextLower)) reqFields.push('computer science');
    }

    if (reqFields.length > 0) {
      const eduFacts = candidateFacts.filter(f => f.type === 'education');
      if (eduFacts.length > 0) {
        let hasExactField = false;
        let hasAdjacentField = false;
        let candidateFields: string[] = [];

        for (const fact of eduFacts) {
          const factRaw = fact.rawText.toLowerCase();
          const factFields = fact.fields || [];
          
          if (factFields.length > 0) {
            candidateFields.push(...factFields.map(f => f.toLowerCase()));
          } else {
            const majorMatch = factRaw.match(/in\s+([a-zA-Z\s\-]+)/i);
            if (majorMatch && majorMatch[1]) {
              candidateFields.push(majorMatch[1].trim().toLowerCase());
            }
          }
        }

        candidateFields = candidateFields.map(f => f.trim()).filter(Boolean);

        const adjacentKeywords = [
          'computer science', 'cs', 'informatics', 'information science',
          'sociology', 'anthropology', 'social science', 'human factors',
          'ux', 'user experience', 'design', 'interaction design',
          'communications', 'communication', 'engineering', 'systems engineering'
        ];

        const isHci = (x: string) => /hci|human-computer interaction|human computer interaction/i.test(x);

        for (const cf of candidateFields) {
          if (reqFields.some(rf => cf.includes(rf.toLowerCase()) || rf.toLowerCase().includes(cf) || (isHci(rf) && isHci(cf)))) {
            hasExactField = true;
          }
          if (adjacentKeywords.some(ak => cf.includes(ak) || ak.includes(cf))) {
            hasAdjacentField = true;
          }
        }

        const matchedLabel = candidateFields.map(cf => cf.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')).join(', ');
        
        const reqLabels = reqFields.map(rf => {
          if (rf === 'hci') return 'HCI';
          return rf.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        }).join('/');

        if (hasExactField) {
          classification = 'EXACT_MATCH';
          explanation = `The candidate has a degree in ${matchedLabel}, which is one of the explicitly requested disciplines.`;
          return { classification, explanation, validatedEvidence };
        } else if (hasAdjacentField) {
          classification = 'PARTIAL_MATCH';
          explanation = `The candidate has a degree in ${matchedLabel}. This is adjacent to UX research/user behavior but is not one of the explicitly requested ${reqLabels} disciplines.`;
          return { classification, explanation, validatedEvidence };
        } else {
          classification = 'MISSING';
          explanation = `Missing: Candidate has a degree in ${matchedLabel || 'unknown field'}, which is unrelated to the requested fields (${reqLabels}).`;
          return { classification, explanation, validatedEvidence: [] };
        }
      }
    }
  }

  // Rule 4: Composite / Multiple Components (Case A: Behavioral Analytics + Qualitative)
  const isBehavioralAnalyticsReq = /behavioral.*analytics|product.*analytics|analytics.*data|clickstream|triangulat/i.test(reqNameLower) || /behavioral.*analytics|product.*analytics|analytics.*data|clickstream|triangulat/i.test(reqTextLower);
  if (isBehavioralAnalyticsReq) {
    const hasAnalyticsEvidence = /analytics|data science|clickstream|triangulat|mixed.method|quantitative|statistics|metrics/i.test(combinedEvidenceText);
    const hasQualitativeEvidence = /qualitative|interview|usability|survey|diary|focus/i.test(combinedEvidenceText);
    if (!hasAnalyticsEvidence) {
      classification = hasQualitativeEvidence ? 'PARTIAL_MATCH' : 'MISSING';
      explanation = `Downgraded: Evidence lacks product/behavioral analytics, data science partnership, or triangulation components.`;
      return { classification, explanation, validatedEvidence: classification === 'MISSING' ? [] : validatedEvidence };
    }
  }

  // Rule 5: Research at scale (Case B)
  const isScaleReq = /research at scale|scale|operations/i.test(reqNameLower) || /research at scale|scale|operations/i.test(reqTextLower);
  if (isScaleReq) {
    const hasStrongScaleEvidence = /panel|repositor|ops\b|operations\b|thousand|centralized|central\s+repository|\d{2,}\+|scale|hundred/i.test(combinedEvidenceText);
    
    if (!hasStrongScaleEvidence) {
      classification = 'MISSING';
      explanation = `Missing: Evidence is only generic research activity and lacks concrete indicators of research at scale (such as participant panels, research repositories, scale metrics, or research operations).`;
      return { classification, explanation, validatedEvidence: [] };
    }
  }

  // Rule 6: Stakeholder communication and storytelling (Case C)
  const isSeniorCommReq = /senior leadership|executive|c-suite|vp|product strategy|strategic influence/i.test(reqNameLower) || /senior leadership|executive|c-suite|vp|product strategy|strategic influence/i.test(reqTextLower);
  const isGeneralCommReq = /communication|storytelling|presentation|presenting|narrative|stakeholder/i.test(reqNameLower) || /communication|storytelling|presentation|presenting|narrative|stakeholder/i.test(reqTextLower);
  
  if (isSeniorCommReq || isGeneralCommReq) {
    const { level, name } = getCommunicationLevel(combinedEvidenceText);
    
    if (level === null) {
      classification = 'MISSING';
      explanation = `Missing: Evidence lacks stakeholder communication or storytelling.`;
      return { classification, explanation, validatedEvidence: [] };
    }
    
    if (isSeniorCommReq) {
      if (level < 3) {
        classification = 'PARTIAL_MATCH';
        explanation = `Downgraded: Requirement demands senior leadership or strategic influence. Candidate evidence demonstrates ${name} only.`;
        return { classification, explanation, validatedEvidence };
      }
    } else if (isGeneralCommReq) {
      if (level < 2) {
        classification = 'PARTIAL_MATCH';
        explanation = `Downgraded: Requirement demands strong stakeholder storytelling or presentation. Candidate evidence demonstrates ${name} only.`;
        return { classification, explanation, validatedEvidence };
      }
    }
  }

  // Rule 4: Mentoring (Case D)
  const isMentoringReq = /mentor|coach|guide.*junior|mentoring/i.test(reqNameLower) || /mentor|coach|guide.*junior|mentoring/i.test(reqTextLower);
  if (isMentoringReq) {
    const hasMentoringEvidence = /mentor|coach|guide|onboard|teach|train|instruct/i.test(combinedEvidenceText);
    if (!hasMentoringEvidence) {
      classification = 'MISSING';
      explanation = `Missing: Evidence lacks mentoring, coaching, or leading other researchers.`;
      return { classification, explanation, validatedEvidence: [] };
    }
  }

  // Rule 7 & 8: Recruiter Verification (Generic words check)
  const reqWords = getNonGenericWords(reqNameLower + ' ' + reqTextLower);
  const evidenceWords = getNonGenericWords(combinedEvidenceText);

  let directOverlapCount = 0;
  for (const rw of reqWords) {
    if (evidenceWords.has(rw)) {
      directOverlapCount++;
    }
  }

  let hasEquivalent = false;
  for (const eq of SEMANTIC_EQUIVALENTS) {
    const hasReqKeyword = eq.reqKeywords.some(rk => reqNameLower.includes(rk) || reqTextLower.includes(rk));
    const hasEvidenceKeyword = eq.evidenceKeywords.some(ek => combinedEvidenceText.includes(ek));
    if (hasReqKeyword && hasEvidenceKeyword) {
      hasEquivalent = true;
      break;
    }
  }

  if (directOverlapCount === 0 && !hasEquivalent) {
    classification = 'MISSING';
    explanation = `Rejected Match: Evidence is too generic and does not reasonably prove the requirement to a recruiter.`;
    return { classification, explanation, validatedEvidence: [] };
  }

  // General Compound Requirement Rule
  const origText = match.requirement.original_text || match.requirement.normalized_name;
  if (origText.includes(' and ')) {
    const parts = origText.split(/\s+and\s+/i);
    if (parts.length === 2) {
      const leftWords = getNonGenericWords(parts[0]);
      const rightWords = getNonGenericWords(parts[1]);
      
      if (leftWords.size > 0 && rightWords.size > 0) {
        const evidenceLower = combinedEvidenceText.toLowerCase();
        
        let hasLeft = false;
        let hasRight = false;
        
        for (const lw of leftWords) {
          const stem = lw.replace(/s$/, '');
          if (evidenceLower.includes(lw) || (stem.length > 2 && evidenceLower.includes(stem))) hasLeft = true;
        }
        for (const rw of rightWords) {
          const stem = rw.replace(/s$/, '');
          if (evidenceLower.includes(rw) || (stem.length > 2 && evidenceLower.includes(stem))) hasRight = true;
        }
        
        for (const eq of SEMANTIC_EQUIVALENTS) {
          const hasLeftEquiv = eq.reqKeywords.some(rk => parts[0].toLowerCase().includes(rk)) && eq.evidenceKeywords.some(ek => evidenceLower.includes(ek));
          const hasRightEquiv = eq.reqKeywords.some(rk => parts[1].toLowerCase().includes(rk)) && eq.evidenceKeywords.some(ek => evidenceLower.includes(ek));
          if (hasLeftEquiv) hasLeft = true;
          if (hasRightEquiv) hasRight = true;
        }
        
        if (!hasLeft || !hasRight) {
          classification = 'PARTIAL_MATCH';
          explanation = `Downgraded: Compound requirement has multiple parts, but the evidence only demonstrates satisfaction of one component (${!hasLeft ? 'lacks first part' : 'lacks second part'}).`;
          return { classification, explanation, validatedEvidence };
        }
      }
    }
  }

  return { classification, explanation, validatedEvidence };
}

export function validateEvidenceAttribution(
  matches: RequirementMatch[],
  candidateFacts: CandidateFact[],
  resumeText: string
): RequirementMatch[] {
  const resumeTextLower = resumeText.toLowerCase().replace(/\s+/g, ' ');

  return matches.map(match => {
    if (!match.evidence || match.evidence.length === 0) {
      return match;
    }

    const validatedEvidence = match.evidence.filter(ev => {
      // 1. Existence Check
      if (!ev.source_text || !ev.fact_id) return false;

      // 2. Fact ID Consistency
      const fact = candidateFacts.find(f => f.id === ev.fact_id);
      if (!fact) return false;

      // 3. Category Validity
      if (!isValidEvidenceForCategory(ev.evidence_type, match.requirement.category)) return false;

      // 4. Provenance (Resume Grounding)
      const evTextLower = ev.source_text.toLowerCase().trim();
      const factTextLower = fact.rawText.toLowerCase().trim();
      
      const isExactFactMatch = evTextLower === factTextLower;
      const isSubtringInResume = resumeTextLower.includes(evTextLower.replace(/\s+/g, ' '));
      
      if (!isExactFactMatch && !isSubtringInResume) {
        return false;
      }

      return true;
    });

    if (validatedEvidence.length === 0 && match.classification !== 'MISSING' && match.classification !== 'ANALYSIS_FAILED') {
      if (match.match_tier === 'tier_1_deterministic') {
        return {
          ...match,
          evidence: [],
          explanation: `${match.explanation} (Note: Evidence validation unavailable)`
        };
      }
      return {
        ...match,
        evidence: [],
        classification: 'ANALYSIS_FAILED',
        confidence: 0,
        explanation: `${match.explanation} (Note: Evidence validation failed. System could not confidently establish valid evidence for this requirement.)`
      };
    }

    const strictResult = applyStrictGroundingRules(match, validatedEvidence, candidateFacts);
    return {
      ...match,
      classification: strictResult.classification,
      explanation: strictResult.explanation,
      evidence: strictResult.validatedEvidence
    };
  });
}

export function validateAndSanitizeReport(
  report: AiResumeAnalysisFull,
  jobProfile: JobProfile,
  candidateProfile: CandidateProfile
): AiResumeAnalysisFull {
  // 1. Requirement Provenance Check
  // Gather all valid requirement names extracted strictly from the JD.
  const validRequirements = new Set(jobProfile.requirements.map(req => req.normalized_name));

  const stripHallucinations = (arr: string[]) => arr.filter(skill => validRequirements.has(skill));

  report.missingSkills = stripHallucinations(report.missingSkills);
  report.existingSkills = stripHallucinations(report.existingSkills);
  report.missingKeywords = stripHallucinations(report.missingKeywords);
  report.keywordGaps = stripHallucinations(report.keywordGaps);
  report.missingRequiredSkills = stripHallucinations(report.missingRequiredSkills);
  report.keywordSuggestions = stripHallucinations(report.keywordSuggestions);
  
  if (report.jobMatchExplanation) {
    const stripHallucinatedObjects = (arr: any[]) => arr.filter(item => validRequirements.has(item.requirement));
    report.jobMatchExplanation.strongMatches = stripHallucinatedObjects(report.jobMatchExplanation.strongMatches);
    report.jobMatchExplanation.partialMatches = stripHallucinatedObjects(report.jobMatchExplanation.partialMatches);
    report.jobMatchExplanation.missingSkills = stripHallucinatedObjects(report.jobMatchExplanation.missingSkills);
  }

  if (report.keywordCompatibility) {
    report.keywordCompatibility.exactMatches = stripHallucinations(report.keywordCompatibility.exactMatches || []);
    report.keywordCompatibility.semanticMatches = stripHallucinations(report.keywordCompatibility.semanticMatches || []);
    report.keywordCompatibility.underExpressed = stripHallucinations(report.keywordCompatibility.underExpressed || []);
    report.keywordCompatibility.missing = stripHallucinations(report.keywordCompatibility.missing || []);
  }

  // 2. Recommendation Grounding Check
  // Ensures no recommendation tells a user to blindly add a skill without a warning.
  const warningClauses = ['only add this if accurate', 'never invent', 'only if accurate'];

  const enforceWarning = (suggestion: string) => {
    const lower = suggestion.toLowerCase();
    const hasWarning = warningClauses.some(clause => lower.includes(clause));
    if (!hasWarning) {
      return `${suggestion}\n**Note**: Only add this if accurate and supported by your actual experience.`;
    }
    return suggestion;
  };

  report.improvementSuggestions = report.improvementSuggestions.map(enforceWarning);
  report.optimizationRecommendations = report.optimizationRecommendations.map(enforceWarning);

  if (report.recommendationPriorities) {
    report.recommendationPriorities.critical = report.recommendationPriorities.critical.map(enforceWarning);
    report.recommendationPriorities.important = report.recommendationPriorities.important.map(enforceWarning);
    report.recommendationPriorities.optional = report.recommendationPriorities.optional.map(enforceWarning);
  }

  if (report.actionPlan) {
    report.actionPlan = report.actionPlan.map(gap => {
      const lower = gap.fabricationWarning.toLowerCase();
      const hasWarning = warningClauses.some(clause => lower.includes(clause));
      if (!hasWarning) {
        return {
          ...gap,
          fabricationWarning: `${gap.fabricationWarning} Only add this if accurate and supported by your actual experience.`
        };
      }
      return gap;
    });
  }

  // 3. Duplicate Validation
  const dedupe = (arr: string[]) => Array.from(new Set(arr));
  
  report.missingSkills = dedupe(report.missingSkills);
  report.existingSkills = dedupe(report.existingSkills);
  report.missingKeywords = dedupe(report.missingKeywords);
  report.keywordGaps = dedupe(report.keywordGaps);
  report.missingRequiredSkills = dedupe(report.missingRequiredSkills);
  report.keywordSuggestions = dedupe(report.keywordSuggestions);

  if (report.jobMatchExplanation) {
    const dedupeObjects = (arr: any[]) => {
      const seen = new Set();
      return arr.filter(item => {
        if (seen.has(item.requirement)) return false;
        seen.add(item.requirement);
        return true;
      });
    };
    report.jobMatchExplanation.strongMatches = dedupeObjects(report.jobMatchExplanation.strongMatches);
    report.jobMatchExplanation.partialMatches = dedupeObjects(report.jobMatchExplanation.partialMatches);
    report.jobMatchExplanation.missingSkills = dedupeObjects(report.jobMatchExplanation.missingSkills);
  }

  if (report.keywordCompatibility) {
    report.keywordCompatibility.exactMatches = dedupe(report.keywordCompatibility.exactMatches);
    report.keywordCompatibility.semanticMatches = dedupe(report.keywordCompatibility.semanticMatches);
    report.keywordCompatibility.underExpressed = dedupe(report.keywordCompatibility.underExpressed);
    report.keywordCompatibility.missing = dedupe(report.keywordCompatibility.missing);
  }

  // 4. Score Reconciliations
  if (report.atsBreakdown && report.atsBreakdown.length > 0) {
    const calculatedSum = report.atsBreakdown.reduce((sum, item) => sum + item.score, 0);
    report.atsScore = Math.max(0, Math.min(100, calculatedSum));
  }

  // 5. Interview Probability Removal
  // Replaces the hallucinated probability generated by match models.
  if (report.hiringManagerAssessment) {
    delete report.hiringManagerAssessment.estimatedInterviewProbability;
  }

  // 6. Circular/Internal Property Cleanup
  // Remove temporary properties prefixed with an underscore (like _fallbackMatch)
  // to avoid circular JSON serialization errors during API response serialization.
  removeInternalProperties(report);

  return report;
}

function removeInternalProperties(obj: any, visited = new Set<any>()): void {
  if (!obj || typeof obj !== 'object') return;
  if (visited.has(obj)) return;
  visited.add(obj);

  if (Array.isArray(obj)) {
    for (const item of obj) {
      removeInternalProperties(item, visited);
    }
  } else {
    for (const key of Object.keys(obj)) {
      if (key.startsWith('_')) {
        delete obj[key];
      } else {
        removeInternalProperties(obj[key], visited);
      }
    }
  }
}

