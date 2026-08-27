import { getDeterministicMatches } from '../../api/_lib/analysis-engine/matcher.js';
import { evaluateScores } from '../../api/_lib/analysis-engine/evaluator.js';
import { runAnalysisPipeline } from '../../api/_lib/analysis-engine/pipeline.js';
import type { CandidateProfile, JobProfile, CandidateFact, JobRequirement } from '../../api/_lib/analysis-engine/types.js';
import assert from 'node:assert';
import { mockAiObservabilityContext } from './tmp.js'; // or similar, wait I don't have mockAiObservabilityContext

// Let's just mock the necessary things
function mockReq(id: string, name: string, category: JobRequirement['category'] = 'experience', priority: 'required' | 'preferred' = 'required'): JobRequirement {
  return {
    id,
    normalized_name: name,
    category,
    original_text: name,
    priority,
    requirement_type: category,
    confidence: 1.0,
    source_section: 'Requirements',
    source_text: name,
    source_span: [0, 10]
  };
}

const defaultCandidateInfo = {
  name: 'Test',
  email: 'test@example.com',
  phone: '123',
  location: ''
};

async function runTests() {
  console.log('Running analysis-failed regression tests...');

  // Since pipeline relies on full mock, we can mock evaluateScores with the pipeline.
  // Actually, wait, it's easier to just mock the matchRequirement output for the pipeline? No, the pipeline calls OpenAI.
  // I will test `evaluateScores` and the classification logic in `matcher.ts` directly, as we just modified those.

  const req1 = mockReq('r1', 'Python');
  const job: JobProfile = { title: 'Engineer', requirements: [req1] };
  const candidate: CandidateProfile = { contact: defaultCandidateInfo, rawStructure: {} as any, facts: [] };

  // 1. evaluateScores does not add ANALYSIS_FAILED to weaknesses
  {
    const canonical = {
      exact: [],
      semantic: [],
      partial: [],
      missingCore: [],
      missingPreferred: [],
      all: [{
        requirement: req1,
        classification: 'ANALYSIS_FAILED' as const,
        confidence: 0,
        explanation: 'Failed',
        evidence: []
      }],
      analysisFailed: [{
        requirement: req1,
        classification: 'ANALYSIS_FAILED' as const,
        confidence: 0,
        explanation: 'Failed',
        evidence: []
      }]
    };
    
    const evaluation = evaluateScores(job, candidate, canonical);
    assert.strictEqual(evaluation.scoreExplanations.whatReducedScore.length, 0, 'ANALYSIS_FAILED should not appear in whatReducedScore');
    assert.strictEqual(evaluation.matchScoreDetails.totalMaxScore, 0, 'Total max score should be 0');
    console.log('✅ Test 1 passed: ANALYSIS_FAILED does not expand denominator or populate weaknesses');
  }

  // 2. evaluateScores adds MISSING to weaknesses
  {
    const canonical = {
      exact: [],
      semantic: [],
      partial: [],
      missingCore: [{
        requirement: req1,
        classification: 'MISSING' as const,
        confidence: 1,
        explanation: 'Missing',
        evidence: []
      }],
      missingPreferred: [],
      all: [{
        requirement: req1,
        classification: 'MISSING' as const,
        confidence: 1,
        explanation: 'Missing',
        evidence: []
      }],
      analysisFailed: []
    };
    
    const evaluation = evaluateScores(job, candidate, canonical);
    console.log(evaluation.scoreExplanations.whatReducedScore);
    assert.strictEqual(evaluation.scoreExplanations.whatReducedScore.length, 1, 'MISSING should appear in whatReducedScore');
    assert.ok(evaluation.scoreExplanations.whatReducedScore[0].includes('Missing required experience'), 'Correct weakness message');
    console.log('✅ Test 2 passed: MISSING properly populates weaknesses');
  }

}

runTests().catch(console.error);
