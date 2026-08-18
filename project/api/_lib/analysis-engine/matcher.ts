import { callOpenRouter, extractJsonFromText } from '../openrouter.js';
import type { AiObservabilityContext } from '../aiObservability.js';
import type { CandidateProfile, JobProfile, MatchingResult, RequirementMatch, MatchClassification, CandidateFact, MatchEvidence } from './types.js';

const FACT_PRIORITY: Record<string, number> = {
  'experience': 1,
  'education': 2,
  'project': 3,
  'certification': 4,
  'other': 5, // usually summary
  'skill': 6,
  'tool': 7,
  'methodology': 8,
  'language': 9
};

export function isValidEvidenceForCategory(factType: string, category: string): boolean {
  if (category === 'education') {
    return factType === 'education';
  }
  if (category === 'location') {
    return factType === 'other' || factType === 'experience';
  }
  if (category === 'experience' || category === 'responsibility' || category === 'years' || category === 'seniority') {
    return factType === 'experience' || factType === 'project';
  }
  if (category === 'hard skill' || category === 'soft skill' || category === 'methodology' || category === 'tool' || category === 'domain') {
    return factType === 'skill' || factType === 'tool' || factType === 'methodology' || factType === 'experience' || factType === 'project' || factType === 'other';
  }
  return true;
}

const MATCHER_SYSTEM_PROMPT = `You are an expert technical recruiter and evidence evaluator.
Your job is to match multiple Job Requirements against Candidate Facts.

You will be given:
1. A list of requirements (ID, Name, Category, Original Text).
2. Prioritized Candidate Facts (ID, Type, Section, Text). 
   - Facts are ordered by evidence strength (Experience > Education > Projects > Skills).

CORE DIRECTIVE: COMPONENT-BASED EVALUATION
When evaluating a requirement, you MUST parse the \`Original Text\` to identify all of its logical components. Do not rely solely on the \`Name\`, as it may be a simplified summary.
For example, if Original Text is "Excellent stakeholder communication and storytelling skills":
  - Component 1: Stakeholder communication
  - Component 2: Storytelling skills

EVIDENCE AGGREGATION & RANKING RULES:
You MUST combine evidence from multiple facts across different sections (Summary, Experience, Skills, Education) to satisfy composite requirements.
Rank evidence in this exact order of priority:
1. Direct responsibility/task evidence (e.g., specific work history demonstrating the task).
2. Evidence that explicitly demonstrates the requirement's core capability.
3. Quantified/scaled evidence (e.g., numbers, team sizes, budgets, repository size).
4. Evidence with strong semantic alignment.
5. Skills-list evidence (only select this if experience/responsibility evidence is completely unavailable).

Classify the match for EACH requirement exactly into one of these states:
- EXACT_MATCH: The evidence fully and explicitly supports ALL core components of the Original Text WITH SUBSTANTIVE PROOF (e.g., demonstrated in experience or projects). A bare keyword in a skills list is NEVER an EXACT_MATCH.
- STRONG_SEMANTIC_MATCH: The evidence supports ALL core components of the Original Text, but relies on semantic equivalence rather than exact phrasing. Still requires substantive proof.
- PARTIAL_MATCH: The evidence explicitly supports AT LEAST ONE core component, but definitively lacks support for others (e.g., candidate has "stakeholder communication" but no evidence of "storytelling").
- RELATED_MATCH: The evidence is tangentially related to the requirement but does not explicitly support any core component.
- UNDER_EXPRESSED: The evidence implies the capability (e.g., bare keyword in a skills list), but is too vague or lacks demonstrated experience to qualify as a strong match.
- ANALYSIS_FAILED: You lack sufficient context or confidence to evaluate this requirement. Use sparingly.
- MISSING: There is no credible resume evidence supporting ANY core component of the requirement.

CRITICAL CATEGORY-AWARE RULES:
1. "location": Evaluate STRICTLY as a factual boolean. EXACT_MATCH if the candidate is in the location or meets hybrid/remote constraints. Do NOT demand "metrics" or "depth" for locations.
2. "years" / "seniority": Evaluate STRICTLY based on the required threshold compared to the duration in the candidate's facts.
3. "education" / "certification": Evaluate STRICTLY based on presence of the degree type and field. Do NOT demand "metrics".
4. "responsibility": Focus on whether the candidate performed the duty. Metrics enhance the match but are not strictly required for a STRONG_SEMANTIC_MATCH if the core duty is proven.
5. "ANALYSIS_FAILED": NEVER use MISSING if you simply do not understand the requirement. Use ANALYSIS_FAILED instead. MISSING means you are confident the candidate lacks it.

Output a JSON object containing a "matches" array. Each object in the array must have:
- requirementId: The exact ID string of the requirement.
- classification: One of EXACT_MATCH, STRONG_SEMANTIC_MATCH, PARTIAL_MATCH, RELATED_MATCH, UNDER_EXPRESSED, MISSING, ANALYSIS_FAILED.
- supportingFactIds: An array of exact ID strings of the Candidate Facts, or an empty array.
- explanation: A brief justification explaining how the core components were met or what was missing.

CRITICAL RULES:
- Never hallucinate facts. If there's truly no related evidence, output MISSING.
- If a JD requires a very specific tool (e.g., ROS, MATLAB) and there is absolutely no evidence, output MISSING.
- You may use logical deduction to assign UNDER_EXPRESSED if the evidence implies the capability, but if the evidence is direct and strong, classify as STRONG_SEMANTIC_MATCH even if terminology differs.
- "B.A." vs "Bachelor's degree" is an EXACT_MATCH or STRONG_SEMANTIC_MATCH.
- If a location matches but the work mode (e.g. remote, hybrid) is unverified in the resume, classify as EXACT_MATCH and note the missing mode in the explanation.
- For composite requirements (e.g., "Qualitative and quantitative research"): classify as EXACT_MATCH/STRONG_SEMANTIC_MATCH ONLY if BOTH components are satisfied. If only one is stated, you MUST classify as PARTIAL_MATCH.
`;

function getFallbackSemanticMatch(req: import('./types.js').JobRequirement, prioritizedFacts: CandidateFact[]): RequirementMatch | null {
  const reqWords = req.normalized_name.toLowerCase().split(/\s+/).filter(w => w.length > 4);
  if (reqWords.length === 0) return null;

  let bestFact: CandidateFact | null = null;
  let bestOverlap = 0;

  for (const fact of prioritizedFacts) {
    if (!isValidEvidenceForCategory(fact.type, req.category)) continue;

    const rawLower = fact.rawText.toLowerCase();
    let overlap = 0;
    for (const rw of reqWords) {
      if (rawLower.includes(rw)) {
        overlap++;
      }
    }
    const overlapPercent = overlap / reqWords.length;
    if (overlapPercent > bestOverlap) {
      bestOverlap = overlapPercent;
      bestFact = fact;
    }
  }

  if (bestFact && bestOverlap >= 0.5) {
    return {
      requirement: req,
      classification: bestOverlap >= 0.8 ? 'PARTIAL_MATCH' : 'UNDER_EXPRESSED',
      confidence: 0.5,
      explanation: `Semantic fallback: found ${Math.round(bestOverlap * 100)}% word overlap in candidate profile.`,
      match_tier: 'tier_3_semantic',
      evidence: [{
        source_section: bestFact.sourceSection,
        source_text: bestFact.rawText,
        fact_id: bestFact.id,
        relevance: 'semantic',
        evidence_strength: 'secondary',
        evidence_type: bestFact.type,
        evidence_tier: 'tier_3_semantic'
      }]
    };
  }
  return null;
}

export function scoreFactForRequirement(fact: CandidateFact, req: import('./types.js').JobRequirement, baseClassification: MatchClassification = 'EXACT_MATCH'): number {
  let score = 0;
  const rawLower = fact.rawText.toLowerCase();
  const reqNameLower = req.normalized_name.toLowerCase();
  const factClean = fact.normalizedName.toLowerCase().replace(/[^a-z0-9]/g, '');
  const reqClean = reqNameLower.replace(/[^a-z0-9]/g, '');
  
  let priorityModifier = 0;
  if (req.category === 'education' || req.category === 'certification') {
    if (fact.type === 'education' || fact.type === 'certification') priorityModifier = 10000;
    else priorityModifier = -5000;
  } else if (req.category === 'experience' || req.category === 'responsibility' || req.category === 'years' || req.category === 'seniority') {
    if (fact.type === 'experience' || fact.type === 'project') priorityModifier = 5000;
  } else if (req.category === 'location') {
    if (fact.type === 'other') priorityModifier = 5000;
  } else if (req.category === 'hard skill' || req.category === 'soft skill' || req.category === 'tool' || req.category === 'methodology') {
    if (fact.type === 'skill' || fact.type === 'tool' || fact.type === 'methodology') priorityModifier = 2000;
    if (fact.type === 'experience' || fact.type === 'project') priorityModifier = 4000;
  }

  const priorityScore = (10 - (FACT_PRIORITY[fact.type] || 9)) * 1000;
  score += priorityScore + priorityModifier;
  
  if (baseClassification === 'EXACT_MATCH') score += 5000;
  if (factClean === reqClean || rawLower === reqNameLower) score += 2000;
  
  const rawLowerPadded = ' ' + rawLower.replace(/[.,;:()]/g, ' ') + ' ';
  if (rawLowerPadded.includes(` ${reqNameLower} `)) score += 1000;

  if (/\b\d+\b/.test(rawLower)) {
    score += 500;
    // Don't match years (19xx, 20xx) as scale
    const hasScaleNumber = /\b(?:(?!(?:19|20)\d{2}\b)\d{4,}|\d+,\d{3})\b/.test(rawLower);
    if ((reqNameLower.includes('scale') || reqNameLower.includes('research operations')) && hasScaleNumber) {
      score += 10000;
    }
    if ((reqNameLower.includes('mentor') || reqNameLower.includes('lead') || reqNameLower.includes('manage')) && /\b[1-9]\d?\b/.test(rawLower)) {
      score += 2000;
    }
  }

  if (fact.type === 'experience' || fact.type === 'project') {
    if (rawLower.split(' ').length > 8) {
      score += 500; // Small tie-breaker for descriptive bullets over short headings
    }
  }

  if (req.category === 'domain') {
    if (fact.type === 'experience' || fact.type === 'other' || fact.type === 'project') {
      score += 2000;
    }
  }
  
  // Semantic Heuristics

  // Executive Presentations
  if (reqNameLower.includes('executive') || reqNameLower.includes('stakeholder') || reqNameLower.includes('presentation') || reqNameLower.includes('leadership')) {
     if (rawLower.includes('c-suite') || rawLower.includes('vp') || rawLower.includes('executive') || rawLower.includes('director') || rawLower.includes('board')) {
       score += 5000;
     }
     if (fact.type === 'experience') score += 1000;
  }

  // Mentoring
  if (reqNameLower.includes('mentor') || reqNameLower.includes('coach') || reqNameLower.includes('guide')) {
    if (rawLower.includes('mentor') || rawLower.includes('coach') || rawLower.includes('guide') || rawLower.includes('1:1') || rawLower.includes('onboard')) {
      score += 5000;
    }
  }

  // Data Science / Partnership
  if (reqNameLower.includes('data science') || reqNameLower.includes('partner') || reqNameLower.includes('collaborat')) {
    if (rawLower.includes('data science') || rawLower.includes('machine learning') || rawLower.includes('analytics') || rawLower.includes('partner') || rawLower.includes('collaborat')) {
      score += 5000;
    }
  }

  // Research Methods
  if (reqNameLower.includes('research') || reqNameLower.includes('method')) {
    if (rawLower.includes('interview') || rawLower.includes('usability') || rawLower.includes('survey') || rawLower.includes('diary stud') || rawLower.includes('a/b test')) {
      score += 5000;
    }
  }

  // Research Operations
  if (reqNameLower.includes('operation') || reqNameLower.includes('ops') || reqNameLower.includes('repositor') || reqNameLower.includes('panel')) {
    if (rawLower.includes('repositor') || rawLower.includes('panel') || rawLower.includes('participant') || rawLower.includes('recruit') || rawLower.includes('ops')) {
      score += 5000;
    }
  }
  
  const reqWords = reqNameLower.split(/\s+/).filter(w => w.length > 3);
  let wordMatches = 0;
  for (const w of reqWords) {
    if (rawLower.includes(w)) wordMatches++;
  }
  score += (wordMatches * 100);

  return score;
}

export function getDeterministicMatches(job: JobProfile, candidate: CandidateProfile) {
  const matches: RequirementMatch[] = [];

  // Sort facts globally by priority so the LLM and the exact matcher see best evidence first
  const prioritizedFacts = [...candidate.facts].sort((a, b) => {
    const pA = FACT_PRIORITY[a.type] || 99;
    const pB = FACT_PRIORITY[b.type] || 99;
    return pA - pB;
  });

  const unmatchedRequirements: typeof job.requirements = [];

  let totalExperienceYears = 0;
  for (const f of candidate.facts) {
    if (f.type === 'experience' && f.employment_duration_years) {
      totalExperienceYears += f.employment_duration_years;
    }
  }

  // 1. Stage 1: Deterministic Matcher (Lexical & Heuristic) Exact Matching
  for (const req of job.requirements) {
    let matchedFacts: { fact: CandidateFact, score: number, tier: import('./types.js').MatchTier, strength: MatchClassification }[] = [];
    const reqNameLower = req.normalized_name.toLowerCase().trim();
    const reqClean = reqNameLower.replace(/[^a-z0-9]/g, '');

    for (const fact of prioritizedFacts) {
      if (!isValidEvidenceForCategory(fact.type, req.category)) continue;

      const factLower = fact.normalizedName.toLowerCase().trim();
      const factClean = factLower.replace(/[^a-z0-9]/g, '');
      const rawLower = fact.rawText.toLowerCase();

      let isExact = false;
      let matchedStrength: MatchClassification = 'EXACT_MATCH';
      let matchedTier: import('./types.js').MatchTier = 'tier_2_lexical';

      const rawLowerPadded = ' ' + rawLower.replace(/[.,;:()]/g, ' ') + ' ';

      // 1a. Lexical Match
      if (reqClean && factClean === reqClean) isExact = true;
      else if (reqNameLower && rawLowerPadded.includes(` ${reqNameLower} `)) isExact = true;
      else if (reqNameLower && rawLower === reqNameLower) isExact = true;

      // 1b. Morphological Variants (e.g. mentor/mentored/mentoring)
      if (!isExact && reqNameLower.length > 4) {
        // Strip common suffixes (ing, ed, s, ship)
        const stem = reqNameLower.replace(/(ing|ed|s|ship)$/, '');
        if (stem.length > 3 && rawLower.includes(stem)) {
          isExact = true;
          matchedStrength = 'EXACT_MATCH';
        }
      }

      // 1c. Component Parsing: Downgrade compound requirements to PARTIAL_MATCH to force LLM semantic verification
      if (isExact && (req.category === 'hard skill' || req.category === 'soft skill' || req.category === 'responsibility' || req.category === 'experience')) {
        const origLower = (req.original_text || '').toLowerCase();
        // If the original text contains compound connectors or is significantly longer, it's likely a composite requirement 
        // that was incorrectly simplified by the JD parser. We cannot guarantee EXACT_MATCH deterministically.
        const hasCompoundKeywords = origLower.includes(' and ') || origLower.includes(' or ') || origLower.includes(',');
        const isSignificantlyLonger = origLower.length > (reqNameLower.length + 12);
        
        if (hasCompoundKeywords || isSignificantlyLonger) {
           matchedStrength = 'PARTIAL_MATCH';
        }
      }

      // 1d. Tier 1: Education Level Matching
      if (req.category === 'education' && req.degree_level && fact.type === 'education') {
        const reqLvl = req.degree_level;
        const factLvl = fact.degree_level;
        const factRaw = fact.rawText.toLowerCase();
        
        let levelMatch = false;
        if (reqLvl === factLvl) levelMatch = true;
        if (reqLvl === 'master' && (factRaw.includes('m.s.') || factRaw.includes('m.a.') || factRaw.includes('mba') || factRaw.includes("master's"))) levelMatch = true;
        if (reqLvl === 'bachelor' && (factRaw.includes('b.s.') || factRaw.includes('b.a.') || factRaw.includes('bba') || factRaw.includes("bachelor's"))) levelMatch = true;

        if (levelMatch) {
          if (!req.fields || req.fields.length === 0) {
            isExact = true;
            matchedTier = 'tier_1_deterministic';
          } else if (fact.fields && fact.fields.some(f => req.fields?.some(rf => rf.toLowerCase() === f.toLowerCase()))) {
            isExact = true;
            matchedTier = 'tier_1_deterministic';
          } else if (req.fields && req.fields.some(rf => factRaw.includes(rf.toLowerCase()))) {
            isExact = true;
            matchedTier = 'tier_1_deterministic';
          }
        }
      }

      // 1d. Tier 1: Years of Experience Matching
      if (req.minimum_years && fact.type === 'experience' && fact.employment_duration_years) {
        // Use total experience years across all facts
        if (totalExperienceYears >= req.minimum_years) {
           isExact = true;
           matchedStrength = 'EXACT_MATCH';
           matchedTier = 'tier_1_deterministic';
        } else if (fact.employment_duration_years >= req.minimum_years) {
           isExact = true;
           matchedStrength = 'EXACT_MATCH';
           matchedTier = 'tier_1_deterministic';
        }
      }

      // 1e. Location Matching
      if (req.category === 'location') {
        const reqStr = reqNameLower.replace(/^location:\s*/gi, '').trim();
        const baseLocationStr = reqStr.replace(/\((hybrid|remote|onsite).*?\)/gi, '').replace(/[—-].*$/g, '').trim();
        const parts = baseLocationStr.split(',').map(p => p.trim()).filter(Boolean);
        
        if (parts.length > 0) {
          let matchedParts = 0;
          for (const p of parts) {
            if (rawLower.includes(p)) matchedParts++;
          }
          if (matchedParts > 0) {
            isExact = true;
            matchedStrength = matchedParts === parts.length ? 'EXACT_MATCH' : 'PARTIAL_MATCH';
          }
        }
      }

      // 1f. Heuristic Matches (Problem A, B, C)
      if (!isExact) {
        // Research at Scale
        if (reqNameLower.includes('scale') || reqNameLower.includes('research operations')) {
          if (rawLower.includes('participant') || rawLower.includes('panel') || rawLower.includes('repository') || rawLower.includes('repositories')) {
            const hasScaleNumber = /\b(?:(?!(?:19|20)\d{2}\b)\d{4,}|\d+,\d{3})\b/.test(rawLower);
            if (hasScaleNumber || rawLower.includes('scale')) {
              isExact = true;
              matchedStrength = 'STRONG_SEMANTIC_MATCH';
            }
          }
        }
        
        // Stakeholder/Leadership Communication
        if (reqNameLower.includes('executive') || reqNameLower.includes('stakeholder') || reqNameLower.includes('presentation') || reqNameLower.includes('leadership') || reqNameLower.includes('communication')) {
           if (rawLower.includes('c-suite') || rawLower.includes('vp') || rawLower.includes('executive') || rawLower.includes('director') || rawLower.includes('stakeholder')) {
              if (fact.type === 'experience' && rawLower.split(' ').length > 6) {
                 isExact = true;
                 matchedStrength = 'STRONG_SEMANTIC_MATCH';
              }
           }
        }

        // Qualitative/Quantitative (Methodologies)
        if (reqNameLower.includes('qualitative') || reqNameLower.includes('quantitative') || reqNameLower.includes('research methods')) {
           if (rawLower.includes('usability test') || rawLower.includes('interview') || rawLower.includes('survey') || rawLower.includes('diary stud')) {
              if (fact.type === 'experience') {
                 isExact = true;
                 matchedStrength = 'STRONG_SEMANTIC_MATCH';
              }
           }
        }
      }

      if (isExact) {
        const score = scoreFactForRequirement(fact, req, matchedStrength);
        matchedFacts.push({ fact, score, tier: matchedTier, strength: matchedStrength });
      }
    }

    let fallbackMatch: RequirementMatch | null = null;

    if (matchedFacts.length > 0) {
      // Sort by score descending and take up to 3 top facts that are within 3000 points of the best score to avoid accumulating unrelated weak evidence
      matchedFacts.sort((a, b) => b.score - a.score);
      const bestScore = matchedFacts[0].score;
      
      const isCompound = matchedFacts.some(f => f.strength === 'PARTIAL_MATCH') || reqNameLower.includes(' and ');
      // Keep up to 5 facts for compound/experience requirements to ensure all components are covered, otherwise 3
      const limit = (isCompound || req.category === 'experience') ? 5 : 3;
      const topFacts = matchedFacts.filter(mf => mf.score >= bestScore - 5000).slice(0, limit);
      
      let evidence: MatchEvidence[] = [];
      if (req.minimum_years && totalExperienceYears >= req.minimum_years) {
        // For total years, use all experience facts with duration, PLUS top substantive bullets
        const headerFacts = candidate.facts.filter(f => f.type === 'experience' && f.employment_duration_years);
        const substantiveFacts = topFacts.map(mf => mf.fact).filter(f => !headerFacts.some(hf => hf.id === f.id));
        const combinedFacts = [...headerFacts, ...substantiveFacts].slice(0, 6);
        
        evidence = combinedFacts.map(f => ({
            source_section: f.sourceSection,
            source_text: f.rawText,
            fact_id: f.id,
            relevance: 'direct',
            evidence_strength: 'primary',
            evidence_type: f.type,
            evidence_tier: topFacts[0].tier
        }));
      } else {
        evidence = topFacts.map(mf => ({
          source_section: mf.fact.sourceSection,
          source_text: mf.fact.rawText,
          fact_id: mf.fact.id,
          relevance: 'direct',
          evidence_strength: FACT_PRIORITY[mf.fact.type] <= 3 ? 'primary' : 'secondary',
          evidence_type: mf.fact.type,
          evidence_tier: mf.tier
        }));
      }

      // We determine classification based on the strongest matched strength
      let bestStrength: MatchClassification = 'EXACT_MATCH';
      if (topFacts.every(f => f.strength === 'PARTIAL_MATCH')) bestStrength = 'PARTIAL_MATCH';
      else if (topFacts.some(f => f.strength === 'EXACT_MATCH')) bestStrength = 'EXACT_MATCH';
      else if (topFacts.some(f => f.strength === 'STRONG_SEMANTIC_MATCH')) bestStrength = 'STRONG_SEMANTIC_MATCH';

      // Substantive Requirements Validation
      // If the requirement is a skill, tool, or responsibility, and ALL top evidence comes exclusively 
      // from bare lists (skills, other) rather than substantive experience/projects, downgrade to UNDER_EXPRESSED.
      if (['hard skill', 'soft skill', 'tool', 'responsibility', 'methodology'].includes(req.category)) {
        const hasSubstantiveEvidence = topFacts.some(mf => mf.fact.type === 'experience' || mf.fact.type === 'project');
        if (!hasSubstantiveEvidence && (bestStrength === 'EXACT_MATCH' || bestStrength === 'STRONG_SEMANTIC_MATCH')) {
          bestStrength = 'UNDER_EXPRESSED';
        }
      }

      const bestExactMatch: RequirementMatch = {
        requirement: req,
        classification: bestStrength,
        confidence: 1.0,
        explanation: 'Deterministic or structured heuristic match found in resume.',
        match_tier: topFacts[0].tier,
        evidence
      };

      const bestPriority = FACT_PRIORITY[topFacts[0].fact.type] || 99;
      const isCoreCategory = ['experience', 'education', 'location', 'domain', 'years'].includes(req.category);
      
      // If the best deterministic match is weak (e.g. from skills section), or if we explicitly downgraded it to PARTIAL_MATCH 
      // due to being a compound requirement, we MUST route it to the LLM for rigorous component evaluation.
      const shouldFallback = bestStrength === 'PARTIAL_MATCH' || (bestPriority > 3 && !isCoreCategory && bestStrength !== 'EXACT_MATCH');
      
      if (shouldFallback) {
         fallbackMatch = bestExactMatch;
      } else {
         matches.push(bestExactMatch);
         continue;
      }
    }

    if (fallbackMatch) {
      (req as any)._fallbackMatch = fallbackMatch;
    }
    unmatchedRequirements.push(req);
  }

  return { matches, unmatchedRequirements, prioritizedFacts };
}

export async function matchRequirements(
  job: JobProfile,
  candidate: CandidateProfile,
  deterministicResult: { matches: RequirementMatch[], unmatchedRequirements: typeof job.requirements, prioritizedFacts: CandidateFact[] },
  options: { observability?: AiObservabilityContext } = {}
): Promise<MatchingResult> {
  const { matches, unmatchedRequirements, prioritizedFacts } = deterministicResult;

  // 2. LLM Verification Pass - BATCHED
  if (unmatchedRequirements.length > 0) {
    const factListStr = prioritizedFacts.map(f => {
      let meta = `[ID: ${f.id}] [Section: ${f.sourceSection}]`;
      if (f.employment_duration_years) {
        meta += ` [Years: ${f.employment_duration_years}]`;
      }
      return `${meta} ${f.rawText}`;
    }).join('\n');
    const reqListStr = unmatchedRequirements.map(r => `[ID: ${r.id}] Name: ${r.normalized_name} (Category: ${r.category})\nOriginal Text: ${r.original_text}`).join('\n\n');
    const prompt = `Requirements:\n${reqListStr}\n\nCandidate Facts (Prioritized):\n${factListStr}`;

    let llmMatches: any[] = [];
      const rawJson = await callOpenRouter(
        [
          { role: 'system', content: MATCHER_SYSTEM_PROMPT },
          { role: 'user', content: prompt }
        ],
        { maxTokens: 8000, temperature: 0.1, observability: options.observability, stage: 'analyzer' }
      );

      const parsed = extractJsonFromText(rawJson) as any;

      if (Array.isArray(parsed)) {
        llmMatches = parsed;
    } else if (parsed && typeof parsed === 'object' && Array.isArray(parsed.matches)) {
      llmMatches = parsed.matches;
    }

      for (const req of unmatchedRequirements) {
        // Robust Requirement Lookup: LLMs might truncate IDs, wrap them in brackets, or return the name instead.
        const parsedMatch = llmMatches.find((m: any) => {
          if (!m.requirementId) return false;
          const reqIdStr = String(m.requirementId).toLowerCase();
          const targetId = req.id.toLowerCase();
          const targetName = req.normalized_name.toLowerCase();
          const targetText = req.original_text.toLowerCase();
          
          return reqIdStr === targetId ||
                 targetId.includes(reqIdStr) ||
                 reqIdStr.includes(targetId) ||
                 targetName.includes(reqIdStr) ||
                 targetText.includes(reqIdStr);
        });

        if (!parsedMatch) {
          if ((req as any)._fallbackMatch) {
            matches.push((req as any)._fallbackMatch);
          } else {
            const semanticFallback = getFallbackSemanticMatch(req, prioritizedFacts);
            if (semanticFallback) {
              matches.push(semanticFallback);
            } else {
              matches.push({
                requirement: req,
                classification: 'ANALYSIS_FAILED',
                confidence: 0,
                explanation: 'Analysis skipped for this requirement.',
                match_tier: 'tier_3_semantic',
                evidence: []
              });
            }
          }
          continue;
        }

        let classification: MatchClassification = parsedMatch.classification || 'MISSING';
        let citedFactIds: string[] = [];
        if (Array.isArray(parsedMatch.supportingFactIds)) {
          citedFactIds = parsedMatch.supportingFactIds.map(String);
        } else if (parsedMatch.supportingFactId) {
          citedFactIds = [String(parsedMatch.supportingFactId)]; // Fallback if LLM uses old key
        } else if (parsedMatch.supportingFactIds && typeof parsedMatch.supportingFactIds === 'string') {
          citedFactIds = [parsedMatch.supportingFactIds];
        }

        let explanation: string = parsedMatch.explanation || '';

        // Robust Fact Lookup
        let validFacts: CandidateFact[] = [];
        for (const cId of citedFactIds) {
          const cIdLower = cId.toLowerCase();
          const found = candidate.facts.find(f => {
            const fId = f.id.toLowerCase();
            return fId === cIdLower || fId.includes(cIdLower) || cIdLower.includes(fId);
          });
          if (found && !validFacts.some(v => v.id === found.id)) {
            if (isValidEvidenceForCategory(found.type, req.category)) {
              validFacts.push(found);
            }
          }
        }

        // Helper to check if a fact semantically supports the requirement even if exact keywords are missing
        const hasSemanticMatch = (rawLower: string, reqNameLower: string) => {
          if (reqNameLower.includes('executive') || reqNameLower.includes('stakeholder') || reqNameLower.includes('presentation') || reqNameLower.includes('leadership')) {
            if (rawLower.includes('c-suite') || rawLower.includes('vp') || rawLower.includes('executive') || rawLower.includes('director') || rawLower.includes('board')) return true;
          }
          if (reqNameLower.includes('mentor') || reqNameLower.includes('coach') || reqNameLower.includes('guide')) {
            if (rawLower.includes('mentor') || rawLower.includes('coach') || rawLower.includes('guide') || rawLower.includes('1:1') || rawLower.includes('onboard')) return true;
          }
          if (reqNameLower.includes('data science') || reqNameLower.includes('partner') || reqNameLower.includes('collaborat')) {
            if (rawLower.includes('data science') || rawLower.includes('machine learning') || rawLower.includes('analytics') || rawLower.includes('partner') || rawLower.includes('collaborat')) return true;
          }
          if (reqNameLower.includes('research') || reqNameLower.includes('method')) {
            if (rawLower.includes('interview') || rawLower.includes('usability') || rawLower.includes('survey') || rawLower.includes('diary stud') || rawLower.includes('a/b test')) return true;
          }
          if (reqNameLower.includes('operation') || reqNameLower.includes('ops') || reqNameLower.includes('repositor') || reqNameLower.includes('panel')) {
            if (rawLower.includes('repositor') || rawLower.includes('panel') || rawLower.includes('participant') || rawLower.includes('recruit') || rawLower.includes('ops')) return true;
          }
          return false;
        };

        // ANTI-HALLUCINATION & EVIDENCE RANKING
        if (classification !== 'MISSING' && validFacts.length === 0) {
          let bestFact: CandidateFact | undefined = undefined;
          let maxScore = -1; 
          
          for (const f of prioritizedFacts) {
            if (!isValidEvidenceForCategory(f.type, req.category)) continue;

            const isDetMatch = (req as any)._fallbackMatch?.evidence?.some((e: any) => e.fact_id === f.id);
            const reqWords = req.normalized_name.toLowerCase().split(/\s+/).filter(w => w.length > 3);
            const hasKeywords = (reqWords.length > 0 && reqWords.some(w => f.rawText.toLowerCase().includes(w))) || hasSemanticMatch(f.rawText.toLowerCase(), req.normalized_name.toLowerCase());
            
            if (isDetMatch || hasKeywords) {
              const score = scoreFactForRequirement(f, req, 'MISSING');
              if (score > maxScore) {
                maxScore = score;
                bestFact = f;
              }
            }
          }
          
          // Require a minimum baseline of evidence relevance (e.g., at least 2500 points on top of priority)
          if (bestFact && maxScore >= 2500) {
            validFacts.push(bestFact);
            if (classification === 'EXACT_MATCH' || classification === 'STRONG_SEMANTIC_MATCH') {
              classification = 'UNDER_EXPRESSED';
              explanation += ' (Note: Explicit citation missing; fallback evidence used.)';
            }
          } else {
            classification = 'MISSING';
            explanation = 'Fallback: System claimed a match but could not cite sufficiently relevant supporting evidence from the resume.';
          }
        }

        // If LLM selected a single fact, check if there's a substantially stronger fact available 
        if (validFacts.length === 1 && classification !== 'MISSING') {
          const validFact = validFacts[0];
          const llmScore = scoreFactForRequirement(validFact, req, classification);
          let bestAlternative: CandidateFact | undefined;
          let maxAltScore = llmScore + 2000; // Require alternative to be substantially better
          
          for (const f of prioritizedFacts) {
             if (f.id === validFact.id) continue;
             if (!isValidEvidenceForCategory(f.type, req.category)) continue;
             
             const altScore = scoreFactForRequirement(f, req, classification);
             
             // Ensure the alternative actually mentions the requirement or is a deterministic match
             const isDetMatch = (req as any)._fallbackMatch?.evidence?.some((e: any) => e.fact_id === f.id);
             const reqWords = req.normalized_name.toLowerCase().split(/\s+/).filter(w => w.length > 3);
             const hasKeywords = (reqWords.length > 0 && reqWords.some(w => f.rawText.toLowerCase().includes(w))) || hasSemanticMatch(f.rawText.toLowerCase(), req.normalized_name.toLowerCase());
             
             if ((isDetMatch || hasKeywords) && altScore > maxAltScore) {
                maxAltScore = altScore;
                bestAlternative = f;
             }
          }
          
          if (bestAlternative) {
             validFacts = [bestAlternative];
          }
        }

        let evidence: MatchEvidence[] = [];
        if (validFacts.length > 0 && classification !== 'MISSING') {
          for (const f of validFacts) {
            evidence.push({
              source_section: f.sourceSection,
              source_text: f.rawText,
              fact_id: f.id,
              relevance: 'semantic',
              evidence_strength: FACT_PRIORITY[f.type] <= 3 ? 'primary' : 'secondary',
              evidence_type: f.type,
              evidence_tier: 'tier_3_semantic'
            });
          }
        }

        // Check fallback if LLM failed to find a valid strong match
        const hasFallback = (req as any)._fallbackMatch;
        if (hasFallback) {
          const isFallbackStronger = 
             (hasFallback.classification === 'EXACT_MATCH' || hasFallback.classification === 'STRONG_SEMANTIC_MATCH') && 
             (classification === 'MISSING' || classification === 'RELATED_MATCH' || classification === 'UNDER_EXPRESSED' || classification === 'PARTIAL_MATCH' || classification === 'ANALYSIS_FAILED');
             
          if (isFallbackStronger || classification === 'MISSING' || classification === 'RELATED_MATCH' || classification === 'ANALYSIS_FAILED') {
            matches.push(hasFallback);
            continue;
          }
        }

        if (classification === 'MISSING') {
          const semanticFallback = getFallbackSemanticMatch(req, prioritizedFacts);
          if (semanticFallback) {
            matches.push(semanticFallback);
            continue;
          }
        }

        matches.push({
          requirement: req,
          classification,
          confidence: 0.85,
          explanation,
          match_tier: 'tier_3_semantic',
          evidence
        });
      }

  } else {
    // No unmatched requirements, skip LLM
  }

  return { matches };
}
