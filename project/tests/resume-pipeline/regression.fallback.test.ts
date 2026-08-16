import { getDeterministicMatches, matchRequirements } from '../../api/_lib/analysis-engine/matcher.js';
import type { JobRequirement, CandidateFact, JobProfile, CandidateProfile } from '../../api/_lib/analysis-engine/types.js';

// The mocked failing AI to test fallback propagation
const mockAiOptions = {
  observability: {
    // We can't mock callOpenRouter completely without editing matcher.js, but we can pass a dummy observability to trigger the real code path.
    // However, without a real API key, callOpenRouter throws an error immediately anyway! 
    // This perfectly triggers the catch block and tests E, F, G.
  }
};

const reqs: JobRequirement[] = [
  {
    id: 'req_1',
    normalized_name: 'qualitative and quantitative research methods',
    original_text: 'Strong command of both qualitative and quantitative research methods',
    category: 'hard skill',
    source_section: 'Requirements',
    source_span: [0, 10],
    source_text: '',
    priority: 'required',
    requirement_type: 'hard skill',
    confidence: 1
  },
  {
    id: 'req_2',
    normalized_name: 'experience running research at scale',
    original_text: 'Experience running research at scale (research repositories, participant panels)',
    category: 'experience',
    source_section: 'Requirements',
    source_span: [0, 10],
    source_text: '',
    priority: 'required',
    requirement_type: 'experience',
    confidence: 1
  },
  {
    id: 'req_3',
    normalized_name: 'excellent stakeholder communication',
    original_text: 'Excellent stakeholder communication and storytelling skills',
    category: 'soft skill',
    source_section: 'Requirements',
    source_span: [0, 10],
    source_text: '',
    priority: 'required',
    requirement_type: 'soft skill',
    confidence: 1
  },
  {
    id: 'req_4',
    normalized_name: 'master degree preferred in psychology hci',
    original_text: "Bachelor's degree in Psychology, HCI, Cognitive Science, or related field (Master's preferred)",
    category: 'education',
    source_section: 'Requirements',
    source_span: [0, 10],
    source_text: '',
    priority: 'preferred',
    requirement_type: 'education',
    degree_level: 'master',
    fields: ['psychology', 'hci', 'cognitive science'],
    confidence: 1
  },
  {
    id: 'req_5',
    normalized_name: 'unrelated artificial intelligence',
    original_text: 'Experience with artificial intelligence and machine learning pipelines',
    category: 'hard skill',
    source_section: 'Requirements',
    source_span: [0, 10],
    source_text: '',
    priority: 'preferred',
    requirement_type: 'hard skill',
    confidence: 1
  }
];

const facts: CandidateFact[] = [
  {
    id: 'fact_1',
    type: 'skill',
    normalizedName: 'Qualitative & quantitative research methods',
    rawText: 'Qualitative & quantitative research methods',
    sourceSection: 'Skills',
    evidence: 'Qualitative & quantitative research methods'
  },
  {
    id: 'fact_2',
    type: 'experience',
    normalizedName: 'Conducted 100+ usability tests',
    rawText: 'Conducted 100+ usability tests and interviews across web and mobile lending products',
    sourceSection: 'Experience',
    evidence: 'Conducted 100+ usability tests and interviews across web and mobile lending products'
  },
  {
    id: 'fact_3',
    type: 'experience',
    normalizedName: 'Built and managed participant panel',
    rawText: 'Built and managed a 5,000-person participant panel and centralized research repository, cutting study recruitment time by 50%',
    sourceSection: 'Experience',
    evidence: 'Built and managed a 5,000-person participant panel and centralized research repository, cutting study recruitment time by 50%'
  },
  {
    id: 'fact_4',
    type: 'skill',
    normalizedName: 'stakeholder communication',
    rawText: 'stakeholder communication',
    sourceSection: 'Skills',
    evidence: 'stakeholder communication'
  },
  {
    id: 'fact_5',
    type: 'experience',
    normalizedName: 'Presented findings to VP and C-suite',
    rawText: 'Regularly presented findings to VP and C-suite stakeholders, directly influencing quarterly product strategy',
    sourceSection: 'Experience',
    evidence: 'Regularly presented findings to VP and C-suite stakeholders, directly influencing quarterly product strategy'
  },
  {
    id: 'fact_6',
    type: 'education',
    normalizedName: 'M.S. in Human-Computer Interaction',
    rawText: 'M.S. in Human-Computer Interaction — DePaul University, 2018',
    sourceSection: 'Education',
    degree_level: 'master',
    fields: ['human-computer interaction'],
    evidence: 'M.S. in Human-Computer Interaction — DePaul University, 2018'
  }
];

const jobProfile: JobProfile = { title: 'Senior UX Researcher', requirements: reqs };
const candidateProfile: CandidateProfile = {
  contact: { name: 'Priya Chandran', email: '', phone: '', location: '' },
  rawStructure: {},
  facts: facts
};

async function runTest() {
  console.log('\\n--- STAGE 1: Deterministic Matcher ---');
  const deterministicResult = getDeterministicMatches(jobProfile, candidateProfile);
  
  console.log('\\nUnmatched Requirements sent to LLM:');
  deterministicResult.unmatchedRequirements.forEach(req => {
    console.log(`- ${req.normalized_name} (Fallback available: ${!!(req as any)._fallbackMatch})`);
  });

  console.log('\\n--- STAGE 2: Batched LLM Evaluation (with simulated Provider Failure) ---');
  
  const matchingResult = await matchRequirements(jobProfile, candidateProfile, deterministicResult, mockAiOptions);
  
  console.log('\\n--- FINAL CLASSIFICATION REPORT ---\\n');
  matchingResult.matches.forEach(m => {
    console.log(`Requirement: ${m.requirement.normalized_name}`);
    console.log(`  Classification: ${m.classification}`);
    console.log(`  Reason: ${m.explanation}`);
    console.log(`  Evidence source: ${m.match_tier}`);
    console.log(`  Facts cited: ${m.evidence?.length || 0}`);
    m.evidence?.forEach(e => {
       console.log(`    -> [${e.evidence_type}] ${e.source_text}`);
    });
    console.log('');
  });
}

runTest().catch(console.error);
