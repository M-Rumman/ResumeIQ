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

const MATCHER_SYSTEM_PROMPT = `You are an expert technical recruiter and evidence evaluator.
Your job is to match multiple Job Requirements against Candidate Facts.

You will be given:
1. A list of requirements (ID, Name, Category, Original Text).
2. Prioritized Candidate Facts (ID, Type, Section, Text). 
   - Facts are ordered by evidence strength (Experience > Education > Projects > Skills).

EVIDENCE RANKING RULES:
When multiple facts could satisfy a requirement, you MUST select the single strongest fact as the supportingFactId. Rank evidence in this exact order of priority:
1. Direct responsibility/task evidence (e.g., specific work history demonstrating the task).
2. Evidence that explicitly demonstrates the requirement's core capability.
3. Quantified/scaled evidence (e.g., numbers, team sizes, budgets, repository size) when the requirement involves scale.
4. Evidence with strong semantic alignment.
5. Skills-list evidence (only select this if experience/responsibility evidence is completely unavailable).
6. Generic or tangential evidence (last resort).

Classify the match for EACH requirement exactly into one of these states:
- EXACT_MATCH: The resume explicitly contains the exact requirement.
- STRONG_SEMANTIC_MATCH: Different wording, but evidence clearly and directly demonstrates the identical capability or responsibility. Do not require lexical keyword repetition if strong factual evidence proves the requirement.
- PARTIAL_MATCH: Some evidence exists, but lacks full depth/breadth.
- RELATED_MATCH: Adjacent/tangential evidence exists but doesn't prove the specific requirement.
- UNDER_EXPRESSED: Relevant evidence EXISTS anywhere in the resume but the evidence is materially weaker, indirect, incomplete, or lacks an important aspect of the requirement. Do NOT use this if the candidate has strong, direct factual evidence demonstrating the capability.
- MISSING: No reasonable evidence exists anywhere in the resume, even loosely. You MUST search across ALL provided resume content before assigning this.

Output a JSON object containing a "matches" array. Each object in the array must have:
- requirementId: The exact ID string of the requirement.
- classification: One of EXACT_MATCH, STRONG_SEMANTIC_MATCH, PARTIAL_MATCH, RELATED_MATCH, UNDER_EXPRESSED, MISSING.
- supportingFactId: The exact ID string of the Candidate Fact, or null.
- explanation: A string explaining the match.

Example JSON structure:
{
  "matches": [
    {
      "requirementId": "req-uuid-1",
      "classification": "EXACT_MATCH",
      "supportingFactId": "fact-uuid-1",
      "explanation": "The candidate has..."
    }
  ]
}

CRITICAL RULES:
- Never hallucinate facts. If there's truly no related evidence, output MISSING.
- If a JD requires a very specific tool (e.g., ROS, MATLAB) and there is absolutely no evidence, output MISSING.
- You may use logical deduction to assign UNDER_EXPRESSED if the evidence implies the capability, but if the evidence is direct and strong, classify as STRONG_SEMANTIC_MATCH even if terminology differs.
- Do not upgrade a requirement merely because related words appear. The classification must remain evidence-grounded.
- "B.A." vs "Bachelor's degree" is an EXACT_MATCH or STRONG_SEMANTIC_MATCH.
- If a location matches but the work mode (e.g. remote, hybrid) is unverified in the resume, classify as PARTIAL_MATCH.
`;

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
    let bestExactMatch: RequirementMatch | null = null;
    let bestMatchScore = -1;
    const reqNameLower = req.normalized_name.toLowerCase().trim();
    const reqClean = reqNameLower.replace(/[^a-z0-9]/g, '');

    for (const fact of prioritizedFacts) {
      const factLower = fact.normalizedName.toLowerCase().trim();
      const factClean = factLower.replace(/[^a-z0-9]/g, '');
      const rawLower = fact.rawText.toLowerCase();

      let isExact = false;
      let matchedStrength: MatchClassification = 'EXACT_MATCH';

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
          matchedStrength = 'STRONG_SEMANTIC_MATCH';
        }
      }

      // 1c. Education Level Matching
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
          } else if (fact.fields && fact.fields.some(f => req.fields?.some(rf => rf.toLowerCase() === f.toLowerCase()))) {
            isExact = true;
          } else if (req.fields && req.fields.some(rf => factRaw.includes(rf.toLowerCase()))) {
            isExact = true;
          }
        }
      }

      // 1d. Years of Experience Matching
      if (req.minimum_years && fact.type === 'experience' && fact.employment_duration_years) {
        // Use total experience years across all facts
        if (totalExperienceYears >= req.minimum_years) {
           isExact = true;
           matchedStrength = 'STRONG_SEMANTIC_MATCH';
        } else if (fact.employment_duration_years >= req.minimum_years) {
           isExact = true;
           matchedStrength = 'STRONG_SEMANTIC_MATCH';
        }
      }

      // 1e. Location Matching
      if (req.category === 'location') {
        // Split out hybrid/remote tags and prefixes
        const baseLocation = reqNameLower.replace(/^location:\s*/gi, '').replace(/\((hybrid|remote|onsite).*?\)/gi, '').trim();
        if (baseLocation && rawLower.includes(baseLocation)) {
          isExact = true;
          if (reqNameLower.includes('hybrid') || reqNameLower.includes('remote')) {
            if (!rawLower.includes('hybrid') && !rawLower.includes('remote')) {
              matchedStrength = 'PARTIAL_MATCH'; // Location matches, but mode is unverified
            }
          }
        }
      }

      // 1f. Domain/Industry Matching
      if (req.category === 'domain') {
        const domainSynonyms: Record<string, string[]> = {
          'fintech': ['bank', 'financial', 'lending', 'consumer banking', 'finance'],
          'banking': ['bank', 'financial', 'lending', 'finance'],
        };
        for (const [key, syns] of Object.entries(domainSynonyms)) {
          if (reqNameLower.includes(key) && syns.some(s => rawLower.includes(s))) {
            isExact = true;
            matchedStrength = 'STRONG_SEMANTIC_MATCH';
            break;
          }
        }
      }

      // 1g. Scale / Research Operations
      if (reqNameLower.includes('scale') || reqNameLower.includes('research operations')) {
        if (rawLower.includes('scale') || rawLower.includes('research operations') || /\b\d{4,}\b|\d+,\d{3}/.test(rawLower)) {
          isExact = true;
          matchedStrength = 'STRONG_SEMANTIC_MATCH';
        }
      }

      // 1h. Specific Responsibilities Matching
      if (req.category === 'responsibility') {
        if (reqNameLower.includes('data science') && rawLower.includes('data science')) isExact = true;
        if (reqNameLower.includes('senior leadership') && (rawLower.includes('vp') || rawLower.includes('c-suite') || rawLower.includes('director'))) isExact = true;
        if (reqNameLower.includes('end-to-end') && rawLower.includes('generative') && rawLower.includes('evaluative')) {
           isExact = true;
           matchedStrength = 'STRONG_SEMANTIC_MATCH';
        }
      }

      if (isExact) {
        // Calculate a score to pick the best deterministic match
        let score = 0;
        
        // 1. Base score from priority (Experience > Quantified > Education > Skills)
        const priorityScore = (10 - (FACT_PRIORITY[fact.type] || 9)) * 100; // e.g., Experience = 900, Skill = 400
        score += priorityScore;
        
        // 2. Quantified Achievement Evidence
        if (/\d+/.test(rawLower)) {
          score += 20;
          if (fact.type === 'experience') {
             score += 500; // Quantified experience is highly preferred
             if (reqNameLower.includes('scale') && /\b\d{4,}\b|\d+,\d{3}/.test(rawLower)) {
               score += 500;
             }
          }
        }

        if (matchedStrength === 'EXACT_MATCH') score += 50;

        if (score > bestMatchScore) {
          bestMatchScore = score;
          bestExactMatch = {
            requirement: req,
            classification: matchedStrength,
            confidence: 1.0,
            explanation: 'Deterministic or structured heuristic match found in resume.',
            evidence: [{
              source_section: fact.sourceSection,
              source_text: fact.rawText,
              fact_id: fact.id,
              relevance: 'direct',
              evidence_strength: FACT_PRIORITY[fact.type] <= 3 ? 'primary' : 'secondary'
            }]
          };
        }
      }
    }

    let fallbackMatch: RequirementMatch | null = null;

    if (bestExactMatch) {
      const bestFactId = bestExactMatch.evidence[0].fact_id;
      const bestFact = prioritizedFacts.find(f => f.id === bestFactId);
      const priority = bestFact ? (FACT_PRIORITY[bestFact.type] || 99) : 99;
      
      const isCoreCategory = ['experience', 'education', 'location', 'domain', 'years'].includes(req.category);
      
      // If the best deterministic match is weak (e.g. from skills section) and the requirement is semantic, don't short-circuit.
      if (priority > 3 && !isCoreCategory) {
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
    try {
      const factListStr = prioritizedFacts.map(f => {
        let meta = `[ID: ${f.id}] [Section: ${f.sourceSection}]`;
        if (f.employment_duration_years) {
          meta += ` [Years: ${f.employment_duration_years}]`;
        }
        return `${meta} ${f.rawText}`;
      }).join('\n');
      const reqListStr = unmatchedRequirements.map(r => `[ID: ${r.id}] Name: ${r.normalized_name} (Category: ${r.category})\nOriginal Text: ${r.original_text}`).join('\n\n');
      const prompt = `Requirements:\n${reqListStr}\n\nCandidate Facts (Prioritized):\n${factListStr}`;

      const rawJson = await callOpenRouter(
        [
          { role: 'system', content: MATCHER_SYSTEM_PROMPT },
          { role: 'user', content: prompt }
        ],
        { maxTokens: 2000, temperature: 0.1, observability: options.observability, stage: 'analyzer' }
      );

      const parsed = extractJsonFromText(rawJson) as any;

      let llmMatches: any[] = [];
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
            matches.push({
              requirement: req,
              classification: 'ANALYSIS_FAILED',
              confidence: 0,
              explanation: 'Analysis skipped for this requirement.',
              evidence: []
            });
          }
          continue;
        }

        let classification: MatchClassification = parsedMatch.classification || 'MISSING';
        const citedFactId: string | null = parsedMatch.supportingFactId ? String(parsedMatch.supportingFactId) : null;
        let explanation: string = parsedMatch.explanation || '';

        // Robust Fact Lookup
        let validFact = citedFactId ? candidate.facts.find(f => {
          const fId = f.id.toLowerCase();
          const cId = citedFactId.toLowerCase();
          return fId === cId || fId.includes(cId) || cId.includes(fId);
        }) : undefined;

        // ANTI-HALLUCINATION:
        if (classification !== 'MISSING' && !validFact) {
          const expLower = explanation.toLowerCase();
          const reqLower = req.normalized_name.toLowerCase();
          const reqWords = reqLower.split(/\s+/).filter(w => w.length > 3);
          
          let bestFact: CandidateFact | undefined = undefined;
          let maxScore = -1; // Initialize to -1 to allow 0 scores to win if it's the only one
          
          for (const f of prioritizedFacts) {
            let score = 0;
            const rawLower = f.rawText.toLowerCase();
            
            // Base score from priority
            score += (100 - (FACT_PRIORITY[f.type] || 99)) * 10; // priority dominates

            // Score based on explanation overlap
            const words = rawLower.split(/\s+/).filter(w => w.length > 4);
            for (const w of words) {
              if (expLower.includes(w)) score++;
            }
            
            // Score based on requirement overlap
            for (const w of Array.from(reqWords)) {
              if (rawLower.includes(w as string)) score += 2;
            }

            // Boost for numbers
            if (/\d+/.test(rawLower)) {
              score += 15;
            }
            
            if (score > maxScore) {
              maxScore = score;
              bestFact = f;
            }
          }
          
          if (maxScore > 0) {
            validFact = bestFact;
            if (classification === 'EXACT_MATCH' || classification === 'STRONG_SEMANTIC_MATCH') {
              classification = 'UNDER_EXPRESSED';
              explanation += ' (Note: Explicit citation missing; fallback evidence used.)';
            }
          } else {
            classification = 'MISSING';
            explanation = 'Fallback: System claimed a match but could not cite valid supporting evidence from the resume.';
          }
        }

        let evidence: MatchEvidence[] = [];
        if (validFact && classification !== 'MISSING') {
          evidence.push({
            source_section: validFact.sourceSection,
            source_text: validFact.rawText,
            fact_id: validFact.id,
            relevance: 'semantic',
            evidence_strength: FACT_PRIORITY[validFact.type] <= 3 ? 'primary' : 'secondary'
          });
        }

        // Check fallback if LLM failed to find a valid strong match
        const hasFallback = (req as any)._fallbackMatch;
        if (hasFallback && (classification === 'MISSING' || classification === 'RELATED_MATCH' || classification === 'ANALYSIS_FAILED')) {
          matches.push((req as any)._fallbackMatch);
          continue;
        }

        matches.push({
          requirement: req,
          classification,
          confidence: 0.85,
          explanation,
          evidence
        });
      }

    } catch (error) {
      console.error(`[matcher] Failed to evaluate batched requirements`, error);
      for (const req of unmatchedRequirements) {
        if ((req as any)._fallbackMatch) {
          matches.push((req as any)._fallbackMatch);
        } else {
          matches.push({
            requirement: req,
            classification: 'ANALYSIS_FAILED',
            confidence: 0,
            explanation: 'Analysis failed for this requirement.',
            evidence: []
          });
        }
      }
    }
  }

  return { matches };
}
