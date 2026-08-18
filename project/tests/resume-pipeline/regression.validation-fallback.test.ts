import assert from 'node:assert/strict';
import { matchRequirements } from '../../api/_lib/analysis-engine/matcher.js';
import { validateEvidenceAttribution } from '../../api/_lib/analysis-engine/validator.js';
import type { JobRequirement, CandidateProfile, CandidateFact } from '../../api/_lib/analysis-engine/types.js';

// Mock deterministic matches and candidates for tests
function createFact(id: string, type: any, rawText: string, fields?: string[], duration?: number): CandidateFact {
  return {
    id,
    type,
    normalizedName: rawText,
    rawText,
    sourceSection: 'Test Section',
    evidence: rawText,
    fields,
    employment_duration_years: duration
  };
}

function createReq(id: string, category: any, name: string): JobRequirement {
  return {
    id,
    category,
    normalized_name: name,
    original_text: name,
    source_section: 'Job Description',
    source_span: [0, name.length],
    source_text: name,
    priority: 'required',
    requirement_type: category,
    confidence: 1.0,
  };
}

const reqLocation = createReq('loc-1', 'location', 'Chicago, IL (Hybrid — 3 days onsite)');
const reqSkill = createReq('skill-1', 'hard skill', 'React.js');
const reqEdu = createReq('edu-1', 'education', 'Bachelor of Science in Computer Science');
reqEdu.degree_level = 'bachelor';
reqEdu.fields = ['Computer Science'];

const factLocation = createFact('f-loc', 'other', 'Chicago, IL');
const factSkill = createFact('f-skill', 'skill', 'React.js');
const factEdu = createFact('f-edu', 'education', 'B.S. in Computer Science', ['Computer Science']);
const factWeak = createFact('f-weak', 'other', 'Some vague text');

const candidate: CandidateProfile = {
  contact: { name: 'Test', email: 'test@example.com', phone: '', location: 'Chicago, IL', links: [] },
  facts: [factLocation, factSkill, factEdu, factWeak],
  rawStructure: {} as any
};

async function runTests() {
  let passed = 0;
  let total = 0;

  const testCases = [
    {
      name: 'Exact location match preserves deterministic classification even if evidence stripped by validation (if that were to happen, but evidence type is now fixed)',
      run: async () => {
        // By setting evidence_type to mf.fact.type, validateEvidenceAttribution will now ALLOW it.
        // But to test the graceful fallback, let's artificially strip it by breaking provenance
        const deterministicResult = {
          matches: [{
            requirement: reqLocation,
            classification: 'EXACT_MATCH' as const,
            confidence: 1.0,
            explanation: 'Deterministic',
            match_tier: 'tier_1_deterministic' as const,
            evidence: [{
              source_section: 'Header',
              source_text: 'NOT IN RESUME', // This fails provenance check
              fact_id: factLocation.id,
              relevance: 'direct',
              evidence_strength: 'primary' as const,
              evidence_type: factLocation.type,
              evidence_tier: 'tier_1_deterministic' as const
            }]
          }],
          unmatchedRequirements: [],
          prioritizedFacts: candidate.facts
        };

        const validated = validateEvidenceAttribution(deterministicResult.matches, candidate.facts, 'Only New York is here');
        assert.equal(validated[0].classification, 'EXACT_MATCH', 'Should preserve deterministic match');
        assert.equal(validated[0].evidence.length, 0, 'Evidence should be stripped');
        assert.ok(validated[0].explanation.includes('Evidence validation unavailable'), 'Should append unavailable note');
      }
    },
    {
      name: 'LLM ANALYSIS_FAILED properly falls back to a deterministic match',
      run: async () => {
        const reqWithFallback = { ...reqSkill, _fallbackMatch: {
          requirement: reqSkill,
          classification: 'PARTIAL_MATCH' as const,
          confidence: 0.5,
          explanation: 'Deterministic partial',
          match_tier: 'tier_1_deterministic' as const,
          evidence: []
        }};
        
        const deterministicResult = {
          matches: [],
          unmatchedRequirements: [reqWithFallback],
          prioritizedFacts: candidate.facts
        };

        process.env.OPENROUTER_API_KEY = 'sk-or-test12345678901234567890';
        // Mock open router to return ANALYSIS_FAILED
        globalThis.fetch = async () => new Response(JSON.stringify({
          choices: [{ message: { content: JSON.stringify([{ requirementId: reqSkill.id, classification: 'ANALYSIS_FAILED', supportingFactIds: [], explanation: 'No idea' }]) } }]
        }));

        const result = await matchRequirements({ title: 'Test', requirements: [reqSkill] }, candidate, deterministicResult as any);
        
        assert.equal(result.matches.length, 1);
        assert.equal(result.matches[0].classification, 'PARTIAL_MATCH', 'Should have fallen back to _fallbackMatch');
        assert.equal(result.matches[0].explanation, 'Deterministic partial');
      }
    }
  ];

  const originalFetch = globalThis.fetch;
  for (const test of testCases) {
    total++;
    try {
      await test.run();
      passed++;
      console.log(`✅ ${test.name}`);
    } catch (e) {
      console.error(`❌ FAILED: ${test.name}`);
      console.error(e);
    }
    globalThis.fetch = originalFetch;
  }

  console.log(`\n${passed}/${total} validation tests passed.`);
  if (passed !== total) process.exit(1);
}

runTests();
