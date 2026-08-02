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

      // Total max = (0.8 * 10) for Python + (0.3 * 10) for Java = 8 + 3 = 11.
      // Achieved = (8 * 1) + 0 = 8.
      // Match Score = 8/11 = 73%
      assert.equal(evalResult.matchScore, Math.round((8/11)*100));
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
      const job: JobProfile = { title: 'Engineer', requirements: [], priorities: [] };
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
      const job: JobProfile = { title: 'Engineer', requirements: [], priorities: [] };
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
      const job: JobProfile = { title: 'Engineer', requirements: [], priorities: [] };
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
