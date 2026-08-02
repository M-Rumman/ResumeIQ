import { callOpenRouter } from '../openrouter.js';
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
Your job is to match a single Job Requirement against Candidate Facts.

You will be given:
1. A single requirement (Name, Category, Original Text).
2. Prioritized Candidate Facts (ID, Type, Section, Text). 
   - Facts are ordered by evidence strength (Experience > Education > Projects > Skills).
   - Prefer stronger evidence (Experience) over weaker evidence (Skills) if both satisfy the requirement.

Classify the match exactly into one of these states:
- EXACT_MATCH: The resume explicitly contains the exact requirement.
- STRONG_SEMANTIC_MATCH: Different wording, but evidence clearly demonstrates the identical capability.
- PARTIAL_MATCH: Some evidence exists, but lacks full depth/breadth.
- RELATED_MATCH: Adjacent/tangential evidence exists but doesn't prove the specific requirement.
- UNDER_EXPRESSED: Relevant evidence EXISTS anywhere in the resume but does not use matching terminology or isn't framed as directly satisfying this specific requirement.
- MISSING: No reasonable evidence exists anywhere in the resume, even loosely. You MUST search across ALL provided resume content before assigning this.

Output JSON exactly like this:
{
  "classification": "EXACT_MATCH" | "STRONG_SEMANTIC_MATCH" | "PARTIAL_MATCH" | "RELATED_MATCH" | "UNDER_EXPRESSED" | "MISSING",
  "supportingFactId": "id1", // Leave null or empty if MISSING
  "explanation": "Explain why this classification was chosen and how the evidence proves it."
}

CRITICAL RULES:
- Never hallucinate facts. If there's truly no related evidence, output MISSING.
- If a JD requires a very specific tool (e.g., ROS, MATLAB) and there is absolutely no evidence, output MISSING.
- You may use logical deduction to assign UNDER_EXPRESSED if the evidence strongly implies the capability (e.g., "collaborated with analysts" -> implies data science collaboration).
- "B.A." vs "Bachelor's degree" is an EXACT_MATCH or STRONG_SEMANTIC_MATCH.
`;

export async function matchRequirements(
  job: JobProfile,
  candidate: CandidateProfile,
  options: { observability?: AiObservabilityContext } = {}
): Promise<MatchingResult> {
  const matches: RequirementMatch[] = [];

  // Sort facts globally by priority so the LLM and the exact matcher see best evidence first
  const prioritizedFacts = [...candidate.facts].sort((a, b) => {
    const pA = FACT_PRIORITY[a.type] || 99;
    const pB = FACT_PRIORITY[b.type] || 99;
    return pA - pB;
  });

  for (const req of job.requirements) {
    // 1. Lexical / Heuristic Exact Matching
    let exactMatchFound: RequirementMatch | null = null;
    const reqNameLower = req.normalized_name.toLowerCase().trim();
    const reqClean = reqNameLower.replace(/[^a-z0-9]/g, '');

    for (const fact of prioritizedFacts) {
      const factLower = fact.normalizedName.toLowerCase().trim();
      const factClean = factLower.replace(/[^a-z0-9]/g, '');
      const rawLower = fact.rawText.toLowerCase();

      let isExact = false;
      if (reqClean && factClean === reqClean) isExact = true;
      else if (reqNameLower && rawLower.includes(` ${reqNameLower} `)) isExact = true;
      else if (reqNameLower && rawLower.startsWith(`${reqNameLower} `)) isExact = true;
      else if (reqNameLower && rawLower.endsWith(` ${reqNameLower}`)) isExact = true;
      else if (reqNameLower && rawLower === reqNameLower) isExact = true;

      // Special education heuristics
      if (req.category === 'education' && req.degree_level && fact.type === 'education' && fact.degree_level === req.degree_level) {
        if (!req.fields || req.fields.length === 0) {
          isExact = true;
        } else if (fact.fields && fact.fields.some(f => req.fields?.includes(f))) {
          isExact = true;
        }
      }

      if (isExact) {
        exactMatchFound = {
          requirement: req,
          classification: 'EXACT_MATCH',
          confidence: 1.0,
          explanation: 'Exact lexical or structural match found in resume.',
          evidence: [{
            source_section: fact.sourceSection,
            source_text: fact.rawText,
            fact_id: fact.id,
            relevance: 'direct',
            evidence_strength: FACT_PRIORITY[fact.type] <= 3 ? 'primary' : 'secondary'
          }]
        };
        break; // Stop at first exact match (which is the highest priority due to sort)
      }
    }

    if (exactMatchFound) {
      matches.push(exactMatchFound);
      continue;
    }

    // 2. LLM Verification Pass
    try {
      const factListStr = prioritizedFacts.map(f => `[ID: ${f.id}] [Section: ${f.sourceSection}] ${f.rawText}`).join('\n');
      const prompt = `Requirement:\nName: ${req.normalized_name}\nCategory: ${req.category}\nOriginal Text: ${req.original_text}\n\nCandidate Facts (Prioritized):\n${factListStr}`;

      const rawJson = await callOpenRouter(
        [
          { role: 'system', content: MATCHER_SYSTEM_PROMPT },
          { role: 'user', content: prompt }
        ],
        { maxTokens: 800, temperature: 0.1, observability: options.observability, stage: 'analyzer' }
      );

      const cleanedJson = rawJson.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
      const parsed = JSON.parse(cleanedJson);

      let classification: MatchClassification = parsed.classification || 'MISSING';
      const citedFactId: string | null = parsed.supportingFactId || null;
      let explanation: string = parsed.explanation || '';

      const validFact = citedFactId ? candidate.facts.find(f => f.id === citedFactId) : undefined;

      // ANTI-HALLUCINATION:
      // If classification is positive but no valid fact is cited, force MISSING.
      if (classification !== 'MISSING' && !validFact) {
        classification = 'MISSING';
        explanation = 'Fallback: System claimed a match but could not cite valid supporting evidence from the resume.';
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

      matches.push({
        requirement: req,
        classification,
        confidence: 0.85,
        explanation,
        evidence
      });

    } catch (error) {
      console.error(`[matcher] Failed to evaluate requirement: ${req.normalized_name}`, error);
      matches.push({
        requirement: req,
        classification: 'MISSING',
        confidence: 0,
        explanation: 'Analysis failed for this requirement.',
        evidence: []
      });
    }
  }

  return { matches };
}
