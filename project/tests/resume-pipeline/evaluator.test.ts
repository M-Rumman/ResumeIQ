import assert from 'node:assert/strict';
import { evaluateScores } from '../../api/_lib/analysis-engine/evaluator.js';
import type { JobProfile, CandidateProfile, MatchingResult, RequirementMatch } from '../../api/_lib/analysis-engine/types.js';

type TestCase = { name: string; run: () => void };

const baseCandidate: CandidateProfile = {
  contact: { name: 'Test', email: '', phone: '', location: '' },
  facts: [],
  rawStructure: {
    summary: 'Summary',
    experience: ['Exp'],
    projects: ['Proj'],
    skills: ['Skills'],
    education: ['Edu']
  } as any
};

const tests: TestCase[] = [
  {
    name: 'Evaluates required vs preferred mathematically',
    run: () => {
      const job: JobProfile = { title: 'Engineer', requirements: [] };
      
      const reqMatch1: RequirementMatch = {
        requirement: {
          id: '1', category: 'hard skill', priority: 'required',
          normalized_name: 'Python', original_text: '', source_section: '', source_span: [0, 0], source_text: '', requirement_type: 'skill', confidence: 1
        },
        classification: 'EXACT_MATCH',
        confidence: 1,
        evidence: [],
        explanation: ''
      };
      
      const reqMatch2: RequirementMatch = {
        requirement: {
          id: '2', category: 'hard skill', priority: 'preferred',
          normalized_name: 'Java', original_text: '', source_section: '', source_span: [0, 0], source_text: '', requirement_type: 'skill', confidence: 1
        },
        classification: 'MISSING',
        confidence: 1,
        evidence: [],
        explanation: ''
      };

      const matchingResult: MatchingResult = { matches: [reqMatch1, reqMatch2] };
      const evalResult = evaluateScores(job, baseCandidate, matchingResult);

      // New Math: 
      // Required non-core (Python): weight 0.8 -> 8 max points. Achieved: 8 * 1.0 = 8.
      // Preferred non-core (Java): weight 0.3 -> 3 max points. Achieved: 3 * 0.0 = 0.
      // Total Max: 11. Total Achieved: 8.
      // Score = (8 / 11) * 100 = 72.72% -> 73%
      assert.equal(evalResult.matchScore, 73);
      
      const pythonDetail = evalResult.matchScoreDetails.details.find(d => d.requirement === 'Python');
      assert.equal(pythonDetail?.maxPoints, 8);
      assert.equal(pythonDetail?.achievedPoints, 8);

      const javaDetail = evalResult.matchScoreDetails.details.find(d => d.requirement === 'Java');
      assert.equal(javaDetail?.maxPoints, 3);
      assert.equal(javaDetail?.achievedPoints, 0);
    }
  },
  {
    name: 'Evaluates required, preferred, bonus, and non-core requirements correctly',
    run: () => {
      const job: JobProfile = { title: 'Engineer', requirements: [] };
      
      const matches: RequirementMatch[] = [
        {
          // Required Non-Core (Soft skill)
          requirement: { id: '1', category: 'soft skill', priority: 'required', normalized_name: 'ReqNonCore', original_text: '', source_section: '', source_span: [0, 0], source_text: '', requirement_type: 'skill', confidence: 1 },
          classification: 'STRONG_SEMANTIC_MATCH', confidence: 1, evidence: [], explanation: ''
        },
        {
          // Preferred Non-Core (Soft skill)
          requirement: { id: '2', category: 'soft skill', priority: 'preferred', normalized_name: 'PrefNonCore', original_text: '', source_section: '', source_span: [0, 0], source_text: '', requirement_type: 'skill', confidence: 1 },
          classification: 'PARTIAL_MATCH', confidence: 1, evidence: [], explanation: ''
        },
        {
          // Bonus Core (Experience)
          requirement: { id: '3', category: 'experience', priority: 'bonus', normalized_name: 'BonusCore', original_text: '', source_section: '', source_span: [0, 0], source_text: '', requirement_type: 'skill', confidence: 1 },
          classification: 'EXACT_MATCH', confidence: 1, evidence: [], explanation: ''
        }
      ];

      const evalResult = evaluateScores(job, baseCandidate, { matches });

      // ReqNonCore: weight 0.8 -> max 8. Achieved: 8 * 0.85 = 6.8
      // PrefNonCore: weight 0.3 -> max 3. Achieved: 3 * 0.5 = 1.5
      // BonusCore: weight 0.1 -> max 1. Achieved: 1 * 1.0 = 1.0
      // Total Max: 12. Total Achieved: 9.3
      // Percentage: (9.3 / 12) * 100 = 77.5% -> 78%

      assert.equal(evalResult.matchScoreDetails.totalMaxScore, 12);
      assert.equal(evalResult.matchScoreDetails.totalAchievedScore, 9.3);
      assert.equal(evalResult.matchScore, 78);
      
      // Check invariant for all
      for (const d of evalResult.matchScoreDetails.details) {
        assert.ok(d.maxPoints > 0, `Max points for ${d.requirement} must be > 0`);
        assert.ok(d.achievedPoints <= d.maxPoints, `Achieved points ${d.achievedPoints} cannot exceed max ${d.maxPoints}`);
        assert.ok(d.achievedPoints >= 0, `Achieved points cannot be negative`);
      }
    }
  },
  {
    name: 'Prevents score inflation when required skill analysis fails (ANALYSIS_FAILED)',
    run: () => {
      const job: JobProfile = { title: 'Engineer', requirements: [] };
      
      const reqMatch1: RequirementMatch = {
        requirement: {
          id: '1', category: 'hard skill', priority: 'required',
          normalized_name: 'Python', original_text: '', source_section: '', source_span: [0, 0], source_text: '', requirement_type: 'skill', confidence: 1
        },
        classification: 'EXACT_MATCH',
        confidence: 1,
        evidence: [],
        explanation: ''
      };
      
      const reqMatch2: RequirementMatch = {
        requirement: {
          id: '2', category: 'hard skill', priority: 'required',
          normalized_name: 'React', original_text: '', source_section: '', source_span: [0, 0], source_text: '', requirement_type: 'skill', confidence: 1
        },
        classification: 'ANALYSIS_FAILED',
        confidence: 0,
        evidence: [],
        explanation: ''
      };

      const matchingResult: MatchingResult = { matches: [reqMatch1, reqMatch2] };
      const evalResult = evaluateScores(job, baseCandidate, matchingResult);

      // Denominator: 2 Required non-core skills. Python (8) + React (8) = 16 max.
      // Achieved: Python (8) + React (0) = 8.
      // Score = 8/16 = 50% (prevents artificial inflation to 100%)
      assert.equal(evalResult.matchScoreDetails.totalMaxScore, 16);
      assert.equal(evalResult.matchScoreDetails.totalAchievedScore, 8);
      assert.equal(evalResult.matchScore, 50);
    }
  },
  {
    name: 'Does not penalize scores asymmetrically due to model uncertainty (Confidence)',
    run: () => {
      const job: JobProfile = { title: 'Engineer', requirements: [] };
      
      const reqMatch1: RequirementMatch = {
        requirement: {
          id: '1', category: 'hard skill', priority: 'required',
          normalized_name: 'Python', original_text: '', source_section: '', source_span: [0, 0], source_text: '', requirement_type: 'skill', confidence: 1
        },
        classification: 'EXACT_MATCH',
        confidence: 0.5, // High model uncertainty
        evidence: [],
        explanation: ''
      };

      const matchingResult: MatchingResult = { matches: [reqMatch1] };
      const evalResult = evaluateScores(job, baseCandidate, matchingResult);

      // Achieved points should be full contribution (100% of maxPoints), 
      // not scaled down by 0.5 confidence
      assert.equal(evalResult.matchScore, 100);
    }
  },
  {
    name: 'Verifies missing standard sections penalize structure score',
    run: () => {
      const job: JobProfile = { title: 'Engineer', requirements: [] };
      const matchingResult: MatchingResult = { matches: [] };
      const badCandidate = { ...baseCandidate, rawStructure: {} as any };
      
      const evalResult = evaluateScores(job, badCandidate, matchingResult);
      // Expected structure: 25 - (5 * 5 sections) = 0
      const structBreakdown = evalResult.atsBreakdown.find(b => b.label === 'Section Recognition');
      assert.equal(structBreakdown?.score, 0);
    }
  },
  {
    name: 'Action verb check awards full marks and no critique when bullets use strong verbs',
    run: () => {
      const job: JobProfile = { title: 'Engineer', requirements: [] };
      const matchingResult: MatchingResult = { matches: [] };
      
      const strongCandidate: CandidateProfile = {
        ...baseCandidate,
        rawStructure: {
          ...baseCandidate.rawStructure,
          experience: ['Led the team to success.', 'Built a new scalable backend.', 'Ran operations.', 'Mentored juniors.'],
          projects: ['Designed a novel system.', 'Engineered a highly available database.']
        }
      };
      
      const evalResult = evaluateScores(job, strongCandidate, matchingResult);
      const qualityBreakdown = evalResult.atsBreakdown.find(b => b.label === 'Resume Quality');
      
      assert.equal(qualityBreakdown?.score, 25);
      assert.equal(qualityBreakdown?.explanation.includes('Many bullets do not start with strong action verbs.'), false);
    }
  },
  {
    name: 'Action verb check deducts marks and generates critique when bullets use weak verbs',
    run: () => {
      const job: JobProfile = { title: 'Engineer', requirements: [] };
      const matchingResult: MatchingResult = { matches: [] };
      
      const weakCandidate: CandidateProfile = {
        ...baseCandidate,
        rawStructure: {
          ...baseCandidate.rawStructure,
          experience: ['Responsible for the team.', 'Worked on a new backend.'],
          projects: ['Helped with a novel system.', 'Assisted with a database.']
        }
      };
      
      const evalResult = evaluateScores(job, weakCandidate, matchingResult);
      const qualityBreakdown = evalResult.atsBreakdown.find(b => b.label === 'Resume Quality');
      
      assert.equal(qualityBreakdown?.score, 7);
      assert.equal(qualityBreakdown?.explanation.includes('Many bullets do not start with strong action verbs.'), true);
    }
  },
  {
    name: 'Action verb check correctly identifies strong verbs and ignores leading adverbs (Regression Test)',
    run: () => {
      const job: JobProfile = { title: 'Engineer', requirements: [] };
      const matchingResult: MatchingResult = { matches: [] };
      
      const regressionCandidate: CandidateProfile = {
        ...baseCandidate,
        rawStructure: {
          ...baseCandidate.rawStructure,
          experience: [
            'Led the team.',
            'Built a new system.',
            'Ran operations.',
            'Mentored juniors.',
            'Regularly presented research.',
            'Partnered with data science.',
            'Conducted tests.',
            'Designed architecture.',
            'Supported users.',
            'Synthesized findings.'
          ],
          projects: []
        }
      };
      
      const evalResult = evaluateScores(job, regressionCandidate, matchingResult);
      const qualityBreakdown = evalResult.atsBreakdown.find(b => b.label === 'Resume Quality');
      
      assert.equal(qualityBreakdown?.score, 25, 'Score should not be penalized');
      assert.equal(qualityBreakdown?.explanation.includes('Many bullets do not start with strong action verbs.'), false, 'Critique should not be present');
      assert.equal(qualityBreakdown?.explanation.includes('Bullets start with strong action verbs and avoid passive language.'), true, 'Positive feedback should be present');
    }
  },
  {
    name: 'Match score handles 100% and 0% correctly',
    run: () => {
      const job: JobProfile = { title: 'Engineer', requirements: [] };
      const reqPerfect: RequirementMatch = {
        requirement: { id: '1', category: 'hard skill', priority: 'required', normalized_name: 'A', original_text: '', source_section: '', source_span: [0, 0], source_text: '', requirement_type: 'skill', confidence: 1 },
        classification: 'EXACT_MATCH', confidence: 1, evidence: [], explanation: ''
      };
      const evalPerfect = evaluateScores(job, baseCandidate, { matches: [reqPerfect] });
      assert.equal(evalPerfect.matchScore, 100);
      assert.equal(evalPerfect.matchScoreDetails.rawMatchScore, 100);

      const reqZero: RequirementMatch = {
        requirement: { id: '1', category: 'hard skill', priority: 'required', normalized_name: 'A', original_text: '', source_section: '', source_span: [0, 0], source_text: '', requirement_type: 'skill', confidence: 1 },
        classification: 'MISSING', confidence: 1, evidence: [], explanation: ''
      };
      const evalZero = evaluateScores(job, baseCandidate, { matches: [reqZero] });
      assert.equal(evalZero.matchScore, 0);
      assert.equal(evalZero.matchScoreDetails.rawMatchScore, 0);
    }
  }
];

function runTests() {
  let passed = 0;
  for (const test of tests) {
    try {
      test.run();
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
