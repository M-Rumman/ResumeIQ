import test from 'node:test';
import assert from 'node:assert';
import { runAnalysisPipeline } from '../api/_lib/analysis-engine/pipeline.js';

test('pipeline explicitly fails on zero requirements instead of defaulting to 100%', async () => {
  const result = await runAnalysisPipeline({
    resumeText: 'Software Engineer with 10 years of experience in TypeScript and React. Graduated with a B.S. in Computer Science.',
    jobDescriptionText: '', // Empty JD, parsing will fallback and might produce zero requirements if too short
    includePremium: true,
  });

  if (result.tier !== 'premium') {
    assert.fail('Expected premium tier result');
  }

  const legacyReport = result.legacyReport as any;
  
  // Explicitly verifying it correctly sets zero matchScore instead of 100%
  assert.equal(legacyReport.matchScore, 0, 'Match score should be 0, not 100% when there are zero requirements');
  assert.equal(legacyReport.keywordCompatibility.overallMatch, 0, 'Keyword match should be 0, not 100%');
  
  // Hiring Manager Assessment must say the analysis is incomplete
  assert.equal(legacyReport.hiringManagerAssessment.overallDecision, 'Analysis Incomplete', 'Must explicitly mark analysis as incomplete');
  
  // Gaps arrays shouldn't contain fake 100% success states
  assert.equal(legacyReport.hiringManagerAssessment.topReasonsToInterview.length, 0);
  assert.equal(legacyReport.hiringManagerAssessment.topReasonsForRejection.length, 0);
});
