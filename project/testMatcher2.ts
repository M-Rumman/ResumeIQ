import { matchRequirements } from './api/_lib/analysis-engine/matcher.js';
import { extractCandidateProfile } from './api/_lib/analysis-engine/resumeExtraction.js';

const resumeText = `Priya Chandran
Chicago, IL

Senior UX Researcher with 7 years of experience leading mixed-methods research in fintech and consumer banking.

Experience:

2021–Present Senior UX Researcher, Cardstack Financial
- Led generative and evaluative research across mobile banking redesign
- Mentored 3 junior researchers
- Partnered with data science to triangulate clickstream analytics
- Regularly presented findings to VP and C-suite stakeholders
- Research findings directly shaped a budgeting tool and product roadmap

2019–2021 UX Researcher, Brightledger Bank

2018–2019 Associate UX Researcher, Lending Co

Education:
M.S. in Human-Computer Interaction — DePaul University, 2018
B.A. in Psychology — University of Illinois, 2016

Skills:
Qualitative & quantitative research methods, mixed-methods research, centralized research repository.
`;

const jobProfile = {
  title: 'Senior UX Researcher',
  requirements: [
    { id: 'req-1', normalized_name: '6+ years UX research', category: 'years', priority: 'required', original_text: '6+ years UX research' },
    { id: 'req-2', normalized_name: 'fintech or banking', category: 'domain', priority: 'required', original_text: 'fintech or banking industry experience' },
    { id: 'req-3', normalized_name: 'mixed-methods research', category: 'hard skill', priority: 'required', original_text: 'mixed-methods research' },
    { id: 'req-4', normalized_name: 'Master\'s Degree', category: 'education', priority: 'preferred', degree_level: 'master', original_text: 'Master\'s degree' },
    { id: 'req-5', normalized_name: 'Lead end-to-end research studies', category: 'responsibility', priority: 'required', original_text: 'Lead end-to-end research studies' },
    { id: 'req-6', normalized_name: 'Mentor junior researchers', category: 'responsibility', priority: 'required', original_text: 'Mentor junior researchers' },
  ]
};

async function test() {
  const candidateProfile = extractCandidateProfile(resumeText);
  
  // Hijack openrouter to mock the response
  const openrouter = await import('./api/_lib/openrouter.js');
  const originalCall = openrouter.callOpenRouter;
  (openrouter as any).callOpenRouter = async (messages: any[]) => {
    console.log('LLM called with requirements:', messages[1].content.split('Candidate Facts')[0]);
    
    // Create a mock LLM output that correctly assigns EXACT_MATCH to everything
    return JSON.stringify({
      matches: jobProfile.requirements.map(req => {
        // find a fact to cite
        let factId = candidateProfile.facts[0].id; // just pick the first fact (experience summary) for testing
        if (req.category === 'education') {
          factId = candidateProfile.facts.find(f => f.type === 'education' && f.degree_level === 'master')?.id || factId;
        } else if (req.category === 'responsibility' && req.normalized_name === 'Mentor junior researchers') {
          factId = candidateProfile.facts.find(f => f.rawText.includes('Mentored'))?.id || factId;
        }

        return {
          requirementId: req.id,
          classification: 'EXACT_MATCH',
          supportingFactId: factId,
          explanation: 'Mocked match'
        };
      })
    });
  };

  const result = await matchRequirements(jobProfile as any, candidateProfile);
  
  for (const match of result.matches) {
    console.log(`\nRequirement: ${match.requirement.normalized_name} (Category: ${match.requirement.category})`);
    console.log(`Classification: ${match.classification}`);
    console.log(`Explanation: ${match.explanation}`);
    console.log(`Evidence IDs:`, match.evidence.map(e => e.fact_id));
  }
}

test().catch(console.error);
