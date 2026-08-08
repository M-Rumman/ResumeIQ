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
          choices: [{ message: { content: JSON.stringify([{ requirementId: '1', classification: 'MISSING' }]) } }]
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
          choices: [{ message: { content: JSON.stringify([{ requirementId: '1', classification: 'UNDER_EXPRESSED', supportingFactId: 'f1' }]) } }]
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
          choices: [{ message: { content: JSON.stringify([{ requirementId: '1', classification: 'MISSING' }]) } }]
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
    name: 'Regression: matcher handles raw JSON array format (bug fix) with Priya Chandran JD',
    run: async () => {
      const job: JobProfile = {
        title: 'Senior UX Researcher',
        requirements: [{
          id: 'req-1',
          category: 'experience',
          normalized_name: '6+ years UX research',
          original_text: '6+ years UX research',
          source_section: 'Requirements',
          source_span: [0, 10],
          source_text: '6+ years UX research',
          priority: 'required',
          requirement_type: 'experience',
          confidence: 1
        }]
      };

      const candidate: CandidateProfile = {
        contact: { name: 'Priya Chandran', email: '', phone: '', location: '' },
        facts: [{
          id: 'fact-1',
          type: 'experience',
          normalizedName: '7 years UX research experience',
          rawText: 'Senior UX Researcher with 7 years of experience leading mixed-methods research in fintech and consumer banking.',
          sourceSection: 'Experience',
          evidence: 'Senior UX Researcher with 7 years of experience leading mixed-methods research in fintech and consumer banking.'
        }],
        rawStructure: {} as any
      };

      const originalFetch = globalThis.fetch;
      globalThis.fetch = async () => ({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify([
            {
              requirementId: 'req-1',
              classification: 'EXACT_MATCH',
              supportingFactId: 'fact-1',
              explanation: 'Candidate has 7 years of UX research experience.'
            }
          ]) } }]
        })
      }) as any;
      process.env.OPENROUTER_API_KEY = 'sk-or-mock_key_for_testing';

      try {
        const result = await matchRequirements(job, candidate);
        assert.equal(result.matches[0].classification, 'EXACT_MATCH');
        assert.equal(result.matches[0].evidence.length > 0, true);
      } finally {
        globalThis.fetch = originalFetch;
      }
    }
  },
  {
    name: 'Regression: matcher handles canonical object format with Priya Chandran JD',
    run: async () => {
      const job: JobProfile = {
        title: 'Senior UX Researcher',
        requirements: [{
          id: 'req-2',
          category: 'domain',
          normalized_name: 'fintech/banking',
          original_text: 'fintech/banking',
          source_section: 'Requirements',
          source_span: [0, 10],
          source_text: 'fintech/banking',
          priority: 'required',
          requirement_type: 'domain',
          confidence: 1
        }]
      };

      const candidate: CandidateProfile = {
        contact: { name: 'Priya Chandran', email: '', phone: '', location: '' },
        facts: [{
          id: 'fact-2',
          type: 'experience',
          normalizedName: 'fintech and consumer banking',
          rawText: 'Senior UX Researcher with 7 years of experience leading mixed-methods research in fintech and consumer banking.',
          sourceSection: 'Experience',
          evidence: 'Senior UX Researcher with 7 years of experience leading mixed-methods research in fintech and consumer banking.'
        }],
        rawStructure: {} as any
      };

      const originalFetch = globalThis.fetch;
      globalThis.fetch = async () => ({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify({
            matches: [
              {
                requirementId: 'req-2',
                classification: 'STRONG_SEMANTIC_MATCH',
                // Purposely test the anti-hallucination / fallback search by passing null/bad ID!
                supportingFactId: null,
                explanation: 'Candidate explicitly mentions fintech and consumer banking in summary.'
              }
            ]
          }) } }]
        })
      }) as any;
      process.env.OPENROUTER_API_KEY = 'sk-or-mock_key_for_testing';

      try {
        const result = await matchRequirements(job, candidate);
        // Because supportingFactId is null, it should trigger the fallback, successfully find fact-2 based on explanation/req words, 
        // and downgrade to UNDER_EXPRESSED to be safe.
        assert.equal(result.matches[0].classification, 'UNDER_EXPRESSED');
        assert.equal(result.matches[0].evidence[0].fact_id, 'fact-2');
      } finally {
        globalThis.fetch = originalFetch;
      }
    }
  },
  {
    name: 'Degree + OR-field match: Construction Management vs Civil Engineering',
    run: async () => {
      const job: JobProfile = {
        title: 'Project Manager',
        requirements: [{
          id: '1',
          category: 'education',
          normalized_name: 'Bachelor\'s Degree in Construction Management or Civil Engineering',
          original_text: 'Bachelor\'s Degree in Construction Management or Civil Engineering',
          source_section: 'Requirements',
          source_span: [0, 10],
          source_text: 'Bachelor\'s',
          priority: 'required',
          requirement_type: 'education',
          confidence: 1,
          degree_level: 'bachelor',
          fields: ['Construction Management', 'Civil Engineering']
        }]
      };

      const candidate: CandidateProfile = {
        contact: { name: 'Test', email: '', phone: '', location: '' },
        facts: [{
          id: 'f1',
          type: 'education',
          normalizedName: 'B.S. in Construction Management',
          rawText: 'B.S. in Construction Management — Colorado State University',
          sourceSection: 'Education',
          evidence: 'B.S. in Construction Management — Colorado State University',
          degree_level: 'bachelor',
          fields: [] // Notice fields is empty from extractFieldsOfStudy
        }],
        rawStructure: {} as any
      };

      const result = await matchRequirements(job, candidate);
      assert.equal(result.matches[0].classification, 'EXACT_MATCH', 'Should match via substring of rawText');
    }
  },
  {
    name: 'Exact certification match: PMP',
    run: async () => {
      const job: JobProfile = {
        title: 'Project Manager',
        requirements: [{
          id: '1',
          category: 'certification',
          normalized_name: 'PMP',
          original_text: 'PMP',
          source_section: 'Requirements',
          source_span: [0, 10],
          source_text: 'PMP',
          priority: 'required',
          requirement_type: 'certification',
          confidence: 1
        }]
      };

      const candidate: CandidateProfile = {
        contact: { name: 'Test', email: '', phone: '', location: '' },
        facts: [{
          id: 'f1',
          type: 'certification',
          normalizedName: 'PMP',
          rawText: 'PMP (Project Management Professional)',
          sourceSection: 'Certifications',
          evidence: 'PMP (Project Management Professional)'
        }],
        rawStructure: {} as any
      };

      const result = await matchRequirements(job, candidate);
      assert.equal(result.matches[0].classification, 'EXACT_MATCH', 'Should exact match PMP string');
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
