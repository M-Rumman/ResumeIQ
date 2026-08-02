import assert from 'node:assert/strict';
import { matchRequirements } from '../../api/_lib/analysis-engine/matcher.js';
import type { JobRequirement, CandidateFact, JobProfile, CandidateProfile } from '../../api/_lib/analysis-engine/types.js';

type TestCase = { name: string; run: () => Promise<void> };

// Mock callOpenRouter specifically for these tests since LLMs shouldn't run in unit tests.
// Wait, actually, the user wants to ensure exact matches work without LLM, and the rest fail gracefully.
// Let's test the EXACT MATCH capabilities which bypass the LLM entirely!

const tests: TestCase[] = [
  {
    name: 'Education exact match: B.E. Mechatronics vs Bachelors Mechatronics',
    run: async () => {
      const job: JobProfile = {
        title: 'Engineer',
        requirements: [{
          id: '1',
          category: 'education',
          normalized_name: 'Bachelor\'s degree in Mechatronics Engineering',
          original_text: 'B.S. or B.A. in Mechatronics',
          source_section: 'Requirements',
          source_span: [0, 10],
          source_text: 'B.S.',
          priority: 'required',
          requirement_type: 'education',
          confidence: 1,
          degree_level: 'bachelor',
          fields: ['mechatronics engineering']
        }]
      };

      const candidate: CandidateProfile = {
        contact: { name: 'Test', email: '', phone: '', location: '' },
        facts: [{
          id: 'f1',
          type: 'education',
          normalizedName: 'B.E. in Mechatronics Engineering',
          rawText: 'Bachelor of Engineering in Mechatronics Engineering',
          sourceSection: 'Education',
          evidence: 'Bachelor of Engineering in Mechatronics Engineering',
          degree_level: 'bachelor',
          fields: ['mechatronics engineering']
        }],
        rawStructure: {} as any
      };

      const result = await matchRequirements(job, candidate);
      assert.equal(result.matches[0].classification, 'EXACT_MATCH');
      assert.equal(result.matches[0].evidence[0].evidence_strength, 'primary');
    }
  },
  {
    name: 'Missing requirement yields MISSING (e.g. ROS)',
    run: async () => {
      const job: JobProfile = {
        title: 'Engineer',
        requirements: [{
          id: '1',
          category: 'hard skill',
          normalized_name: 'ROS',
          original_text: 'Robot Operating System (ROS)',
          source_section: 'Requirements',
          source_span: [0, 10],
          source_text: 'ROS',
          priority: 'required',
          requirement_type: 'skill',
          confidence: 1
        }]
      };

      const candidate: CandidateProfile = {
        contact: { name: 'Test', email: '', phone: '', location: '' },
        facts: [{
          id: 'f1',
          type: 'experience',
          normalizedName: 'Software Engineer',
          rawText: 'Did web dev stuff',
          sourceSection: 'Experience',
          evidence: 'Did web dev stuff'
        }],
        rawStructure: {} as any
      };

      // We actually want the LLM to run and fail safely if we had a mock, 
      // but since we don't have a mocked OpenRouter in this simple test runner, 
      // it will hit the LLM. If the LLM behaves correctly, it should output MISSING.
      const originalFetch = globalThis.fetch;
      globalThis.fetch = async () => ({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify({ classification: 'MISSING' }) } }]
        })
      }) as any;
      process.env.OPENROUTER_API_KEY = 'sk-or-mock_key_for_testing';

      try {
        const result = await matchRequirements(job, candidate);
        assert.equal(result.matches[0].classification, 'MISSING');
      } finally {
        globalThis.fetch = originalFetch;
      }
    }
  },
  {
    name: 'Under-expressed requirement resolves correctly',
    run: async () => {
      const job: JobProfile = {
        title: 'Analyst',
        requirements: [{
          id: '1',
          category: 'soft skill',
          normalized_name: 'data science collaboration',
          original_text: 'Experience with data science collaboration',
          source_section: 'Requirements',
          source_span: [0, 10],
          source_text: 'data science collaboration',
          priority: 'required',
          requirement_type: 'skill',
          confidence: 1
        }]
      };

      const candidate: CandidateProfile = {
        contact: { name: 'Test', email: '', phone: '', location: '' },
        facts: [{
          id: 'f1',
          type: 'experience',
          normalizedName: 'Data collaboration',
          rawText: 'Partnered with data science to triangulate clickstream analytics with qualitative insights',
          sourceSection: 'Experience',
          evidence: 'Partnered with data science to triangulate clickstream analytics with qualitative insights'
        }],
        rawStructure: {} as any
      };

      const originalFetch = globalThis.fetch;
      globalThis.fetch = async () => ({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify({ classification: 'UNDER_EXPRESSED', supportingFactId: 'f1' }) } }]
        })
      }) as any;
      process.env.OPENROUTER_API_KEY = 'sk-or-mock_key_for_testing';

      try {
        const result = await matchRequirements(job, candidate);
        assert.equal(result.matches[0].classification, 'UNDER_EXPRESSED');
        assert.equal(result.matches[0].evidence.length > 0, true, 'Should attach the evidence');
      } finally {
        globalThis.fetch = originalFetch;
      }
    }
  },
  {
    name: 'True negative resolves to MISSING',
    run: async () => {
      const job: JobProfile = {
        title: 'Analyst',
        requirements: [{
          id: '1',
          category: 'hard skill',
          normalized_name: 'quantum computing algorithms',
          original_text: 'Expertise in quantum computing algorithms',
          source_section: 'Requirements',
          source_span: [0, 10],
          source_text: 'quantum computing algorithms',
          priority: 'required',
          requirement_type: 'skill',
          confidence: 1
        }]
      };

      const candidate: CandidateProfile = {
        contact: { name: 'Test', email: '', phone: '', location: '' },
        facts: [{
          id: 'f1',
          type: 'experience',
          normalizedName: 'Web Development',
          rawText: 'Built simple HTML websites and designed CSS templates',
          sourceSection: 'Experience',
          evidence: 'Built simple HTML websites and designed CSS templates'
        }],
        rawStructure: {} as any
      };

      const originalFetch = globalThis.fetch;
      globalThis.fetch = async () => ({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify({ classification: 'MISSING' }) } }]
        })
      }) as any;
      process.env.OPENROUTER_API_KEY = 'sk-or-mock_key_for_testing';

      try {
        const result = await matchRequirements(job, candidate);
        assert.equal(result.matches[0].classification, 'MISSING');
      } finally {
        globalThis.fetch = originalFetch;
      }
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
