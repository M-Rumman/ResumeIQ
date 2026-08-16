import assert from 'node:assert/strict';
import { evaluateScores } from '../../api/_lib/analysis-engine/evaluator.js';
import type { JobProfile, CandidateProfile, MatchingResult, RequirementMatch, JobRequirement } from '../../api/_lib/analysis-engine/types.js';

const mockCandidate: CandidateProfile = {
  rawStructure: {},
  contact: { name: 'Test', email: 'test@example.com' },
  facts: []
};

function createRequirement(id: string, name: string, priority: 'required' | 'preferred' | 'nice_to_have' = 'required', category: any = 'hard skill'): JobRequirement {
  return {
    id,
    normalized_name: name,
    priority,
    category,
    requirement_type: 'skill',
    confidence: 1,
    original_text: name,
    source_section: 'Requirements',
    source_span: [0, 10],
    source_text: name
  };
}

function createMatch(requirement: JobRequirement, classification: any): RequirementMatch {
  return {
    requirement,
    classification,
    confidence: 1,
    explanation: 'Test',
    match_tier: 'tier_1_deterministic',
    evidence: []
  };
}

export async function runScoringTests() {
  console.log('\n--- Running Scoring Integrity Regression Tests ---');
  
  // 1. 0 Requirements (Empty JD)
  {
    const job: JobProfile = { title: 'Empty', company: 'Test', requirements: [] };
    const matches: MatchingResult = { matches: [] };
    const result = evaluateScores(job, mockCandidate, matches);
    assert.equal(result.matchScore, 0, 'Score should be 0 for 0 requirements, not 100%');
    console.log('✅ Passed: 0 Requirements -> 0%');
  }

  // 2. All Exact Matches
  {
    const req1 = createRequirement('1', 'Req 1');
    const req2 = createRequirement('2', 'Req 2');
    const job: JobProfile = { title: 'Test', company: 'Test', requirements: [req1, req2] };
    const matches: MatchingResult = {
      matches: [
        createMatch(req1, 'EXACT_MATCH'),
        createMatch(req2, 'EXACT_MATCH')
      ]
    };
    const result = evaluateScores(job, mockCandidate, matches);
    assert.equal(result.matchScore, 100, 'Score should be 100% for all exact matches');
    assert.equal(result.matchScoreDetails.totalMaxScore, 16, 'Total max score should be 16 (0.8 * 10 * 2 for non-core required)');
    assert.equal(result.matchScoreDetails.totalAchievedScore, 16, 'Total achieved score should be 16');
    console.log('✅ Passed: All Exact Matches -> 100%');
  }

  // 3. Mixed Matches (Semantic 0.85, Partial 0.5)
  {
    const req1 = createRequirement('1', 'Req 1');
    const req2 = createRequirement('2', 'Req 2');
    const job: JobProfile = { title: 'Test', company: 'Test', requirements: [req1, req2] };
    const matches: MatchingResult = {
      matches: [
        createMatch(req1, 'STRONG_SEMANTIC_MATCH'), // 0.85 contribution
        createMatch(req2, 'PARTIAL_MATCH') // 0.5 contribution
      ]
    };
    const result = evaluateScores(job, mockCandidate, matches);
    // 0.85 * 8 + 0.5 * 8 = 6.8 + 4 = 10.8
    // Max = 16
    // 10.8 / 16 = 0.675 -> 68%
    assert.equal(result.matchScore, 68, 'Score should accurately reflect semantic and partial weights');
    assert.equal(result.matchScoreDetails.totalAchievedScore, 10.8, 'Total achieved score should be exactly 10.8');
    console.log(`✅ Passed: Mixed Matches -> ${result.matchScore}% (10.8 / 16)`);
  }

  // 4. Missing Requirements (0 points awarded, remains in denominator)
  {
    const req1 = createRequirement('1', 'Req 1');
    const req2 = createRequirement('2', 'Req 2');
    const job: JobProfile = { title: 'Test', company: 'Test', requirements: [req1, req2] };
    const matches: MatchingResult = {
      matches: [
        createMatch(req1, 'EXACT_MATCH'),
        createMatch(req2, 'MISSING')
      ]
    };
    const result = evaluateScores(job, mockCandidate, matches);
    assert.equal(result.matchScore, 50, 'Score should be 50% for 1 exact and 1 missing');
    console.log('✅ Passed: Missing Requirements -> 50%');
  }

  // 5. Failed Analysis (Remains in denominator, 0 points awarded)
  {
    const req1 = createRequirement('1', 'Req 1');
    const req2 = createRequirement('2', 'Req 2');
    const job: JobProfile = { title: 'Test', company: 'Test', requirements: [req1, req2] };
    const matches: MatchingResult = {
      matches: [
        createMatch(req1, 'EXACT_MATCH'),
        createMatch(req2, 'ANALYSIS_FAILED')
      ]
    };
    const result = evaluateScores(job, mockCandidate, matches);
    assert.equal(result.matchScore, 50, 'Score should be 50% for 1 exact and 1 failed. Failed analysis must NOT give a free pass.');
    
    const failedDetail = result.matchScoreDetails.details.find(d => d.requirement === 'Req 2');
    assert.equal(failedDetail?.maxPoints, 8, 'Failed analysis must contribute to max points');
    assert.equal(failedDetail?.achievedPoints, 0, 'Failed analysis must not award achieved points');
    console.log('✅ Passed: Failed Analysis -> No Free Pass (50%)');
  }

  // 6. Duplicate Requirements (Denominator not inflated)
  {
    const req1 = createRequirement('1', 'Req 1');
    const job: JobProfile = { title: 'Test', company: 'Test', requirements: [req1] };
    const matches: MatchingResult = {
      matches: [
        createMatch(req1, 'PARTIAL_MATCH'),
        createMatch(req1, 'EXACT_MATCH'), // The better match should be kept
        createMatch(req1, 'MISSING')
      ]
    };
    const result = evaluateScores(job, mockCandidate, matches);
    assert.equal(result.matchScore, 100, 'Score should be 100% since EXACT_MATCH is the best duplicate');
    assert.equal(result.matchScoreDetails.totalMaxScore, 8, 'Max score should not be inflated by duplicates');
    assert.equal(result.matchScoreDetails.details.length, 1, 'Details should only contain deduplicated requirements');
    console.log('✅ Passed: Duplicate Requirements Deduplication -> 100%');
  }

  // 7. Dropped Requirements Silently Recovered
  {
    const req1 = createRequirement('1', 'Req 1');
    const req2 = createRequirement('2', 'Req 2'); // This will be dropped from matches array
    const job: JobProfile = { title: 'Test', company: 'Test', requirements: [req1, req2] };
    const matches: MatchingResult = {
      matches: [
        createMatch(req1, 'EXACT_MATCH')
      ]
    };
    const result = evaluateScores(job, mockCandidate, matches);
    assert.equal(result.matchScore, 50, 'Score should be 50% because the dropped requirement is re-inserted as ANALYSIS_FAILED');
    assert.equal(result.matchScoreDetails.details.length, 2, 'Dropped requirement must appear in details');
    const droppedDetail = result.matchScoreDetails.details.find(d => d.requirement === 'Req 2');
    assert.equal(droppedDetail?.classification, 'ANALYSIS_FAILED', 'Dropped requirement defaults to ANALYSIS_FAILED');
    console.log('✅ Passed: Dropped Requirements Recovery -> 50%');
  }

  console.log('🎉 All Scoring Integrity Regression Tests Passed!\n');
}

runScoringTests().catch(console.error);
