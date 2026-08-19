import assert from 'node:assert/strict';
import { matchRequirements, getDeterministicMatches } from '../../api/_lib/analysis-engine/matcher.js';
import type { JobRequirement, CandidateFact, JobProfile, CandidateProfile } from '../../api/_lib/analysis-engine/types.js';

type TestCase = { name: string; run: () => Promise<void> };

// Mock callOpenRouter specifically for these tests since LLMs shouldn't run in unit tests.
// Wait, actually, the user wants to ensure exact matches work without LLM, and the rest fail gracefully.
// Let's test the EXACT MATCH capabilities which bypass the LLM entirely!

const tests: TestCase[] = [
  {
    name: 'LLM Timeout triggers semantic fallback (PARTIAL_MATCH) if word overlap is high',
    run: async () => {
      const job: JobProfile = {
        title: 'Project Manager',
        requirements: [{
          id: 'req-timeout',
          category: 'responsibility',
          normalized_name: 'Stakeholder communication and storytelling skills',
          original_text: 'Stakeholder communication and storytelling skills',
          source_section: 'Requirements',
          source_span: [0, 10],
          source_text: 'Stakeholder communication and storytelling skills',
          priority: 'required',
          requirement_type: 'responsibility',
          confidence: 1
        }]
      };

      const candidate: CandidateProfile = {
        contact: { name: 'Test', email: '', phone: '', location: '' },
        facts: [{
          id: 'fact-timeout',
          type: 'experience',
          normalizedName: 'Communication',
          rawText: 'Excellent stakeholder communication and strong storytelling skills for executive presentations.',
          sourceSection: 'Experience',
          evidence: 'Excellent stakeholder communication and strong storytelling skills for executive presentations.'
        }],
        rawStructure: {} as any
      };

      // Mock LLM timeout/failure
      const originalFetch = globalThis.fetch;
      globalThis.fetch = async () => { throw new Error('Timeout'); };
      
      try {
        const result = await matchRequirements(job, candidate, getDeterministicMatches(job, candidate));
        // Due to high overlap, fallback should be PARTIAL_MATCH (or UNDER_EXPRESSED if <80% but >=50%)
        // "Stakeholder communication and storytelling skills" has 5 words > 4 chars: 
        // stakeholder, communication, storytelling, skills
        // rawText has all of them, so 100% overlap -> PARTIAL_MATCH
        assert.equal(result.matches[0].classification, 'PARTIAL_MATCH');
      } finally {
        globalThis.fetch = originalFetch;
      }
    }
  },
  {
    name: 'LLM Timeout triggers ANALYSIS_FAILED if NO word overlap is found',
    run: async () => {
      const job: JobProfile = {
        title: 'Project Manager',
        requirements: [{
          id: 'req-timeout-2',
          category: 'responsibility',
          normalized_name: 'Strategic cross-functional product roadmap alignment',
          original_text: 'Strategic cross-functional product roadmap alignment',
          source_section: 'Requirements',
          source_span: [0, 10],
          source_text: 'Strategic cross-functional product roadmap alignment',
          priority: 'required',
          requirement_type: 'responsibility',
          confidence: 1
        }]
      };

      const candidate: CandidateProfile = {
        contact: { name: 'Test', email: '', phone: '', location: '' },
        facts: [{
          id: 'fact-timeout-2',
          type: 'experience',
          normalizedName: 'Web Development',
          rawText: 'Built simple HTML websites and designed CSS templates.',
          sourceSection: 'Experience',
          evidence: 'Built simple HTML websites and designed CSS templates.'
        }],
        rawStructure: {} as any
      };

      // Mock LLM timeout/failure
      const originalFetch = globalThis.fetch;
      globalThis.fetch = async () => { throw new Error('Timeout'); };
      
      try {
        const result = await matchRequirements(job, candidate, getDeterministicMatches(job, candidate));
        // No overlap -> ANALYSIS_FAILED
        assert.equal(result.matches[0].classification, 'ANALYSIS_FAILED');
      } finally {
        globalThis.fetch = originalFetch;
      }
    }
  },
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

      const result = await matchRequirements(job, candidate, getDeterministicMatches(job, candidate));
      assert.equal(result.matches[0].classification, 'EXACT_MATCH');
      assert.equal(result.matches[0].match_tier, 'tier_1_deterministic');
      assert.equal(result.matches[0].evidence[0].evidence_strength, 'primary');
    }
  },
  {
    name: 'Explicit 7 years of experience satisfies a 6+ years requirement deterministically',
    run: async () => {
      const job: JobProfile = {
        title: 'Senior UX Researcher',
        requirements: [{
          id: 'req-dur-1',
          category: 'experience',
          normalized_name: '6+ years UX research',
          original_text: '6+ years of UX research experience',
          source_section: 'Requirements',
          source_span: [0, 10],
          source_text: '6+ years of UX research experience',
          priority: 'required',
          requirement_type: 'experience',
          confidence: 1,
          // We intentionally omit minimum_years to test the parseReqMinimumYears fallback
        }]
      };

      const candidate: CandidateProfile = {
        contact: { name: 'Test', email: '', phone: '', location: '' },
        facts: [{
          id: 'fact-dur-1',
          type: 'other',
          normalizedName: 'Summary',
          rawText: 'Senior UX Researcher with 7 years of experience.',
          sourceSection: 'Summary',
          evidence: 'Senior UX Researcher with 7 years of experience.',
          employment_duration_years: 7
        }],
        rawStructure: {} as any
      };

      const result = await matchRequirements(job, candidate, getDeterministicMatches(job, candidate));
      assert.equal(result.matches[0].classification, 'EXACT_MATCH');
      assert.equal(result.matches[0].match_tier, 'tier_1_deterministic');
    }
  },
  {
    name: 'Experience date ranges can contribute to duration when reliably derivable',
    run: async () => {
      const job: JobProfile = {
        title: 'Senior Engineer',
        requirements: [{
          id: 'req-dur-2',
          category: 'years',
          normalized_name: '5+ years experience',
          original_text: '5+ years experience',
          source_section: 'Requirements',
          source_span: [0, 10],
          source_text: '5+ years experience',
          priority: 'required',
          requirement_type: 'experience',
          confidence: 1,
          minimum_years: 5
        }]
      };

      const candidate: CandidateProfile = {
        contact: { name: 'Test', email: '', phone: '', location: '' },
        facts: [
          {
            id: 'fact-exp-1',
            type: 'experience',
            normalizedName: 'Job 1',
            rawText: '2018 - 2020',
            sourceSection: 'Experience',
            evidence: '2018 - 2020',
            employment_duration_years: 2
          },
          {
            id: 'fact-exp-2',
            type: 'experience',
            normalizedName: 'Job 2',
            rawText: '2020 - 2024',
            sourceSection: 'Experience',
            evidence: '2020 - 2024',
            employment_duration_years: 4
          }
        ],
        rawStructure: {} as any
      };

      const result = await matchRequirements(job, candidate, getDeterministicMatches(job, candidate));
      assert.equal(result.matches[0].classification, 'EXACT_MATCH');
      assert.equal(result.matches[0].match_tier, 'tier_1_deterministic');
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
        const result = await matchRequirements(job, candidate, getDeterministicMatches(job, candidate));
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
        const result = await matchRequirements(job, candidate, getDeterministicMatches(job, candidate));
        assert.equal(result.matches[0].classification, 'UNDER_EXPRESSED');
        assert.equal(result.matches[0].match_tier, 'tier_3_semantic');
        assert.equal(result.matches[0].evidence.length > 0, true, 'Should attach the evidence');
      } finally {
        globalThis.fetch = originalFetch;
      }
    }
  },
  {
    name: 'Compound requirements bypass deterministic exact match and route to LLM',
    run: async () => {
      const job: JobProfile = {
        title: 'Researcher',
        requirements: [{
          id: '1',
          category: 'soft skill',
          normalized_name: 'stakeholder communication',
          original_text: 'Excellent stakeholder communication and storytelling skills', // contains 'and', triggering compound check
          source_section: 'Requirements',
          source_span: [0, 57],
          source_text: 'Excellent stakeholder communication and storytelling skills',
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
          normalizedName: 'stakeholder communication',
          rawText: 'Led stakeholder communication across pods',
          sourceSection: 'Experience',
          evidence: 'Led stakeholder communication across pods'
        }],
        rawStructure: {} as any
      };

      const deterministicResult = getDeterministicMatches(job, candidate);
      
      // Should NOT be in deterministic matches because it was downgraded to PARTIAL_MATCH and thus needs LLM
      assert.equal(deterministicResult.matches.length, 0);
      
      // Should be routed to unmatchedRequirements to be handled by the LLM
      assert.equal(deterministicResult.unmatchedRequirements.length, 1);
      assert.equal((deterministicResult.unmatchedRequirements[0] as any)._fallbackMatch.classification, 'PARTIAL_MATCH');
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
        const result = await matchRequirements(job, candidate, getDeterministicMatches(job, candidate));
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
        const result = await matchRequirements(job, candidate, getDeterministicMatches(job, candidate));
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
          category: 'responsibility',
          normalized_name: 'Financial industry knowledge',
          original_text: 'Financial industry knowledge',
          source_section: 'Requirements',
          source_span: [0, 10],
          source_text: 'Financial industry knowledge',
          priority: 'required',
          requirement_type: 'responsibility',
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
        const result = await matchRequirements(job, candidate, getDeterministicMatches(job, candidate));
        // Because supportingFactId is null, and there are no overlapping keywords between "Financial industry knowledge" and "fintech and consumer banking", 
        // the strict anti-hallucination rules correctly prevent fabricating evidence and downgrade the match to MISSING.
        assert.equal(result.matches[0].classification, 'MISSING');
        assert.equal(result.matches[0].evidence.length, 0);
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

      const result = await matchRequirements(job, candidate, getDeterministicMatches(job, candidate));
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

      const result = await matchRequirements(job, candidate, getDeterministicMatches(job, candidate));
      assert.equal(result.matches[0].classification, 'EXACT_MATCH', 'Should exact match PMP string');
    }
  },
  {
    name: 'Research Design and Execution matched by strong semantic evidence',
    run: async () => {
      const job: JobProfile = {
        title: 'UX Researcher',
        requirements: [{
          id: 'req-rd',
          category: 'responsibility',
          normalized_name: 'Research Design and Execution',
          original_text: 'Research Design and Execution',
          source_section: 'Requirements',
          source_span: [0, 20],
          source_text: 'Research Design and Execution',
          priority: 'required',
          requirement_type: 'responsibility',
          confidence: 1
        }]
      };

      const candidate: CandidateProfile = {
        contact: { name: 'Test', email: '', phone: '', location: '' },
        facts: [{
          id: 'fact-rd',
          type: 'experience',
          normalizedName: 'Conducted user research',
          rawText: 'Led generative and evaluative research across mobile banking redesign. Ran longitudinal diary studies. Conducted 100+ usability tests and interviews. Designed and fielded quarterly surveys.',
          sourceSection: 'Experience',
          evidence: 'Led generative and evaluative research across mobile banking redesign. Ran longitudinal diary studies. Conducted 100+ usability tests and interviews. Designed and fielded quarterly surveys.'
        }],
        rawStructure: {} as any
      };

      const originalFetch = globalThis.fetch;
      globalThis.fetch = async () => ({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify([{
            requirementId: 'req-rd',
            classification: 'STRONG_SEMANTIC_MATCH',
            supportingFactId: 'fact-rd',
            explanation: 'Candidate has extensive evidence of research design and execution via usability tests, diary studies, and surveys.'
          }]) } }]
        })
      }) as any;
      
      try {
        const result = await matchRequirements(job, candidate, getDeterministicMatches(job, candidate));
        assert.equal(result.matches[0].classification, 'STRONG_SEMANTIC_MATCH');
      } finally {
        globalThis.fetch = originalFetch;
      }
    }
  },
  {
    name: 'Genuinely under-expressed requirement with weak/partial evidence',
    run: async () => {
      const job: JobProfile = {
        title: 'Product Manager',
        requirements: [{
          id: 'req-ue',
          category: 'responsibility',
          normalized_name: 'Go-to-market strategy',
          original_text: 'Go-to-market strategy',
          source_section: 'Requirements',
          source_span: [0, 20],
          source_text: 'Go-to-market strategy',
          priority: 'required',
          requirement_type: 'responsibility',
          confidence: 1
        }]
      };

      const candidate: CandidateProfile = {
        contact: { name: 'Test', email: '', phone: '', location: '' },
        facts: [{
          id: 'fact-ue',
          type: 'experience',
          normalizedName: 'Helped launch',
          rawText: 'Assisted the marketing team during the launch phase by providing feature descriptions.',
          sourceSection: 'Experience',
          evidence: 'Assisted the marketing team during the launch phase by providing feature descriptions.'
        }],
        rawStructure: {} as any
      };

      const originalFetch = globalThis.fetch;
      globalThis.fetch = async () => ({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify([{
            requirementId: 'req-ue',
            classification: 'UNDER_EXPRESSED',
            supportingFactId: 'fact-ue',
            explanation: 'Candidate assisted with launches but did not own or drive the GTM strategy.'
          }]) } }]
        })
      }) as any;
      
      try {
        const result = await matchRequirements(job, candidate, getDeterministicMatches(job, candidate));
        assert.equal(result.matches[0].classification, 'UNDER_EXPRESSED');
      } finally {
        globalThis.fetch = originalFetch;
      }
    }
  },
  {
    name: 'Genuinely missing requirement',
    run: async () => {
      const job: JobProfile = {
        title: 'Data Engineer',
        requirements: [{
          id: 'req-miss',
          category: 'tool',
          normalized_name: 'Apache Kafka',
          original_text: 'Apache Kafka',
          source_section: 'Requirements',
          source_span: [0, 10],
          source_text: 'Apache Kafka',
          priority: 'required',
          requirement_type: 'tool',
          confidence: 1
        }]
      };

      const candidate: CandidateProfile = {
        contact: { name: 'Test', email: '', phone: '', location: '' },
        facts: [{
          id: 'fact-miss',
          type: 'experience',
          normalizedName: 'Python Developer',
          rawText: 'Built REST APIs using Python and Flask.',
          sourceSection: 'Experience',
          evidence: 'Built REST APIs using Python and Flask.'
        }],
        rawStructure: {} as any
      };

      const originalFetch = globalThis.fetch;
      globalThis.fetch = async () => ({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify([{
            requirementId: 'req-miss',
            classification: 'MISSING',
            supportingFactId: null,
            explanation: 'No evidence of Apache Kafka.'
          }]) } }]
        })
      }) as any;
      
      try {
        const result = await matchRequirements(job, candidate, getDeterministicMatches(job, candidate));
        assert.equal(result.matches[0].classification, 'MISSING');
      } finally {
        globalThis.fetch = originalFetch;
      }
    }
  },
  {
    name: 'Similar keywords appear but capability not demonstrated (RELATED_MATCH)',
    run: async () => {
      const job: JobProfile = {
        title: 'Machine Learning Engineer',
        requirements: [{
          id: 'req-rel',
          category: 'responsibility',
          normalized_name: 'Training deep learning models from scratch',
          original_text: 'Training deep learning models from scratch',
          source_section: 'Requirements',
          source_span: [0, 20],
          source_text: 'Training deep learning models from scratch',
          priority: 'required',
          requirement_type: 'responsibility',
          confidence: 1
        }]
      };

      const candidate: CandidateProfile = {
        contact: { name: 'Test', email: '', phone: '', location: '' },
        facts: [{
          id: 'fact-rel',
          type: 'experience',
          normalizedName: 'Model deployment',
          rawText: 'Deployed pre-trained deep learning models via AWS SageMaker for inference. Managed model monitoring.',
          sourceSection: 'Experience',
          evidence: 'Deployed pre-trained deep learning models via AWS SageMaker for inference. Managed model monitoring.'
        }],
        rawStructure: {} as any
      };

      const originalFetch = globalThis.fetch;
      globalThis.fetch = async () => ({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify([{
            requirementId: 'req-rel',
            classification: 'RELATED_MATCH',
            supportingFactId: 'fact-rel',
            explanation: 'Candidate works with deep learning models but only for deployment/inference, not training from scratch.'
          }]) } }]
        })
      }) as any;
      
      try {
        const result = await matchRequirements(job, candidate, getDeterministicMatches(job, candidate));
        assert.equal(result.matches[0].classification, 'RELATED_MATCH');
      } finally {
        globalThis.fetch = originalFetch;
      }
    }
  },
  {
    name: 'Strong direct evidence vs weak tangential evidence',
    run: async () => {
      const job: JobProfile = {
        title: 'UX Researcher',
        requirements: [{
          id: 'req-lr',
          category: 'responsibility',
          normalized_name: 'Large-scale Research Operations',
          original_text: 'Large-scale Research Operations',
          source_section: 'Requirements',
          source_span: [0, 10],
          source_text: 'Large-scale Research Operations',
          priority: 'required',
          requirement_type: 'responsibility',
          confidence: 1
        }]
      };

      const candidate: CandidateProfile = {
        contact: { name: 'Test', email: '', phone: '', location: '' },
        facts: [
          {
            id: 'fact-weak',
            type: 'experience',
            normalizedName: 'Mentorship',
            rawText: 'Mentored 3 junior researchers and established research operations best practices adopted company-wide',
            sourceSection: 'Experience',
            evidence: 'Mentored 3 junior researchers and established research operations best practices adopted company-wide'
          },
          {
            id: 'fact-strong',
            type: 'experience',
            normalizedName: 'Built repository',
            rawText: 'Built and managed a 5,000-person participant panel and centralized research repository, cutting study recruitment time by 50%',
            sourceSection: 'Experience',
            evidence: 'Built and managed a 5,000-person participant panel and centralized research repository, cutting study recruitment time by 50%'
          }
        ],
        rawStructure: {} as any
      };

      const originalFetch = globalThis.fetch;
      globalThis.fetch = async () => ({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify([{
            requirementId: 'req-lr',
            classification: 'STRONG_SEMANTIC_MATCH',
            supportingFactId: 'fact-strong',
            explanation: 'Candidate managed a massive 5000-person panel which clearly demonstrates large-scale research operations.'
          }]) } }]
        })
      }) as any;

      try {
        const result = await matchRequirements(job, candidate, getDeterministicMatches(job, candidate));
        assert.equal(result.matches[0].classification, 'STRONG_SEMANTIC_MATCH');
        assert.equal(result.matches[0].evidence[0].fact_id, 'fact-strong', 'Should select the strong scaled evidence fact ID');
        assert.equal(result.matches[0].evidence[0].evidence_strength, 'primary', 'Experience fact should be primary');
      } finally {
        globalThis.fetch = originalFetch;
      }
    }
  },
  {
    name: 'Experience evidence vs skills-list evidence (correct ID propagation)',
    run: async () => {
      const job: JobProfile = {
        title: 'Data Scientist',
        requirements: [{
          id: 'req-ds',
          category: 'hard skill',
          normalized_name: 'Python',
          original_text: 'Python programming',
          source_section: 'Requirements',
          source_span: [0, 10],
          source_text: 'Python',
          priority: 'required',
          requirement_type: 'skill',
          confidence: 1
        }]
      };

      const candidate: CandidateProfile = {
        contact: { name: 'Test', email: '', phone: '', location: '' },
        facts: [
          {
            id: 'fact-skill',
            type: 'skill',
            normalizedName: 'Python',
            rawText: 'Python',
            sourceSection: 'Skills',
            evidence: 'Python'
          },
          {
            id: 'fact-exp',
            type: 'experience',
            normalizedName: 'Python developer',
            rawText: 'Developed robust ML pipelines using Python.',
            sourceSection: 'Experience',
            evidence: 'Developed robust ML pipelines using Python.'
          }
        ],
        rawStructure: {} as any
      };

      // Note: Python is a deterministic lexical match. The deterministic matcher loops through prioritized facts.
      // Since Experience (priority 1) comes before Skill (priority 6), the deterministic matcher MUST select the experience fact!
      const result = await matchRequirements(job, candidate, getDeterministicMatches(job, candidate));
      assert.equal(result.matches[0].classification, 'EXACT_MATCH');
      assert.equal(result.matches[0].evidence[0].fact_id, 'fact-exp', 'Deterministic matcher should pick experience over skill due to sorting');
    }
  },

  {
    name: 'Regression: Years of Experience combines multiple facts',
    run: async () => {
      const job: JobProfile = {
        title: 'Senior UX Researcher',
        requirements: [{
          id: 'req-yoe',
          category: 'years',
          normalized_name: '6+ years of UX research experience',
          original_text: '6+ years of UX research experience',
          source_section: 'Requirements',
          source_span: [0, 10],
          source_text: '6+ years of UX research experience',
          priority: 'required',
          requirement_type: 'experience',
          confidence: 1,
          minimum_years: 6
        }]
      };

      const candidate: CandidateProfile = {
        contact: { name: 'Test', email: '', phone: '', location: '' },
        facts: [
          {
            id: 'job-1',
            type: 'experience',
            normalizedName: 'Senior UX Researcher',
            rawText: 'Senior UX Researcher | 2021-Present',
            sourceSection: 'Experience',
            evidence: 'Senior UX Researcher | 2021-Present',
            employment_duration_years: 3
          },
          {
            id: 'job-2',
            type: 'experience',
            normalizedName: 'UX Researcher',
            rawText: 'UX Researcher | 2018-2021',
            sourceSection: 'Experience',
            evidence: 'UX Researcher | 2018-2021',
            employment_duration_years: 3
          }
        ],
        rawStructure: {} as any
      };

      const result = await matchRequirements(job, candidate, getDeterministicMatches(job, candidate));
      assert.equal(result.matches[0].classification, 'EXACT_MATCH');
      assert.equal(result.matches[0].evidence.length, 2, 'Should combine multiple facts for YOE');
    }

  },
  {
    name: 'LLM returns multiple supportingFactIds',
    run: async () => {
      const job: JobProfile = {
        title: 'Product Manager',
        requirements: [{
          id: 'req-llm-multi',
          category: 'soft skill',
          normalized_name: 'Cross-functional Leadership',
          original_text: 'Cross-functional Leadership',
          source_section: 'Requirements',
          source_span: [0, 10],
          source_text: 'Cross-functional Leadership',
          priority: 'required',
          requirement_type: 'skill',
          confidence: 1
        }]
      };

      const candidate: CandidateProfile = {
        contact: { name: 'Test', email: '', phone: '', location: '' },
        facts: [
          {
            id: 'f1',
            type: 'experience',
            normalizedName: 'Led design team',
            rawText: 'Led design team of 5',
            sourceSection: 'Experience',
            evidence: 'Led design team of 5'
          },
          {
            id: 'f2',
            type: 'experience',
            normalizedName: 'Managed engineering',
            rawText: 'Managed engineering contractors',
            sourceSection: 'Experience',
            evidence: 'Managed engineering contractors'
          }
        ],
        rawStructure: {} as any
      };

      const originalFetch = globalThis.fetch;
      globalThis.fetch = async () => ({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify([{
            requirementId: 'req-llm-multi',
            classification: 'STRONG_SEMANTIC_MATCH',
            supportingFactIds: ['f1', 'f2'],
            explanation: 'Candidate led both design and engineering teams.'
          }]) } }]
        })
      }) as any;
      
      try {
        const result = await matchRequirements(job, candidate, getDeterministicMatches(job, candidate));
        assert.equal(result.matches[0].classification, 'STRONG_SEMANTIC_MATCH');
        assert.equal(result.matches[0].evidence.length, 2, 'Should extract both facts from LLM supportingFactIds');
        assert.equal(result.matches[0].evidence[0].fact_id, 'f1');
        assert.equal(result.matches[0].evidence[1].fact_id, 'f2');
      } finally {
        globalThis.fetch = originalFetch;
      }
    }
  },
  {
    name: 'Classification: Mentor junior researchers -> EXACT_MATCH via morphology',
    run: async () => {
      const job: JobProfile = {
        title: 'Senior Researcher',
        requirements: [{
          id: 'req-mentor',
          category: 'responsibility',
          normalized_name: 'Mentor junior researchers',
          original_text: 'Mentor junior researchers',
          source_section: 'Requirements',
          source_span: [0, 10],
          source_text: 'Mentor junior researchers',
          priority: 'required',
          requirement_type: 'responsibility',
          confidence: 1
        }]
      };

      const candidate: CandidateProfile = {
        contact: { name: 'Test', email: '', phone: '', location: '' },
        facts: [
          {
            id: 'fact-mentor',
            type: 'experience',
            normalizedName: 'Mentored researchers',
            rawText: 'Mentored 3 junior researchers.',
            sourceSection: 'Experience',
            evidence: 'Mentored 3 junior researchers.'
          }
        ],
        rawStructure: {} as any
      };
      const originalFetch = globalThis.fetch;
      globalThis.fetch = async () => ({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify([{
            requirementId: 'req-mentor',
            classification: 'EXACT_MATCH',
            supportingFactIds: ['fact-mentor'],
            explanation: 'Candidate explicitly mentored 3 junior researchers.'
          }]) } }]
        })
      }) as any;

      try {
        const result = await matchRequirements(job, candidate, getDeterministicMatches(job, candidate));
        assert.equal(result.matches[0].classification, 'EXACT_MATCH');
      } finally {
        globalThis.fetch = originalFetch;
      }
    }
  },

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
