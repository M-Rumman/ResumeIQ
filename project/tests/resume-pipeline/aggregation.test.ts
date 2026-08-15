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
