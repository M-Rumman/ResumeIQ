import assert from 'node:assert/strict';
import { runAnalysisPipeline } from '../../api/_lib/analysis-engine/pipeline.js';
import { evaluateScores } from '../../api/_lib/analysis-engine/evaluator.js';
import { validateRewrites } from '../../api/_lib/aiValidation.js';
import { AiPipelineError } from '../../api/_lib/openrouter.js';
import type { JobProfile, CandidateProfile } from '../../api/_lib/analysis-engine/types.js';

type TestCase = { name: string; run: () => Promise<void> | void };

const tests: TestCase[] = [
  {
    name: 'TEST A & B: empty requirements array from parseJobDescription -> pipeline rejects',
    run: async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = async () => ({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify({ title: 'Engineer', requirements: [] }) } }]
        })
      }) as any;
      process.env.OPENROUTER_API_KEY = 'sk-or-mock_key_for_testing';

      try {
        await runAnalysisPipeline({
          resumeText: 'Summary\nGreat.',
          jobDescriptionText: 'Engineer',
          includePremium: true
        });
        assert.fail('Should have thrown on empty requirements');
      } catch (err: any) {
        assert.equal(err.code, 'JD_PARSING_FAILED');
        assert.equal(err.stage, 'parser');
      } finally {
        globalThis.fetch = originalFetch;
      }
    }
  },
  {
    name: 'TEST C: evaluateScores receives zero requirements -> throws',
    run: () => {
      const job: JobProfile = { title: 'Test', company: null, requirements: [] };
      const candidate: CandidateProfile = { 
        contact: null, 
        rawStructure: {}, 
        facts: [] 
      };
      const canonical = { matches: [] };
      
      try {
        evaluateScores(job, candidate, canonical);
        assert.fail('Should have thrown on empty requirements');
      } catch (err: any) {
        assert.equal(err.code, 'INVARIANT_FAILED');
      }
    }
  },
  {
    name: 'TEST D: requirement classification = ANALYSIS_FAILED -> maxPoints is 0',
    run: () => {
      const job: JobProfile = { 
        title: 'Test', 
        company: null, 
        requirements: [{ id: '1', category: 'hard skill', requirement_type: 'skill', normalized_name: 'Python', original_text: 'Python', source_section: '', source_span: [0,0], source_text: 'Python', priority: 'required', confidence: 1 }] 
      };
      const candidate: CandidateProfile = { contact: null, rawStructure: {}, facts: [] };
      const canonical = {
        all: [
          {
            requirement: job.requirements[0],
            classification: 'ANALYSIS_FAILED' as const,
            explanation: 'Failed',
            confidence: 0,
            match_tier: 'tier_3_semantic' as const,
            evidence: []
          }
        ],
        exact: [],
        semantic: [],
        partial: [],
        missingCore: [],
        missingPreferred: [],
        analysisFailed: []
      };
      
      const res = evaluateScores(job, candidate, canonical);
      const detail = res.matchScoreDetails.details.find(d => d.requirement === 'Python');
      assert.ok(detail);
      assert.equal(detail.maxPoints, 0, 'maxPoints should be 0 for ANALYSIS_FAILED');
    }
  },
  {
    name: 'TEST G & H: bullet rewrite validation',
    run: () => {
      const resumeText = 'Developed software for the backend system.';
      const rewrites = [
        {
          before: 'Developed software for the backend system.',
          after: 'Developed backend software that increased system performance by 20%.',
          confidence: 'High',
        },
        {
          before: 'Developed software for the backend system.',
          after: 'Developed backend software.', // No real improvement
          confidence: 'High'
        }
      ];
      
      const validated = validateRewrites(rewrites, resumeText, []);
      // The first rewrite introduces a metric not in the original text (20%), so it should be rejected
      // The second rewrite has no improvement, so it should be rejected.
      assert.equal(validated.length, 0, 'All invalid rewrites should be rejected');
    }
  }
];

async function runTests() {
  let passed = 0;
  for (const test of tests) {
    try {
      await test.run();
      passed++;
    } catch (e: any) {
      console.error(`❌ FAILED: ${test.name}`);
      console.error(e.message);
    }
  }
  console.log(`\n${passed}/${tests.length} tests passed.`);
  if (passed !== tests.length) process.exit(1);
}

runTests();
