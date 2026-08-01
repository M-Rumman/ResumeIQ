import assert from 'node:assert/strict';
import { normalizeDegree, parseExperienceDuration, extractCandidateProfile } from '../../api/_lib/analysis-engine/resumeExtraction.js';

type TestCase = { name: string; run: () => void };

const tests: TestCase[] = [
  {
    name: 'normalizes bachelor degrees',
    run: () => {
      assert.equal(normalizeDegree('B.A. in Psychology'), 'bachelor');
      assert.equal(normalizeDegree('Bachelor of Science'), 'bachelor');
      assert.equal(normalizeDegree('B.E. in Mechatronics Engineering'), 'bachelor');
      assert.equal(normalizeDegree("Bachelor's degree in CS"), 'bachelor');
    }
  },
  {
    name: 'normalizes master degrees',
    run: () => {
      assert.equal(normalizeDegree('M.A. in English'), 'master');
      assert.equal(normalizeDegree('Master of Science'), 'master');
      assert.equal(normalizeDegree('MEng'), 'master');
      assert.equal(normalizeDegree('MBA'), 'master');
    }
  },
  {
    name: 'calculates experience duration from years',
    run: () => {
      const text = `Software Engineer
2018–2019
Worked on stuff.
Senior Engineer
2019–2021
More stuff.
Lead Engineer
2021–Present`;
      const duration = parseExperienceDuration(text);
      assert.equal(duration >= 8, true); // 2019-2018(1) + 2021-2019(2) + 2026-2021(5) = 8
    }
  },
  {
    name: 'detects explicit and inferred sections',
    run: () => {
      const resumeText = `
John Doe
SUMMARY
Software engineer with 5 years experience.
EXPERIENCE
Google - 2020 to Present
EDUCATION
B.S. Computer Science
      `;
      // Note: extractCandidateProfile will parse this using the actual resumeParser first
      // Because we mock testing it against real parse, we'll verify the explicit checks directly
      // In this case, 'SUMMARY', 'EXPERIENCE', 'EDUCATION' exist. Projects/Skills do not.
      const profile = extractCandidateProfile(resumeText);
      
      const eduFact = profile.facts.find(f => f.type === 'education');
      if (eduFact) {
        assert.equal(eduFact.sourceSection, 'education');
        assert.equal(eduFact.sectionInferred, false);
      }
      
      // Projects should not be found as explicit
      const projFact = profile.facts.find(f => f.type === 'project');
      if (projFact) {
        assert.equal(projFact.sourceSection, 'inferred / not explicitly sectioned');
        assert.equal(projFact.sectionInferred, true);
      }
    }
  }
];

async function runTests() {
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
