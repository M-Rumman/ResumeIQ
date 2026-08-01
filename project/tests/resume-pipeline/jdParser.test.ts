import assert from 'node:assert/strict';
import { validateAndProcessRequirements } from '../../api/_lib/analysis-engine/jdParser.js';

type TestCase = { name: string; run: () => void };

const tests: TestCase[] = [
  {
    name: 'extracts explicit skill',
    run: () => {
      const rawJd = "We are looking for someone with strong React.js skills.";
      const parsed = [{
        category: 'hard skill',
        normalized_name: 'React.js',
        original_text: 'strong React.js skills',
        priority: 'required'
      }];
      const result = validateAndProcessRequirements(parsed, rawJd);
      assert.equal(result.length, 1);
      assert.equal(result[0].category, 'hard skill');
      assert.equal(result[0].normalized_name, 'React.js');
    }
  },
  {
    name: 'extracts implicit responsibility',
    run: () => {
      const rawJd = "You will lead the frontend architecture team.";
      const parsed = [{
        category: 'responsibility',
        normalized_name: 'Lead frontend architecture',
        original_text: 'lead the frontend architecture team',
        priority: 'required'
      }];
      const result = validateAndProcessRequirements(parsed, rawJd);
      assert.equal(result.length, 1);
      assert.equal(result[0].category, 'responsibility');
    }
  },
  {
    name: 'distinguishes required vs preferred',
    run: () => {
      const rawJd = "Must have TypeScript. Python is nice to have.";
      const parsed = [
        { normalized_name: 'TypeScript', original_text: 'Must have TypeScript', priority: 'required' },
        { normalized_name: 'Python', original_text: 'Python is nice to have', priority: 'preferred' }
      ];
      const result = validateAndProcessRequirements(parsed, rawJd);
      assert.equal(result.length, 2);
      assert.equal(result[0].priority, 'required');
      assert.equal(result[1].priority, 'preferred');
    }
  },
  {
    name: 'extracts education requirement',
    run: () => {
      const rawJd = "Bachelor's degree in Computer Science or related field required.";
      const parsed = [{
        category: 'education',
        normalized_name: 'Bachelors in CS',
        original_text: "Bachelor's degree in Computer Science",
        degree_level: 'bachelor',
        fields: ['Computer Science'],
        priority: 'required'
      }];
      const result = validateAndProcessRequirements(parsed, rawJd);
      assert.equal(result.length, 1);
      assert.equal(result[0].degree_level, 'bachelor');
      assert.deepEqual(result[0].fields, ['Computer Science']);
    }
  },
  {
    name: 'extracts years requirement',
    run: () => {
      const rawJd = "Requires 6+ years of UX research experience.";
      const parsed = [{
        category: 'experience',
        normalized_name: '6+ years UX research',
        original_text: "6+ years of UX research experience",
        minimum_years: 6,
        domain: 'UX research'
      }];
      const result = validateAndProcessRequirements(parsed, rawJd);
      assert.equal(result.length, 1);
      assert.equal(result[0].minimum_years, 6);
      assert.equal(result[0].domain, 'UX research');
    }
  },
  {
    name: 'extracts tool requirement',
    run: () => {
      const rawJd = "Experience with Figma is mandatory.";
      const parsed = [{
        category: 'tool',
        normalized_name: 'Figma',
        original_text: "Experience with Figma",
      }];
      const result = validateAndProcessRequirements(parsed, rawJd);
      assert.equal(result.length, 1);
      assert.equal(result[0].category, 'tool');
    }
  },
  {
    name: 'extracts location requirement',
    run: () => {
      const rawJd = "This role is based in San Francisco, CA.";
      const parsed = [{
        category: 'location',
        normalized_name: 'San Francisco, CA',
        original_text: "based in San Francisco, CA",
      }];
      const result = validateAndProcessRequirements(parsed, rawJd);
      assert.equal(result.length, 1);
      assert.equal(result[0].category, 'location');
    }
  },
  {
    name: 'enforces no-hallucination behavior',
    run: () => {
      const rawJd = "Looking for a backend engineer with Node.js experience.";
      const parsed = [
        {
          category: 'hard skill',
          normalized_name: 'Node.js',
          original_text: "Node.js experience", // Exists in text
        },
        {
          category: 'hard skill',
          normalized_name: 'GraphQL',
          original_text: "GraphQL API design", // Does NOT exist in text
        }
      ];
      const result = validateAndProcessRequirements(parsed, rawJd);
      assert.equal(result.length, 1); // GraphQL should be dropped
      assert.equal(result[0].normalized_name, 'Node.js');
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
