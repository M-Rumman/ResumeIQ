import assert from 'node:assert/strict';
import { generateRecruiterSummary, generateNarrativeSynthesis } from '../../api/_lib/analysis-engine/pipeline.js';
import type { CanonicalRequirements } from '../../api/_lib/analysis-engine/types.js';

function createMockCanonical(overrides: Partial<CanonicalRequirements> = {}): CanonicalRequirements {
  return {
    exact: [],
    semantic: [],
    partial: [],
    missingCore: [],
    missingPreferred: [],
    analysisFailed: [],
    ...overrides
  };
}

export const hiringSummaryTests = [
  {
    name: 'Hiring Summary: Strong Match with Exact/Semantic matches and no missing requirements',
    run: () => {
      const canonical = createMockCanonical({
        exact: [
          { requirement: { normalized_name: 'Python', category: 'skill' }, classification: 'EXACT_MATCH', explanation: '', evidence: [] },
          { requirement: { normalized_name: 'Machine Learning', category: 'domain' }, classification: 'EXACT_MATCH', explanation: '', evidence: [] }
        ],
        semantic: [
          { requirement: { normalized_name: 'Data Analysis', category: 'skill' }, classification: 'STRONG_SEMANTIC_MATCH', explanation: '', evidence: [] }
        ]
      });

      const summary = generateRecruiterSummary(canonical, 92);
      assert.ok(summary.includes('highly competitive match'));
      assert.ok(summary.includes('definitive strengths in Python and Machine Learning'));
      assert.ok(summary.includes('warrants moving forward to an interview'));

      const narrative = generateNarrativeSynthesis([...canonical.exact, ...canonical.semantic], 92);
      assert.ok(narrative.includes('Python, Machine Learning, and Data Analysis'));
    }
  },
  {
    name: 'Hiring Summary: Weak Match missing critical experience requirements',
    run: () => {
      const canonical = createMockCanonical({
        semantic: [
          { requirement: { normalized_name: 'Communication', category: 'skill' }, classification: 'STRONG_SEMANTIC_MATCH', explanation: '', evidence: [] }
        ],
        missingCore: [
          { requirement: { normalized_name: '6+ years experience', category: 'qualification' }, classification: 'MISSING', explanation: '', evidence: [] },
          { requirement: { normalized_name: 'Mentoring junior developers', category: 'responsibility' }, classification: 'MISSING', explanation: '', evidence: [] }
        ]
      });

      const summary = generateRecruiterSummary(canonical, 45);
      assert.ok(summary.includes('weak match'));
      assert.ok(summary.includes('critical requirements such as 6+ years experience and Mentoring junior developers'));
      assert.ok(summary.includes('unlikely to advance in the hiring process'));
    }
  },
  {
    name: 'Hiring Summary: Potential Match with general missing skills',
    run: () => {
      const canonical = createMockCanonical({
        exact: [
          { requirement: { normalized_name: 'Java', category: 'skill' }, classification: 'EXACT_MATCH', explanation: '', evidence: [] }
        ],
        missingCore: [
          { requirement: { normalized_name: 'AWS', category: 'skill' }, classification: 'MISSING', explanation: '', evidence: [] },
          { requirement: { normalized_name: 'Docker', category: 'skill' }, classification: 'MISSING', explanation: '', evidence: [] }
        ]
      });

      const summary = generateRecruiterSummary(canonical, 65);
      assert.ok(summary.includes('potential match'));
      assert.ok(summary.includes('There are 2 stated requirements with no matching evidence'));
      assert.ok(summary.includes('additional screening'));
    }
  },
  {
    name: 'Hiring Summary: Analysis Failures',
    run: () => {
      const canonical = createMockCanonical({
        analysisFailed: [
          { requirement: { normalized_name: 'System Design', category: 'skill' }, classification: 'ANALYSIS_FAILED', explanation: '', evidence: [] }
        ]
      });

      // No exact/semantic matches but has failed
      const summary1 = generateRecruiterSummary(canonical, 0);
      assert.ok(summary1.includes('could not be completed securely'));

      // Mixed with exact match
      const canonical2 = createMockCanonical({
        exact: [
          { requirement: { normalized_name: 'Java', category: 'skill' }, classification: 'EXACT_MATCH', explanation: '', evidence: [] }
        ],
        analysisFailed: [
          { requirement: { normalized_name: 'System Design', category: 'skill' }, classification: 'ANALYSIS_FAILED', explanation: '', evidence: [] }
        ]
      });

      const summary2 = generateRecruiterSummary(canonical2, 70);
      assert.ok(summary2.includes('Note that 1 requirement(s) could not be fully analyzed.'));
    }
  }
];

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('hiringSummary.test.ts')) {
  console.log('Running hiring summary tests individually...');
  let passed = 0;
  for (const test of hiringSummaryTests) {
    try {
      test.run();
      console.log(`✅ PASS: ${test.name}`);
      passed++;
    } catch (e: any) {
      console.error(`❌ FAIL: ${test.name}`);
      console.error(e);
    }
  }
  console.log(`\n${passed}/${hiringSummaryTests.length} tests passed.`);
  if (passed !== hiringSummaryTests.length) process.exit(1);
}
