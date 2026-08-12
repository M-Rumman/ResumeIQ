import assert from 'node:assert/strict';
import { matchRequirements, getDeterministicMatches } from '../../api/_lib/analysis-engine/matcher.js';
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

      const result = await matchRequirements(job, candidate, getDeterministicMatches(job, candidate));
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
        assert.equal(result.matches[0].classification, 'EXACT_MATCH');
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
    name: 'Regression: Deterministic fallback routes weak skill matches to LLM for semantic verification',
    run: async () => {
      const job: JobProfile = {
        title: 'Project Manager',
        requirements: [{
          id: 'req-sh',
          category: 'soft skill',
          normalized_name: 'Stakeholder Communication',
          original_text: 'Stakeholder Communication',
          source_section: 'Requirements',
          source_span: [0, 10],
          source_text: 'Stakeholder Communication',
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
            normalizedName: 'Stakeholder Communication',
            rawText: 'Stakeholder Communication',
            sourceSection: 'Skills',
            evidence: 'Stakeholder Communication'
          },
          {
            id: 'fact-exp',
            type: 'experience',
            normalizedName: 'Presented to C-suite',
            rawText: 'Regularly presented findings to VP and C-suite stakeholders, directly influencing quarterly product strategy',
            sourceSection: 'Experience',
            evidence: 'Regularly presented findings to VP and C-suite stakeholders, directly influencing quarterly product strategy'
          }
        ],
        rawStructure: {} as any
      };

      // The LLM mock will select fact-exp
      const originalFetch = globalThis.fetch;
      globalThis.fetch = async () => ({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify([{
            requirementId: 'req-sh',
            classification: 'STRONG_SEMANTIC_MATCH',
            supportingFactId: 'fact-exp',
            explanation: 'Candidate regularly presented to VP and C-suite stakeholders.'
          }]) } }]
        })
      }) as any;
      process.env.OPENROUTER_API_KEY = 'sk-or-mock_key_for_testing';

      try {
        const result = await matchRequirements(job, candidate, getDeterministicMatches(job, candidate));
        // It should NOT be an EXACT_MATCH from fact-skill. It should be STRONG_SEMANTIC_MATCH from fact-exp
        assert.equal(result.matches[0].classification, 'STRONG_SEMANTIC_MATCH');
        assert.equal(result.matches[0].evidence[0].fact_id, 'fact-exp');
      } finally {
        globalThis.fetch = originalFetch;
      }
    }
  },
  {
    name: 'Regression: Deterministic matcher correctly ranks quantified achievements over standard experience bullets',
    run: async () => {
      const job: JobProfile = {
        title: 'UX Researcher',
        requirements: [{
          id: 'req-lr2',
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
            id: 'fact-std',
            type: 'experience',
            normalizedName: 'Mentored',
            rawText: 'Mentored 3 junior researchers and established research operations best practices adopted company-wide',
            sourceSection: 'Experience',
            evidence: 'Mentored 3 junior researchers and established research operations best practices adopted company-wide'
          },
          {
            id: 'fact-quant',
            type: 'experience',
            normalizedName: 'Built repository',
            rawText: 'Built and managed a 5000-person participant panel and centralized research repository, cutting study recruitment time by 50%',
            sourceSection: 'Experience',
            evidence: 'Built and managed a 5000-person participant panel and centralized research repository, cutting study recruitment time by 50%'
          }
        ],
        rawStructure: {} as any
      };

      // In this test, NO LLM is used. The deterministic matcher MUST pick fact-quant over fact-std
      // because 5000-person matches the scale regex, giving it a huge boost.
      const result = await matchRequirements(job, candidate, getDeterministicMatches(job, candidate));
      
      assert.equal(result.matches[0].classification, 'EXACT_MATCH');
      assert.equal(result.matches[0].evidence[0].fact_id, 'fact-quant');
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
