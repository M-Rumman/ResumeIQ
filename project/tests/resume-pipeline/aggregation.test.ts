import assert from 'node:assert/strict';
import { matchRequirements, getDeterministicMatches } from '../../api/_lib/analysis-engine/matcher.js';
import type { JobRequirement, CandidateFact, JobProfile, CandidateProfile } from '../../api/_lib/analysis-engine/types.js';

type TestCase = { name: string; run: () => Promise<void> };

const tests: TestCase[] = [
  {
    name: 'Deterministic aggregation: Collects multiple facts for EXACT_MATCH',
    run: async () => {
      const job: JobProfile = {
        title: 'Software Engineer',
        requirements: [{
          id: 'req-python',
          category: 'skill',
          normalized_name: 'Python',
          original_text: 'Python',
          source_section: 'Requirements',
          source_span: [0, 6],
          source_text: 'Python',
          priority: 'required',
          requirement_type: 'skill',
          confidence: 1
        }]
      };

      const candidate: CandidateProfile = {
        contact: { name: 'Test', email: '', phone: '', location: '' },
        facts: [
          {
            id: 'fact-1',
            type: 'experience',
            normalizedName: 'Python development',
            rawText: 'Built backend services using Python and Django.',
            sourceSection: 'Experience',
            evidence: 'Built backend services using Python and Django.'
          },
          {
            id: 'fact-2',
            type: 'experience',
            normalizedName: 'Data Analysis in Python',
            rawText: 'Wrote data analysis scripts in Python.',
            sourceSection: 'Experience',
            evidence: 'Wrote data analysis scripts in Python.'
          },
          {
            id: 'fact-3',
            type: 'skill',
            normalizedName: 'Python',
            rawText: 'Python',
            sourceSection: 'Skills',
            evidence: 'Python'
          }
        ],
        rawStructure: {} as any
      };

      const result = await matchRequirements(job, candidate, getDeterministicMatches(job, candidate));
      assert.equal(result.matches[0].classification, 'EXACT_MATCH', 'Should match exactly deterministically');
      assert.equal(result.matches[0].evidence.length, 3, 'Should collect all 3 Python facts');
    }
  },
  {
    name: 'LLM Aggregation: Combines multiple weak facts to form a STRONG_SEMANTIC_MATCH',
    run: async () => {
      const job: JobProfile = {
        title: 'UX Researcher',
        requirements: [{
          id: 'req-qual-quant',
          category: 'skill',
          normalized_name: 'Qualitative and quantitative research methods',
          original_text: 'Qualitative and quantitative research methods',
          source_section: 'Requirements',
          source_span: [0, 45],
          source_text: 'Qualitative and quantitative research methods',
          priority: 'required',
          requirement_type: 'skill',
          confidence: 1
        }]
      };

      const candidate: CandidateProfile = {
        contact: { name: 'Test', email: '', phone: '', location: '' },
        facts: [
          {
            id: 'fact-qual',
            type: 'experience',
            normalizedName: 'Qualitative insights',
            rawText: 'Gathered qualitative insights from user interviews.',
            sourceSection: 'Experience',
            evidence: 'Gathered qualitative insights from user interviews.'
          },
          {
            id: 'fact-quant',
            type: 'experience',
            normalizedName: 'Quantitative analysis',
            rawText: 'Performed quantitative analysis on survey data.',
            sourceSection: 'Experience',
            evidence: 'Performed quantitative analysis on survey data.'
          }
        ],
        rawStructure: {} as any
      };

      const originalFetch = globalThis.fetch;
      globalThis.fetch = async () => ({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify({
            matches: [
              {
                requirementId: 'req-qual-quant',
                classification: 'STRONG_SEMANTIC_MATCH',
                supportingFactId: ['fact-qual', 'fact-quant'],
                supportingFactIds: ['fact-qual', 'fact-quant'],
                explanation: 'Candidate has both qualitative and quantitative experience.'
              }
            ]
          }) } }]
        })
      }) as any;
      
      process.env.OPENROUTER_API_KEY = 'sk-or-mock_key_for_testing';

      try {
        const result = await matchRequirements(job, candidate, getDeterministicMatches(job, candidate));
        assert.equal(result.matches[0].classification, 'STRONG_SEMANTIC_MATCH');
        assert.equal(result.matches[0].evidence.length, 2, 'Should aggregate both facts via LLM');
      } finally {
        globalThis.fetch = originalFetch;
      }
    }
  },
  {
    name: 'evaluateScores: enforces mathematical bounds and precision without intermediate rounding',
    run: async () => {
      const { evaluateScores } = await import('../../api/_lib/analysis-engine/evaluator.js');
      
      const job: JobProfile = {
        title: 'Backend Engineer',
        requirements: [
          {
            id: 'req-1',
            category: 'experience',
            normalized_name: 'Node.js',
            original_text: 'Node.js',
            source_section: 'Requirements',
            source_span: [0, 10],
            source_text: 'Node.js',
            priority: 'required',
            requirement_type: 'experience',
            confidence: 1
          },
          {
            id: 'req-2',
            category: 'skill',
            normalized_name: 'AWS',
            original_text: 'AWS',
            source_section: 'Requirements',
            source_span: [0, 3],
            source_text: 'AWS',
            priority: 'preferred',
            requirement_type: 'skill',
            confidence: 1
          }
        ]
      };

      const candidate: CandidateProfile = { contact: {} as any, facts: [], rawStructure: {} as any };

      const canonicalMatches = {
        matches: [
          {
            requirement: job.requirements[0],
            classification: 'STRONG_SEMANTIC_MATCH' as const, // multiplier 0.85
            confidence: 0.9,
            explanation: '',
            match_tier: 'tier_3_semantic' as const,
            evidence: []
          },
          {
            requirement: job.requirements[1],
            classification: 'PARTIAL_MATCH' as const, // multiplier 0.5
            confidence: 0.8,
            explanation: '',
            match_tier: 'tier_3_semantic' as const,
            evidence: []
          },
          {
            // Hallucinated requirement! Should be ignored because it is not in the JD.
            requirement: { ...job.requirements[0], id: 'req-hallucinated', normalized_name: 'Hallucinated' },
            classification: 'EXACT_MATCH' as const,
            confidence: 1,
            explanation: '',
            match_tier: 'tier_3_semantic' as const,
            evidence: []
          }
        ]
      };

      const result = evaluateScores(job, candidate, canonicalMatches);

      // 1. Hallucinated requirement should be completely ignored from details and denominator.
      // 2 requirements from JD.
      assert.equal(result.matchScoreDetails.details.length, 2, 'Should drop hallucinated requirement');

      // Check Req 1
      const req1Detail = result.matchScoreDetails.details.find(d => d.requirement === 'Node.js');
      assert.ok(req1Detail, 'Missing req 1 detail');
      assert.equal(req1Detail.maxPoints, 10, 'Required experience weight = 1.0 -> 10 points');
      assert.equal(req1Detail.achievedPoints, 8.5, '10 * 0.85 = 8.5 achieved points precisely');

      // Check Req 2
      const req2Detail = result.matchScoreDetails.details.find(d => d.requirement === 'AWS');
      assert.ok(req2Detail, 'Missing req 2 detail');
      assert.equal(req2Detail.maxPoints, 3, 'Preferred non-core skill weight = 0.3 -> 3 points');
      assert.equal(req2Detail.achievedPoints, 1.5, '3 * 0.5 = 1.5 achieved points precisely');

      // Verify exact aggregation
      assert.equal(result.matchScoreDetails.totalMaxScore, 13, '10 + 3 = 13 total max');
      assert.equal(result.matchScoreDetails.totalAchievedScore, 10, '8.5 + 1.5 = 10 total achieved');

      // Verify bounds
      assert.ok(req1Detail.achievedPoints >= 0 && req1Detail.achievedPoints <= req1Detail.maxPoints);
      assert.ok(req2Detail.achievedPoints >= 0 && req2Detail.achievedPoints <= req2Detail.maxPoints);
    }
  }
];

async function runTests() {
  let passed = 0;
  for (const test of tests) {
    try {
      await test.run();
      passed++;
    } catch (e) {
      console.error(`\n❌ FAILED: ${test.name}`);
      console.error(e);
    }
  }
  console.log(`\n${passed}/${tests.length} tests passed.`);
  if (passed !== tests.length) process.exit(1);
}

runTests();
