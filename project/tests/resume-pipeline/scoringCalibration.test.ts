import assert from 'node:assert/strict';
import { evaluateScores } from '../../api/_lib/analysis-engine/evaluator.js';
import type { JobProfile, CandidateProfile, RequirementMatch } from '../../api/_lib/analysis-engine/types.js';

// Dummy candidate profile
const candidate: CandidateProfile = {
  contact: { name: 'Priya', email: 'priya@example.com', phone: '', location: '', links: [] },
  facts: [],
  rawStructure: {
    contact: { name: 'Priya', email: 'priya@example.com', phone: '', location: '', links: [] },
    summary: '',
    experience: ['UX Researcher - 1 year'],
    projects: [],
    skills: [],
    education: [],
    certifications: []
  }
};

export const scoringCalibrationTests = [
  {
    name: 'Scoring: all exact => 100%',
    run: () => {
      const job: JobProfile = {
        id: 'job-1',
        title: 'UX Researcher',
        primary_domain: 'research',
        requirements: [
          { id: 'r1', normalized_name: 'UX Research', original_text: 'UX Research', category: 'experience', priority: 'required', requirement_type: 'experience', confidence: 1, source_section: 'Requirements', source_span: [0,0], source_text: '' },
          { id: 'r2', normalized_name: 'Python', original_text: 'Python', category: 'hard skill', priority: 'required', requirement_type: 'skill', confidence: 1, source_section: 'Requirements', source_span: [0,0], source_text: '' }
        ]
      };

      const matches: RequirementMatch[] = [
        { requirement: job.requirements[0], classification: 'EXACT_MATCH', confidence: 1, match_tier: 'tier_1_deterministic', explanation: 'Exact match', evidence: [] },
        { requirement: job.requirements[1], classification: 'EXACT_MATCH', confidence: 1, match_tier: 'tier_1_deterministic', explanation: 'Exact match', evidence: [] }
      ];

      const res = evaluateScores(job, candidate, { matches });
      assert.equal(res.matchScore, 100);
      assert.match(res.matchScoreDetails.mathematicalExplanation || '', /Total Achieved Points: 18.0 \/ Total Max Points: 18.0/);
    }
  },
  {
    name: 'Scoring: all missing => 0%',
    run: () => {
      const job: JobProfile = {
        id: 'job-2',
        title: 'UX Researcher',
        primary_domain: 'research',
        requirements: [
          { id: 'r1', normalized_name: 'UX Research', original_text: 'UX Research', category: 'experience', priority: 'required', requirement_type: 'experience', confidence: 1, source_section: 'Requirements', source_span: [0,0], source_text: '' }
        ]
      };

      const matches: RequirementMatch[] = [
        { requirement: job.requirements[0], classification: 'MISSING', confidence: 1, match_tier: 'tier_3_semantic', explanation: 'Missing', evidence: [] }
      ];

      const res = evaluateScores(job, candidate, { matches });
      assert.equal(res.matchScore, 0);
      assert.match(res.matchScoreDetails.mathematicalExplanation || '', /Total Achieved Points: 0.0 \/ Total Max Points: 10.0/);
    }
  },
  {
    name: 'Scoring: mixed exact/semantic/partial/missing',
    run: () => {
      const job: JobProfile = {
        id: 'job-3',
        title: 'UX Researcher',
        primary_domain: 'research',
        requirements: [
          { id: 'r1', normalized_name: 'Req 1', original_text: 'Req 1', category: 'experience', priority: 'required', requirement_type: 'experience', confidence: 1, source_section: 'Requirements', source_span: [0,0], source_text: '' }, // weight 1.0 (exact contribution 1.0)
          { id: 'r2', normalized_name: 'Req 2', original_text: 'Req 2', category: 'experience', priority: 'required', requirement_type: 'experience', confidence: 1, source_section: 'Requirements', source_span: [0,0], source_text: '' }, // weight 1.0 (semantic contribution 0.85)
          { id: 'r3', normalized_name: 'Req 3', original_text: 'Req 3', category: 'experience', priority: 'required', requirement_type: 'experience', confidence: 1, source_section: 'Requirements', source_span: [0,0], source_text: '' }, // weight 1.0 (partial contribution 0.5)
          { id: 'r4', normalized_name: 'Req 4', original_text: 'Req 4', category: 'experience', priority: 'required', requirement_type: 'experience', confidence: 1, source_section: 'Requirements', source_span: [0,0], source_text: '' }  // weight 1.0 (missing contribution 0.0)
        ]
      };

      const matches: RequirementMatch[] = [
        { requirement: job.requirements[0], classification: 'EXACT_MATCH', confidence: 1, match_tier: 'tier_1_deterministic', explanation: 'Exact', evidence: [] },
        { requirement: job.requirements[1], classification: 'STRONG_SEMANTIC_MATCH', confidence: 1, match_tier: 'tier_3_semantic', explanation: 'Semantic', evidence: [] },
        { requirement: job.requirements[2], classification: 'PARTIAL_MATCH', confidence: 1, match_tier: 'tier_3_semantic', explanation: 'Partial', evidence: [] },
        { requirement: job.requirements[3], classification: 'MISSING', confidence: 1, match_tier: 'tier_3_semantic', explanation: 'Missing', evidence: [] }
      ];

      // Max: 10 + 10 + 10 + 10 = 40
      // Achieved: 10*1.0 + 10*0.85 + 10*0.5 + 0 = 23.5
      // 23.5 / 40 = 58.75% => round to 59%
      const res = evaluateScores(job, candidate, { matches });
      assert.equal(res.matchScore, 59);
      assert.match(res.matchScoreDetails.mathematicalExplanation || '', /Total Achieved Points: 23.5 \/ Total Max Points: 40.0/);
    }
  },
  {
    name: 'Scoring: analysis failure => 0% achieved but stays in denominator',
    run: () => {
      const job: JobProfile = {
        id: 'job-4',
        title: 'UX Researcher',
        primary_domain: 'research',
        requirements: [
          { id: 'r1', normalized_name: 'Req 1', original_text: 'Req 1', category: 'experience', priority: 'required', requirement_type: 'experience', confidence: 1, source_section: 'Requirements', source_span: [0,0], source_text: '' },
          { id: 'r2', normalized_name: 'Req 2', original_text: 'Req 2', category: 'experience', priority: 'required', requirement_type: 'experience', confidence: 1, source_section: 'Requirements', source_span: [0,0], source_text: '' }
        ]
      };

      const matches: RequirementMatch[] = [
        { requirement: job.requirements[0], classification: 'EXACT_MATCH', confidence: 1, match_tier: 'tier_1_deterministic', explanation: 'Exact', evidence: [] },
        { requirement: job.requirements[1], classification: 'ANALYSIS_FAILED', confidence: 0, match_tier: 'tier_3_semantic', explanation: 'Failed', evidence: [] }
      ];

      // Max: 10 + 10 = 20
      // Achieved: 10*1.0 + 0 = 10
      // 10 / 20 = 50%
      const res = evaluateScores(job, candidate, { matches });
      assert.equal(res.matchScore, 50);
      assert.match(res.matchScoreDetails.mathematicalExplanation || '', /Total Achieved Points: 10.0 \/ Total Max Points: 20.0/);
    }
  },
  {
    name: 'Scoring: zero requirements => 0%',
    run: () => {
      const job: JobProfile = {
        id: 'job-5',
        title: 'UX Researcher',
        primary_domain: 'research',
        requirements: []
      };

      const res = evaluateScores(job, candidate, { matches: [] });
      assert.equal(res.matchScore, 0);
      assert.match(res.matchScoreDetails.mathematicalExplanation || '', /Total Achieved Points: 0.0 \/ Total Max Points: 0.0/);
    }
  },
  {
    name: 'Scoring: compound requirements evaluation',
    run: () => {
      const job: JobProfile = {
        id: 'job-6',
        title: 'UX Researcher',
        primary_domain: 'research',
        requirements: [
          { id: 'r1', normalized_name: 'Qualitative and Quantitative Research', original_text: 'Qualitative and Quantitative Research', category: 'experience', priority: 'required', requirement_type: 'experience', confidence: 1, source_section: 'Requirements', source_span: [0,0], source_text: '' }
        ]
      };

      const matches: RequirementMatch[] = [
        { requirement: job.requirements[0], classification: 'PARTIAL_MATCH', confidence: 1, match_tier: 'tier_3_semantic', explanation: 'Only qualitative evidenced', evidence: [] }
      ];

      const res = evaluateScores(job, candidate, { matches });
      assert.equal(res.matchScore, 50); // Partial contribution is 0.5
    }
  },
  {
    name: 'Scoring: false semantic evidence (rejected => 0%)',
    run: () => {
      const job: JobProfile = {
        id: 'job-7',
        title: 'UX Researcher',
        primary_domain: 'research',
        requirements: [
          { id: 'r1', normalized_name: 'Mentorship and coaching', original_text: 'Mentorship and coaching', category: 'responsibility', priority: 'required', requirement_type: 'responsibility', confidence: 1, source_section: 'Requirements', source_span: [0,0], source_text: '' }
        ]
      };

      // If the evaluator rejected the match because there is zero mentoring evidence, it classifies as MISSING (0%)
      const matches: RequirementMatch[] = [
        { requirement: job.requirements[0], classification: 'MISSING', confidence: 1, match_tier: 'tier_3_semantic', explanation: 'No mentorship found', evidence: [] }
      ];

      const res = evaluateScores(job, candidate, { matches });
      assert.equal(res.matchScore, 0);
    }
  },
  {
    name: 'Scoring: strong evidence (preserved exact match => 100%)',
    run: () => {
      const job: JobProfile = {
        id: 'job-8',
        title: 'UX Researcher',
        primary_domain: 'research',
        requirements: [
          { id: 'r1', normalized_name: 'Built centralized repository', original_text: 'Built centralized repository', category: 'hard skill', priority: 'required', requirement_type: 'skill', confidence: 1, source_section: 'Requirements', source_span: [0,0], source_text: '' }
        ]
      };

      const matches: RequirementMatch[] = [
        { requirement: job.requirements[0], classification: 'EXACT_MATCH', confidence: 1, match_tier: 'tier_1_deterministic', explanation: 'Built centralized repository', evidence: [] }
      ];

      const res = evaluateScores(job, candidate, { matches });
      assert.equal(res.matchScore, 100);
    }
  }
];

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('scoringCalibration.test.ts')) {
  console.log('Running scoring calibration tests individually...');
  let passed = 0;
  for (const test of scoringCalibrationTests) {
    try {
      test.run();
      console.log(`✅ PASS: ${test.name}`);
      passed++;
    } catch (e: any) {
      console.error(`❌ FAIL: ${test.name}`);
      console.error(e);
    }
  }
  console.log(`\n${passed}/${scoringCalibrationTests.length} tests passed.`);
  if (passed !== scoringCalibrationTests.length) process.exit(1);
}
